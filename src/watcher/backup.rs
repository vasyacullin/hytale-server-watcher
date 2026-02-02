use crate::config::BackupConfig;
use crate::watcher::state::{AppState, BackupInfo, LogLevel, LogSource};
use crate::watcher::telegram::{NotifyType, TelegramClient};
use chrono::{Local, Utc};
use std::fs::{self, File};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use tar::Builder;
use tokio::sync::watch;
use tokio::time::{interval, Instant};
use walkdir::WalkDir;
use xz2::write::XzEncoder;

pub struct BackupManager {
    config: BackupConfig,
    base_path: PathBuf,
    state: Arc<AppState>,
    telegram: Option<TelegramClient>,
    shutdown_rx: watch::Receiver<bool>,
}

impl BackupManager {
    pub fn new(
        config: BackupConfig,
        working_dir: Option<String>,
        state: Arc<AppState>,
        telegram: Option<TelegramClient>,
        shutdown_rx: watch::Receiver<bool>,
    ) -> Self {
        let base_path = working_dir
            .map(|d| PathBuf::from(d))
            .unwrap_or_else(|| std::env::current_dir().unwrap_or_default());

        Self {
            config,
            base_path,
            state,
            telegram,
            shutdown_rx,
        }
    }

    pub async fn run(mut self) {
        if !self.config.enabled {
            tracing::info!("Backup system disabled");
            return;
        }

        let interval_secs = self.config.interval_hours * 3600;
        let mut last_backup = Instant::now();

        self.state.set_next_backup_secs(Some(interval_secs));
        self.state.add_watcher_log(format!(
            "Backup system started: every {} hours, retention {} days",
            self.config.interval_hours, self.config.retention_days
        ));

        // Initial backup list scan
        self.refresh_backup_list();

        let mut ticker = interval(Duration::from_secs(1));

        loop {
            tokio::select! {
                _ = ticker.tick() => {}
                _ = self.shutdown_rx.changed() => {
                    if *self.shutdown_rx.borrow() {
                        break;
                    }
                }
            }

            let elapsed = last_backup.elapsed().as_secs();
            let remaining = interval_secs.saturating_sub(elapsed);
            self.state.set_next_backup_secs(Some(remaining));

            if elapsed >= interval_secs {
                self.create_backup_async().await;
                last_backup = Instant::now();
            }
        }

        self.state.set_next_backup_secs(None);
        tracing::info!("Backup manager stopped");
    }

    pub async fn create_backup_async(&self) {
        let source_path = self.base_path.join(&self.config.source_folder);
        let backup_path = self.base_path.join(&self.config.backup_folder);

        self.state
            .add_watcher_log(format!("Starting backup of {:?}...", source_path));

        // Run blocking backup in spawn_blocking
        let source = source_path.clone();
        let dest = backup_path.clone();
        let retention = self.config.retention_days;

        let result = tokio::task::spawn_blocking(move || {
            create_backup(&source, &dest).and_then(|file| {
                cleanup_old_backups(&dest, retention)?;
                Ok(file)
            })
        })
        .await;

        match result {
            Ok(Ok(backup_file)) => {
                let file_size = fs::metadata(&backup_file)
                    .map(|m| format_bytes(m.len()))
                    .unwrap_or_else(|_| "unknown".to_string());

                self.state.set_last_backup_time(Some(Local::now()));
                self.state.add_watcher_log(format!(
                    "Backup created: {} ({})",
                    backup_file.display(),
                    file_size
                ));

                if let Some(ref tg) = self.telegram {
                    let filename = backup_file
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy();
                    tg.notify(
                        NotifyType::Backup,
                        &format!("Backup created: {} ({})", filename, file_size),
                    )
                    .await;
                }

                self.refresh_backup_list();
            }
            Ok(Err(e)) => {
                self.state.add_log(
                    LogLevel::Error,
                    LogSource::Watcher,
                    format!("Backup failed: {}", e),
                );

                if let Some(ref tg) = self.telegram {
                    tg.notify(NotifyType::Error, &format!("Backup failed: {}", e))
                        .await;
                }
            }
            Err(e) => {
                self.state.add_log(
                    LogLevel::Error,
                    LogSource::Watcher,
                    format!("Backup task panicked: {}", e),
                );
            }
        }
    }

    fn refresh_backup_list(&self) {
        let backup_path = self.base_path.join(&self.config.backup_folder);
        let backups = list_backups(&backup_path).unwrap_or_default();
        self.state.set_backups(backups);
    }

    pub fn get_backup_path(&self) -> PathBuf {
        self.base_path.join(&self.config.backup_folder)
    }
}

pub fn create_backup(
    source_path: &Path,
    backup_path: &Path,
) -> Result<PathBuf, Box<dyn std::error::Error + Send + Sync>> {
    if !source_path.exists() {
        return Err(format!("Source folder does not exist: {:?}", source_path).into());
    }

    fs::create_dir_all(backup_path)?;

    let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
    let backup_filename = format!("backup_{}.tar.xz", timestamp);
    let backup_file_path = backup_path.join(&backup_filename);

    let file = File::create(&backup_file_path)?;
    let encoder = XzEncoder::new(file, 6);
    let mut tar = Builder::new(encoder);

    for entry in WalkDir::new(source_path) {
        let entry = entry?;
        let path = entry.path();
        let relative_path = path.strip_prefix(source_path)?;

        if path.is_file() {
            tar.append_path_with_name(path, relative_path)?;
        } else if path.is_dir() && path != source_path {
            tar.append_dir(relative_path, path)?;
        }
    }

    let encoder = tar.into_inner()?;
    encoder.finish()?;

    Ok(backup_file_path)
}

pub fn cleanup_old_backups(
    backup_path: &Path,
    retention_days: u64,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    if !backup_path.exists() {
        return Ok(());
    }

    let now = std::time::SystemTime::now();
    let retention_duration = Duration::from_secs(retention_days * 24 * 3600);

    for entry in fs::read_dir(backup_path)? {
        let entry = entry?;
        let path = entry.path();

        if !path.extension().map_or(false, |e| e == "xz") {
            continue;
        }

        if let Some(name) = path.file_name() {
            let name_str = name.to_string_lossy();
            if !name_str.starts_with("backup_") {
                continue;
            }
        }

        if let Ok(metadata) = entry.metadata() {
            if let Ok(modified) = metadata.modified() {
                if let Ok(age) = now.duration_since(modified) {
                    if age > retention_duration {
                        fs::remove_file(&path)?;
                        tracing::info!("Deleted old backup: {:?}", path);
                    }
                }
            }
        }
    }

    Ok(())
}

pub fn list_backups(backup_path: &Path) -> Result<Vec<BackupInfo>, std::io::Error> {
    if !backup_path.exists() {
        return Ok(vec![]);
    }

    let mut backups = Vec::new();

    for entry in fs::read_dir(backup_path)? {
        let entry = entry?;
        let path = entry.path();

        if !path.extension().map_or(false, |e| e == "xz") {
            continue;
        }

        if let Some(name) = path.file_name() {
            let name_str = name.to_string_lossy();
            if !name_str.starts_with("backup_") {
                continue;
            }

            if let Ok(metadata) = entry.metadata() {
                let created_at = metadata
                    .modified()
                    .ok()
                    .map(|t| DateTime::from(t))
                    .unwrap_or_else(Local::now);

                backups.push(BackupInfo {
                    filename: name_str.to_string(),
                    size_bytes: metadata.len(),
                    created_at,
                });
            }
        }
    }

    // Sort by date descending
    backups.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    Ok(backups)
}

pub fn delete_backup(backup_path: &Path, filename: &str) -> Result<(), std::io::Error> {
    let file_path = backup_path.join(filename);

    // Security check
    if !filename.starts_with("backup_") || !filename.ends_with(".tar.xz") {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "Invalid backup filename",
        ));
    }

    fs::remove_file(file_path)
}

pub fn format_bytes(bytes: u64) -> String {
    if bytes >= 1_073_741_824 {
        format!("{:.2} GB", bytes as f64 / 1_073_741_824.0)
    } else if bytes >= 1_048_576 {
        format!("{:.2} MB", bytes as f64 / 1_048_576.0)
    } else if bytes >= 1024 {
        format!("{:.2} KB", bytes as f64 / 1024.0)
    } else {
        format!("{} B", bytes)
    }
}

use chrono::DateTime;
