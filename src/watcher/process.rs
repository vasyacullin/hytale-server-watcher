use crate::config::{Config, ErrorPatterns, RestartConfig};
use crate::watcher::state::{AppState, LogLevel, LogSource, ServerStatus};
use crate::watcher::telegram::{NotifyType, TelegramClient};
use encoding_rs::WINDOWS_1251;
use std::process::Stdio;
use tokio::io::AsyncWriteExt;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::{mpsc, watch};
use tokio::time::{sleep, Duration};

/// Commands that can be sent to the process manager
#[derive(Debug)]
pub enum ProcessCommand {
    Restart,
    Stop,
    SendInput(String),
}

pub struct ProcessManager {
    config: Config,
    state: Arc<AppState>,
    telegram: Option<TelegramClient>,
    shutdown_rx: watch::Receiver<bool>,
    command_rx: mpsc::Receiver<ProcessCommand>,
}

impl ProcessManager {
    pub fn new(
        config: Config,
        state: Arc<AppState>,
        telegram: Option<TelegramClient>,
        shutdown_rx: watch::Receiver<bool>,
        command_rx: mpsc::Receiver<ProcessCommand>,
    ) -> Self {
        Self {
            config,
            state,
            telegram,
            shutdown_rx,
            command_rx,
        }
    }

    pub async fn run(mut self) {
        loop {
            // Check restart limit
            if let Some(max) = self.config.server.max_restarts {
                if self.state.restart_count() >= max {
                    self.state.add_watcher_log("Max restart limit reached".to_string());
                    break;
                }
            }

            // Check shutdown
            if *self.shutdown_rx.borrow() {
                break;
            }

            // Start server
            self.state.set_status(ServerStatus::Starting);
            self.state.add_watcher_log(format!(
                "Starting server: {} {}",
                self.config.server.executable,
                self.config.server.arguments.join(" ")
            ));

            match self.spawn_server().await {
                Ok(mut child) => {
                    let pid = child.id().unwrap_or(0);
                    self.state.set_pid(Some(pid));
                    self.state.set_status(ServerStatus::Running);
                    self.state.set_start_time(Some(Instant::now()));
                    self.state.add_watcher_log(format!("Server started with PID: {}", pid));

                    if let Some(ref tg) = self.telegram {
                        tg.notify(NotifyType::Start, &format!("Server started (PID: {})", pid))
                            .await;
                    }

                    // Run until exit or command
                    let exit_reason = self.monitor_process(&mut child).await;

                    // Cleanup
                    let _ = child.kill().await;
                    let _ = child.wait().await;

                    self.state.set_pid(None);
                    self.state.set_start_time(None);
                    self.state.set_auto_restart_remaining(None);

                    match exit_reason {
                        ExitReason::Shutdown => {
                            self.state.set_status(ServerStatus::Stopped);
                            break;
                        }
                        ExitReason::Restart | ExitReason::ProcessExit | ExitReason::Error => {
                            if !*self.shutdown_rx.borrow() {
                                self.handle_restart().await;
                            } else {
                                self.state.set_status(ServerStatus::Stopped);
                                break;
                            }
                        }
                        ExitReason::Stopped => {
                            self.state.set_status(ServerStatus::Stopped);
                            self.state.add_watcher_log("Server stopped normally".to_string());
                            break;
                        }
                    }
                }
                Err(e) => {
                    self.state.set_status(ServerStatus::Error);
                    self.state.add_log(
                        LogLevel::Critical,
                        LogSource::Watcher,
                        format!("Failed to start: {}", e),
                    );
                    self.state.increment_restart_count();

                    if let Some(ref tg) = self.telegram {
                        tg.notify(NotifyType::Critical, &format!("Failed to start: {}", e))
                            .await;
                    }

                    // Wait before retry
                    sleep(Duration::from_secs(self.config.server.restart_delay_seconds)).await;
                }
            }
        }

        self.state.set_status(ServerStatus::Stopped);
        tracing::info!("Process manager stopped");
    }

    async fn spawn_server(&self) -> Result<Child, std::io::Error> {
        let mut command = Command::new(&self.config.server.executable);
        command
            .args(&self.config.server.arguments)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true);

        if let Some(ref dir) = self.config.server.working_directory {
            command.current_dir(dir);
        }

        command.spawn()
    }

    async fn monitor_process(&mut self, child: &mut Child) -> ExitReason {
        let stdout = child.stdout.take();
        let stderr = child.stderr.take();
        let stdin = child.stdin.take();

        let found_error = Arc::new(AtomicBool::new(false));
        let force_restart = Arc::new(AtomicBool::new(false));
        let auto_restart_triggered = Arc::new(AtomicBool::new(false));

        // Stderr reader task
        let state_err = Arc::clone(&self.state);
        let patterns_err = self.config.error_patterns.clone();
        let restart_on_err = self.config.restart_on.clone();
        let found_error_err = Arc::clone(&found_error);
        let telegram_err = self.telegram.clone();

        let stderr_task = tokio::spawn(async move {
            if let Some(stderr) = stderr {
                let reader = BufReader::new(stderr);
                let mut lines = reader.lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    let level = detect_error_level(&line, &patterns_err);
                    state_err.add_log(level, LogSource::Stderr, line.clone());

                    if should_restart(level, &restart_on_err) {
                        found_error_err.store(true, Ordering::SeqCst);
                        if let Some(ref tg) = telegram_err {
                            tg.notify(NotifyType::Error, &line).await;
                        }
                    }
                }
            }
        });

        // Auto-restart timer task
        let auto_restart_task = if self.config.server.auto_restart_hourly {
            let state_auto = Arc::clone(&self.state);
            let auto_restart_triggered_clone = Arc::clone(&auto_restart_triggered);
            let telegram_auto = self.telegram.clone();
            let warning_message = self.config.server.restart_warning_message.clone();
            let stdin_arc = Arc::new(tokio::sync::Mutex::new(stdin));
            let stdin_for_task = Arc::clone(&stdin_arc);

            self.state.set_auto_restart_remaining(Some(60 * 60));

            Some(tokio::spawn(async move {
                let start = Instant::now();
                let warning_time = Duration::from_secs(59 * 60);
                let restart_time = Duration::from_secs(60 * 60);
                let mut warning_sent = false;

                loop {
                    sleep(Duration::from_secs(1)).await;

                    let elapsed = start.elapsed();
                    let remaining = restart_time.saturating_sub(elapsed).as_secs();
                    state_auto.set_auto_restart_remaining(Some(remaining));

                    // Warning at 59 minutes
                    if elapsed >= warning_time && !warning_sent {
                        warning_sent = true;
                        state_auto.add_watcher_log("Auto-restart: sending warning".to_string());

                        if let Ok(mut stdin_guard) = stdin_for_task.try_lock() {
                            if let Some(ref mut stdin) = *stdin_guard {
                                let cmd = format!("broadcast {}\n", warning_message);
                                let (encoded, _, _) = WINDOWS_1251.encode(&cmd);
                                let _ = stdin.write_all(&encoded).await;
                                let _ = stdin.flush().await;
                            }
                        }

                        if let Some(ref tg) = telegram_auto {
                            tg.notify(NotifyType::Info, "Auto-restart warning (1 min remaining)")
                                .await;
                        }
                    }

                    // Restart at 60 minutes
                    if elapsed >= restart_time {
                        state_auto.add_watcher_log("Auto-restart: hourly restart".to_string());
                        if let Some(ref tg) = telegram_auto {
                            tg.notify(NotifyType::Restart, "Hourly auto-restart triggered")
                                .await;
                        }
                        auto_restart_triggered_clone.store(true, Ordering::SeqCst);
                        break;
                    }
                }
            }))
        } else {
            None
        };

        // Stdout reader (main loop)
        let state_out = Arc::clone(&self.state);
        let patterns_out = self.config.error_patterns.clone();
        let restart_on_out = self.config.restart_on.clone();
        let found_error_out = Arc::clone(&found_error);
        let auto_restart_out = Arc::clone(&auto_restart_triggered);
        let force_restart_out = Arc::clone(&force_restart);
        let telegram_out = self.telegram.clone();

        let stdout_task = tokio::spawn(async move {
            if let Some(stdout) = stdout {
                let reader = BufReader::new(stdout);
                let mut lines = reader.lines();

                while let Ok(Some(line)) = lines.next_line().await {
                    if force_restart_out.load(Ordering::SeqCst)
                        || auto_restart_out.load(Ordering::SeqCst)
                    {
                        break;
                    }

                    let level = detect_error_level(&line, &patterns_out);
                    state_out.add_log(level, LogSource::Server, line.clone());

                    if should_restart(level, &restart_on_out) {
                        found_error_out.store(true, Ordering::SeqCst);
                        if let Some(ref tg) = telegram_out {
                            let notify_type = match level {
                                LogLevel::Critical => NotifyType::Critical,
                                _ => NotifyType::Error,
                            };
                            tg.notify(notify_type, &line).await;
                        }
                        break;
                    }
                }
            }
        });

        // Wait for exit conditions
        tokio::pin!(stdout_task);

        let exit_reason = loop {
            tokio::select! {
                _ = self.shutdown_rx.changed() => {
                    if *self.shutdown_rx.borrow() {
                        stderr_task.abort();
                        stdout_task.abort();
                        if let Some(ref t) = auto_restart_task { t.abort(); }
                        break ExitReason::Shutdown;
                    }
                }
                Some(cmd) = self.command_rx.recv() => {
                    match cmd {
                        ProcessCommand::Restart => {
                            force_restart.store(true, Ordering::SeqCst);
                            self.state.add_watcher_log("Manual restart requested".to_string());
                            // Signal stdout to break
                            stdout_task.abort();
                        }
                        ProcessCommand::Stop => {
                            stderr_task.abort();
                            stdout_task.abort();
                            if let Some(ref t) = auto_restart_task { t.abort(); }
                            break ExitReason::Stopped;
                        }
                        ProcessCommand::SendInput(_input) => {
                            // TODO: send to stdin
                        }
                    }
                }
                _ = &mut stdout_task => {
                    break ExitReason::ProcessExit;
                }
            }
        };

        // Cleanup tasks
        stderr_task.abort();
        if let Some(t) = auto_restart_task {
            t.abort();
        }

        // Determine final exit reason
        if matches!(exit_reason, ExitReason::Shutdown | ExitReason::Stopped) {
            return exit_reason;
        }

        // Determine exit reason
        if force_restart.load(Ordering::SeqCst) || auto_restart_triggered.load(Ordering::SeqCst) {
            ExitReason::Restart
        } else if found_error.load(Ordering::SeqCst) {
            ExitReason::Error
        } else if self.config.restart_on.process_exit {
            ExitReason::ProcessExit
        } else {
            ExitReason::Stopped
        }
    }

    async fn handle_restart(&self) {
        self.state.set_status(ServerStatus::Restarting);
        self.state.increment_restart_count();
        self.state.add_watcher_log(format!(
            "Restarting in {} seconds...",
            self.config.server.restart_delay_seconds
        ));

        if let Some(ref tg) = self.telegram {
            tg.notify(
                NotifyType::Restart,
                &format!(
                    "Restarting in {} seconds",
                    self.config.server.restart_delay_seconds
                ),
            )
            .await;
        }

        // Wait with shutdown check
        let delay = Duration::from_secs(self.config.server.restart_delay_seconds);
        let start = Instant::now();
        while start.elapsed() < delay {
            if *self.shutdown_rx.borrow() {
                break;
            }
            sleep(Duration::from_millis(100)).await;
        }
    }
}

#[derive(Debug, Clone, Copy)]
enum ExitReason {
    Shutdown,
    Restart,
    Stopped,
    ProcessExit,
    Error,
}

fn detect_error_level(line: &str, patterns: &ErrorPatterns) -> LogLevel {
    for pattern in &patterns.critical {
        if line.contains(pattern) {
            return LogLevel::Critical;
        }
    }
    for pattern in &patterns.errors {
        if line.contains(pattern) {
            return LogLevel::Error;
        }
    }
    for pattern in &patterns.warnings {
        if line.contains(pattern) {
            return LogLevel::Warning;
        }
    }
    LogLevel::Info
}

fn should_restart(level: LogLevel, config: &RestartConfig) -> bool {
    match level {
        LogLevel::Critical => config.critical,
        LogLevel::Error => config.errors,
        LogLevel::Warning => config.warnings,
        LogLevel::Info => false,
    }
}
