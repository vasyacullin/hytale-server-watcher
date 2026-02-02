mod config;
mod watcher;
mod web;

use config::Config;
use parking_lot::RwLock;
use std::sync::Arc;
use tokio::sync::{mpsc, watch};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use watcher::{
    backup::BackupManager,
    process::{ProcessCommand, ProcessManager},
    state::AppState,
    stats::StatsCollector,
    telegram::TelegramClient,
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize logging
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info,tower_http=debug".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load config
    let config = match Config::load("config-watcher.json") {
        Ok(cfg) => {
            tracing::info!("Config loaded from config-watcher.json");
            cfg
        }
        Err(e) => {
            tracing::warn!("Failed to load config: {}, using defaults", e);
            let default = Config::default_config();
            if let Err(e) = default.save("config-watcher.json") {
                tracing::error!("Failed to save default config: {}", e);
            }
            default
        }
    };

    let config = Arc::new(RwLock::new(config));

    // Create shared state
    let app_state = AppState::new();

    // Shutdown signal
    let (shutdown_tx, shutdown_rx) = watch::channel(false);

    // Process command channel
    let (process_tx, process_rx) = mpsc::channel::<ProcessCommand>(32);

    // Telegram client
    let telegram = {
        let cfg = config.read();
        if cfg.telegram.enabled {
            let client = TelegramClient::new(cfg.telegram.clone());
            Some(client)
        } else {
            None
        }
    };

    if let Some(ref tg) = telegram {
        tg.notify(watcher::telegram::NotifyType::Start, "Server Watcher started")
            .await;
    }

    // Spawn stats collector
    let stats_collector = StatsCollector::new(Arc::clone(&app_state), shutdown_rx.clone());
    let stats_handle = tokio::spawn(stats_collector.run());

    // Spawn backup manager
    let backup_manager = {
        let cfg = config.read();
        BackupManager::new(
            cfg.backup.clone(),
            cfg.server.working_directory.clone(),
            Arc::clone(&app_state),
            telegram.clone(),
            shutdown_rx.clone(),
        )
    };
    let backup_handle = tokio::spawn(backup_manager.run());

    // Spawn process manager
    let process_manager = {
        let cfg = config.read().clone();
        ProcessManager::new(
            cfg,
            Arc::clone(&app_state),
            telegram.clone(),
            shutdown_rx.clone(),
            process_rx,
        )
    };
    let process_handle = tokio::spawn(process_manager.run());

    // Spawn web server
    let web_handle = tokio::spawn(web::start_server(
        Arc::clone(&config),
        Arc::clone(&app_state),
        process_tx.clone(),
        shutdown_rx.clone(),
    ));

    // Handle Ctrl+C
    tokio::spawn(async move {
        tokio::signal::ctrl_c().await.ok();
        tracing::info!("Shutdown signal received");
        let _ = shutdown_tx.send(true);
    });

    // Wait for all tasks
    let _ = tokio::join!(stats_handle, backup_handle, process_handle, web_handle);

    if let Some(ref tg) = telegram {
        tg.notify(watcher::telegram::NotifyType::Stop, "Server Watcher stopped")
            .await;
    }

    tracing::info!("Server Watcher stopped");
    Ok(())
}
