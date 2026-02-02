use chrono::{DateTime, Local};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::Arc;
use std::time::Instant;

/// Server status enum
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ServerStatus {
    Starting,
    Running,
    Stopping,
    Stopped,
    Restarting,
    Error,
}

impl ServerStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            ServerStatus::Starting => "starting",
            ServerStatus::Running => "running",
            ServerStatus::Stopping => "stopping",
            ServerStatus::Stopped => "stopped",
            ServerStatus::Restarting => "restarting",
            ServerStatus::Error => "error",
        }
    }
}

/// Log severity level
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
    Critical,
    Error,
    Warning,
    Info,
}

/// Log source
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LogSource {
    Server,
    Watcher,
    Stderr,
}

/// Single log entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub timestamp: DateTime<Local>,
    pub level: LogLevel,
    pub source: LogSource,
    pub message: String,
}

/// Resource statistics
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ResourceStats {
    pub cpu_percent: f32,
    pub memory_mb: u64,
    pub memory_percent: f32,
    pub network_rx_speed: u64,
    pub network_tx_speed: u64,
    pub disk_read_speed: u64,
    pub disk_write_speed: u64,
}

/// Backup info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupInfo {
    pub filename: String,
    pub size_bytes: u64,
    pub created_at: DateTime<Local>,
}

/// Application state (thread-safe)
pub struct AppState {
    inner: RwLock<AppStateInner>,
    /// Start time for uptime calculation (not serialized)
    start_time: RwLock<Option<Instant>>,
}

struct AppStateInner {
    pub status: ServerStatus,
    pub pid: Option<u32>,
    pub restart_count: u32,
    pub logs: VecDeque<LogEntry>,
    pub max_logs: usize,
    pub stats: ResourceStats,
    pub auto_restart_remaining_secs: Option<u64>,
    pub next_backup_secs: Option<u64>,
    pub last_backup_time: Option<DateTime<Local>>,
    pub backups: Vec<BackupInfo>,
}

impl AppState {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            inner: RwLock::new(AppStateInner {
                status: ServerStatus::Stopped,
                pid: None,
                restart_count: 0,
                logs: VecDeque::with_capacity(1000),
                max_logs: 1000,
                stats: ResourceStats::default(),
                auto_restart_remaining_secs: None,
                next_backup_secs: None,
                last_backup_time: None,
                backups: vec![],
            }),
            start_time: RwLock::new(None),
        })
    }

    // Getters
    pub fn status(&self) -> ServerStatus {
        self.inner.read().status
    }

    pub fn pid(&self) -> Option<u32> {
        self.inner.read().pid
    }

    pub fn restart_count(&self) -> u32 {
        self.inner.read().restart_count
    }

    pub fn uptime_secs(&self) -> u64 {
        self.start_time
            .read()
            .map(|t| t.elapsed().as_secs())
            .unwrap_or(0)
    }

    pub fn stats(&self) -> ResourceStats {
        self.inner.read().stats.clone()
    }

    pub fn auto_restart_remaining(&self) -> Option<u64> {
        self.inner.read().auto_restart_remaining_secs
    }

    pub fn next_backup_secs(&self) -> Option<u64> {
        self.inner.read().next_backup_secs
    }

    pub fn last_backup_time(&self) -> Option<DateTime<Local>> {
        self.inner.read().last_backup_time
    }

    pub fn backups(&self) -> Vec<BackupInfo> {
        self.inner.read().backups.clone()
    }

    pub fn logs(&self, limit: usize) -> Vec<LogEntry> {
        let inner = self.inner.read();
        inner.logs.iter().rev().take(limit).cloned().collect()
    }

    // Setters
    pub fn set_status(&self, status: ServerStatus) {
        self.inner.write().status = status;
    }

    pub fn set_pid(&self, pid: Option<u32>) {
        self.inner.write().pid = pid;
    }

    pub fn set_start_time(&self, time: Option<Instant>) {
        *self.start_time.write() = time;
    }

    pub fn increment_restart_count(&self) {
        self.inner.write().restart_count += 1;
    }

    pub fn set_stats(&self, stats: ResourceStats) {
        self.inner.write().stats = stats;
    }

    pub fn set_auto_restart_remaining(&self, secs: Option<u64>) {
        self.inner.write().auto_restart_remaining_secs = secs;
    }

    pub fn set_next_backup_secs(&self, secs: Option<u64>) {
        self.inner.write().next_backup_secs = secs;
    }

    pub fn set_last_backup_time(&self, time: Option<DateTime<Local>>) {
        self.inner.write().last_backup_time = time;
    }

    pub fn set_backups(&self, backups: Vec<BackupInfo>) {
        self.inner.write().backups = backups;
    }

    pub fn add_log(&self, level: LogLevel, source: LogSource, message: String) {
        let mut inner = self.inner.write();
        inner.logs.push_back(LogEntry {
            timestamp: Local::now(),
            level,
            source,
            message,
        });

        while inner.logs.len() > inner.max_logs {
            inner.logs.pop_front();
        }
    }

    pub fn add_watcher_log(&self, message: String) {
        self.add_log(LogLevel::Info, LogSource::Watcher, message);
    }

    /// Get full snapshot for API
    pub fn snapshot(&self) -> StateSnapshot {
        let inner = self.inner.read();
        StateSnapshot {
            status: inner.status,
            pid: inner.pid,
            uptime_secs: self.uptime_secs(),
            restart_count: inner.restart_count,
            stats: inner.stats.clone(),
            auto_restart_remaining_secs: inner.auto_restart_remaining_secs,
            next_backup_secs: inner.next_backup_secs,
            last_backup_time: inner.last_backup_time,
        }
    }
}

/// Serializable snapshot of state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateSnapshot {
    pub status: ServerStatus,
    pub pid: Option<u32>,
    pub uptime_secs: u64,
    pub restart_count: u32,
    pub stats: ResourceStats,
    pub auto_restart_remaining_secs: Option<u64>,
    pub next_backup_secs: Option<u64>,
    pub last_backup_time: Option<DateTime<Local>>,
}
