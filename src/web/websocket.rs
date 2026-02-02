use crate::watcher::state::AppState;
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::Response,
};
use futures_util::{SinkExt, StreamExt};
use serde::Serialize;
use std::sync::Arc;
use tokio::time::{interval, Duration};

use super::api::ApiState;

/// WebSocket message types sent to clients
#[derive(Serialize)]
#[serde(tag = "type", content = "data")]
pub enum WsMessage {
    #[serde(rename = "status")]
    Status {
        status: String,
        pid: Option<u32>,
        uptime_secs: u64,
        restart_count: u32,
        auto_restart_remaining_secs: Option<u64>,
        next_backup_secs: Option<u64>,
    },
    #[serde(rename = "stats")]
    Stats {
        cpu_percent: f32,
        memory_mb: u64,
        memory_percent: f32,
        network_rx_speed: u64,
        network_tx_speed: u64,
    },
    #[serde(rename = "log")]
    Log {
        timestamp: String,
        level: String,
        source: String,
        message: String,
    },
    #[serde(rename = "ping")]
    Ping,
}

/// WebSocket upgrade handler
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<ApiState>,
) -> Response {
    ws.on_upgrade(move |socket| handle_socket(socket, state.app_state))
}

async fn handle_socket(socket: WebSocket, app_state: Arc<AppState>) {
    let (mut sender, mut receiver) = socket.split();

    // Track last log count to detect new logs
    let mut last_log_count = app_state.logs(1000).len();

    // Spawn task to send updates
    let state_clone = Arc::clone(&app_state);
    let send_task = tokio::spawn(async move {
        let mut ticker = interval(Duration::from_secs(1));

        loop {
            ticker.tick().await;

            // Send status
            let snapshot = state_clone.snapshot();
            let status_msg = WsMessage::Status {
                status: snapshot.status.as_str().to_string(),
                pid: snapshot.pid,
                uptime_secs: snapshot.uptime_secs,
                restart_count: snapshot.restart_count,
                auto_restart_remaining_secs: snapshot.auto_restart_remaining_secs,
                next_backup_secs: snapshot.next_backup_secs,
            };

            if let Ok(json) = serde_json::to_string(&status_msg) {
                if sender.send(Message::Text(json)).await.is_err() {
                    break;
                }
            }

            // Send stats
            let stats = state_clone.stats();
            let stats_msg = WsMessage::Stats {
                cpu_percent: stats.cpu_percent,
                memory_mb: stats.memory_mb,
                memory_percent: stats.memory_percent,
                network_rx_speed: stats.network_rx_speed,
                network_tx_speed: stats.network_tx_speed,
            };

            if let Ok(json) = serde_json::to_string(&stats_msg) {
                if sender.send(Message::Text(json)).await.is_err() {
                    break;
                }
            }

            // Send new logs
            let logs = state_clone.logs(1000);
            let current_count = logs.len();
            if current_count > last_log_count {
                // Send only new logs
                let new_logs = &logs[..current_count - last_log_count];
                for log in new_logs.iter().rev() {
                    let log_msg = WsMessage::Log {
                        timestamp: log.timestamp.format("%Y-%m-%d %H:%M:%S").to_string(),
                        level: format!("{:?}", log.level).to_lowercase(),
                        source: format!("{:?}", log.source).to_lowercase(),
                        message: log.message.clone(),
                    };

                    if let Ok(json) = serde_json::to_string(&log_msg) {
                        if sender.send(Message::Text(json)).await.is_err() {
                            break;
                        }
                    }
                }
                last_log_count = current_count;
            }
        }
    });

    // Handle incoming messages (pings, etc)
    let recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            match msg {
                Message::Ping(data) => {
                    // Pong is sent automatically by axum
                    tracing::debug!("Received ping: {:?}", data);
                }
                Message::Close(_) => {
                    break;
                }
                _ => {}
            }
        }
    });

    // Wait for either task to finish
    tokio::select! {
        _ = send_task => {}
        _ = recv_task => {}
    }

    tracing::debug!("WebSocket connection closed");
}
