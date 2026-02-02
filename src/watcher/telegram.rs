use crate::config::TelegramConfig;
use chrono::Local;
use serde_json::json;

#[derive(Debug, Clone, Copy)]
pub enum NotifyType {
    Start,
    Error,
    Critical,
    Restart,
    Success,
    Stop,
    Resources,
    Info,
    Backup,
}

#[derive(Clone)]
pub struct TelegramClient {
    config: TelegramConfig,
    client: reqwest::Client,
}

impl TelegramClient {
    pub fn new(config: TelegramConfig) -> Self {
        Self {
            config,
            client: reqwest::Client::new(),
        }
    }

    pub async fn send(&self, text: &str) -> Result<(), reqwest::Error> {
        if !self.config.enabled {
            return Ok(());
        }

        let url = format!(
            "https://api.telegram.org/bot{}/sendMessage",
            self.config.token
        );

        let body = json!({
            "chat_id": self.config.chat_id,
            "text": text,
            "parse_mode": "HTML"
        });

        self.client.post(&url).json(&body).send().await?;
        Ok(())
    }

    pub async fn notify(&self, event_type: NotifyType, message: &str) {
        let (emoji, label) = match event_type {
            NotifyType::Start => ("🚀", "START"),
            NotifyType::Error => ("⚠️", "ERROR"),
            NotifyType::Critical => ("🔴", "CRITICAL"),
            NotifyType::Restart => ("🔄", "RESTART"),
            NotifyType::Success => ("✅", "SUCCESS"),
            NotifyType::Stop => ("🛑", "STOP"),
            NotifyType::Resources => ("📊", "RESOURCES"),
            NotifyType::Info => ("ℹ️", "INFO"),
            NotifyType::Backup => ("💾", "BACKUP"),
        };

        let time = Local::now().format("%H:%M:%S");
        let text = format!("{} <b>[{}]</b> {}\n<i>{}</i>", emoji, time, label, message);

        if let Err(e) = self.send(&text).await {
            tracing::error!("Failed to send telegram notification: {}", e);
        }
    }
}
