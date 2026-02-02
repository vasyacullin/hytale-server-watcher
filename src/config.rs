use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub server: ServerConfig,
    pub telegram: TelegramConfig,
    pub resources: ResourceConfig,
    pub error_patterns: ErrorPatterns,
    pub restart_on: RestartConfig,
    #[serde(default)]
    pub backup: BackupConfig,
    #[serde(default)]
    pub web: WebConfig,
    #[serde(default)]
    pub remote_servers: Vec<RemoteServer>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub executable: String,
    pub arguments: Vec<String>,
    pub working_directory: Option<String>,
    pub restart_delay_seconds: u64,
    pub max_restarts: Option<u32>,
    #[serde(default)]
    pub auto_restart_hourly: bool,
    #[serde(default = "default_restart_warning_message")]
    pub restart_warning_message: String,
}

fn default_restart_warning_message() -> String {
    "Server will restart in 1 minute!".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelegramConfig {
    pub enabled: bool,
    pub token: String,
    pub chat_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceConfig {
    pub cpu_threshold_percent: f32,
    pub memory_threshold_mb: u64,
    pub check_interval_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorPatterns {
    pub critical: Vec<String>,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RestartConfig {
    pub critical: bool,
    pub errors: bool,
    pub warnings: bool,
    pub process_exit: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupConfig {
    #[serde(default = "default_backup_enabled")]
    pub enabled: bool,
    #[serde(default = "default_backup_source")]
    pub source_folder: String,
    #[serde(default = "default_backup_dest")]
    pub backup_folder: String,
    #[serde(default = "default_backup_interval")]
    pub interval_hours: u64,
    #[serde(default = "default_backup_retention")]
    pub retention_days: u64,
}

fn default_backup_enabled() -> bool { true }
fn default_backup_source() -> String { "universe".to_string() }
fn default_backup_dest() -> String { "backups".to_string() }
fn default_backup_interval() -> u64 { 4 }
fn default_backup_retention() -> u64 { 10 }

impl Default for BackupConfig {
    fn default() -> Self {
        Self {
            enabled: default_backup_enabled(),
            source_folder: default_backup_source(),
            backup_folder: default_backup_dest(),
            interval_hours: default_backup_interval(),
            retention_days: default_backup_retention(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebConfig {
    #[serde(default = "default_web_enabled")]
    pub enabled: bool,
    #[serde(default = "default_web_port")]
    pub port: u16,
    #[serde(default = "default_web_host")]
    pub host: String,
    #[serde(default)]
    pub auth_token: Option<String>,
}

fn default_web_enabled() -> bool { true }
fn default_web_port() -> u16 { 3000 }
fn default_web_host() -> String { "0.0.0.0".to_string() }

impl Default for WebConfig {
    fn default() -> Self {
        Self {
            enabled: default_web_enabled(),
            port: default_web_port(),
            host: default_web_host(),
            auth_token: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteServer {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub token: Option<String>,
}

impl Config {
    pub fn load<P: AsRef<Path>>(path: P) -> Result<Self, Box<dyn std::error::Error>> {
        let content = fs::read_to_string(path)?;
        let config: Config = serde_json::from_str(&content)?;
        Ok(config)
    }

    pub fn save<P: AsRef<Path>>(&self, path: P) -> Result<(), Box<dyn std::error::Error>> {
        let json = serde_json::to_string_pretty(self)?;
        fs::write(path, json)?;
        Ok(())
    }

    pub fn default_config() -> Self {
        Self {
            server: ServerConfig {
                executable: "java".to_string(),
                arguments: vec![
                    "-Xms4G".to_string(),
                    "-Xmx8G".to_string(),
                    "-jar".to_string(),
                    "server.jar".to_string(),
                ],
                working_directory: None,
                restart_delay_seconds: 30,
                max_restarts: None,
                auto_restart_hourly: false,
                restart_warning_message: default_restart_warning_message(),
            },
            telegram: TelegramConfig {
                enabled: false,
                token: "YOUR_BOT_TOKEN".to_string(),
                chat_id: "YOUR_CHAT_ID".to_string(),
            },
            resources: ResourceConfig {
                cpu_threshold_percent: 90.0,
                memory_threshold_mb: 4096,
                check_interval_seconds: 5,
            },
            error_patterns: ErrorPatterns {
                critical: vec![
                    "FATAL".to_string(),
                    "Server crashed".to_string(),
                    "OutOfMemoryError".to_string(),
                ],
                errors: vec!["ERROR".to_string(), "Exception".to_string()],
                warnings: vec!["WARN".to_string(), "Warning".to_string()],
            },
            restart_on: RestartConfig {
                critical: true,
                errors: false,
                warnings: false,
                process_exit: true,
            },
            backup: BackupConfig::default(),
            web: WebConfig::default(),
            remote_servers: vec![],
        }
    }
}
