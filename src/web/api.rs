use crate::config::Config;
use crate::watcher::backup::{delete_backup, format_bytes, list_backups};
use crate::watcher::process::ProcessCommand;
use crate::watcher::state::AppState;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::mpsc;

/// Shared state for API handlers
#[derive(Clone)]
pub struct ApiState {
    pub app_state: Arc<AppState>,
    pub config: Arc<RwLock<Config>>,
    pub process_tx: mpsc::Sender<ProcessCommand>,
    pub backup_path: PathBuf,
}

// ============================================================================
// Response types
// ============================================================================

#[derive(Serialize)]
pub struct StatusResponse {
    pub status: String,
    pub pid: Option<u32>,
    pub uptime_secs: u64,
    pub restart_count: u32,
    pub auto_restart_remaining_secs: Option<u64>,
    pub next_backup_secs: Option<u64>,
}

#[derive(Serialize)]
pub struct StatsResponse {
    pub cpu_percent: f32,
    pub memory_mb: u64,
    pub memory_percent: f32,
    pub network_rx_speed: u64,
    pub network_tx_speed: u64,
    pub disk_read_speed: u64,
    pub disk_write_speed: u64,
}

#[derive(Serialize)]
pub struct LogResponse {
    pub timestamp: String,
    pub level: String,
    pub source: String,
    pub message: String,
}

#[derive(Serialize)]
pub struct BackupResponse {
    pub filename: String,
    pub size: String,
    pub size_bytes: u64,
    pub created_at: String,
}

#[derive(Serialize)]
pub struct SuccessResponse {
    pub success: bool,
    pub message: Option<String>,
}

#[derive(Serialize)]
pub struct FullStateResponse {
    pub status: StatusResponse,
    pub stats: StatsResponse,
    pub logs: Vec<LogResponse>,
    pub backups: Vec<BackupResponse>,
}

// ============================================================================
// Query params
// ============================================================================

#[derive(Deserialize)]
pub struct LogsQuery {
    #[serde(default = "default_limit")]
    pub limit: usize,
}

fn default_limit() -> usize {
    100
}

// ============================================================================
// Handlers
// ============================================================================

/// GET /api/status
pub async fn get_status(State(state): State<ApiState>) -> Json<StatusResponse> {
    let snapshot = state.app_state.snapshot();
    Json(StatusResponse {
        status: snapshot.status.as_str().to_string(),
        pid: snapshot.pid,
        uptime_secs: snapshot.uptime_secs,
        restart_count: snapshot.restart_count,
        auto_restart_remaining_secs: snapshot.auto_restart_remaining_secs,
        next_backup_secs: snapshot.next_backup_secs,
    })
}

/// GET /api/stats
pub async fn get_stats(State(state): State<ApiState>) -> Json<StatsResponse> {
    let stats = state.app_state.stats();
    Json(StatsResponse {
        cpu_percent: stats.cpu_percent,
        memory_mb: stats.memory_mb,
        memory_percent: stats.memory_percent,
        network_rx_speed: stats.network_rx_speed,
        network_tx_speed: stats.network_tx_speed,
        disk_read_speed: stats.disk_read_speed,
        disk_write_speed: stats.disk_write_speed,
    })
}

/// GET /api/logs
pub async fn get_logs(
    State(state): State<ApiState>,
    axum::extract::Query(query): axum::extract::Query<LogsQuery>,
) -> Json<Vec<LogResponse>> {
    let logs = state.app_state.logs(query.limit);
    let response: Vec<LogResponse> = logs
        .into_iter()
        .map(|log| LogResponse {
            timestamp: log.timestamp.format("%Y-%m-%d %H:%M:%S").to_string(),
            level: format!("{:?}", log.level).to_lowercase(),
            source: format!("{:?}", log.source).to_lowercase(),
            message: log.message,
        })
        .collect();
    Json(response)
}

/// GET /api/backups
pub async fn get_backups(State(state): State<ApiState>) -> Json<Vec<BackupResponse>> {
    let backups = list_backups(&state.backup_path).unwrap_or_default();
    let response: Vec<BackupResponse> = backups
        .into_iter()
        .map(|b| BackupResponse {
            filename: b.filename,
            size: format_bytes(b.size_bytes),
            size_bytes: b.size_bytes,
            created_at: b.created_at.format("%Y-%m-%d %H:%M:%S").to_string(),
        })
        .collect();
    Json(response)
}

/// GET /api/state - Full state in one request
pub async fn get_full_state(
    State(state): State<ApiState>,
) -> Json<FullStateResponse> {
    let snapshot = state.app_state.snapshot();
    let stats = state.app_state.stats();
    let logs = state.app_state.logs(100);
    let backups = list_backups(&state.backup_path).unwrap_or_default();

    Json(FullStateResponse {
        status: StatusResponse {
            status: snapshot.status.as_str().to_string(),
            pid: snapshot.pid,
            uptime_secs: snapshot.uptime_secs,
            restart_count: snapshot.restart_count,
            auto_restart_remaining_secs: snapshot.auto_restart_remaining_secs,
            next_backup_secs: snapshot.next_backup_secs,
        },
        stats: StatsResponse {
            cpu_percent: stats.cpu_percent,
            memory_mb: stats.memory_mb,
            memory_percent: stats.memory_percent,
            network_rx_speed: stats.network_rx_speed,
            network_tx_speed: stats.network_tx_speed,
            disk_read_speed: stats.disk_read_speed,
            disk_write_speed: stats.disk_write_speed,
        },
        logs: logs
            .into_iter()
            .map(|log| LogResponse {
                timestamp: log.timestamp.format("%Y-%m-%d %H:%M:%S").to_string(),
                level: format!("{:?}", log.level).to_lowercase(),
                source: format!("{:?}", log.source).to_lowercase(),
                message: log.message,
            })
            .collect(),
        backups: backups
            .into_iter()
            .map(|b| BackupResponse {
                filename: b.filename,
                size: format_bytes(b.size_bytes),
                size_bytes: b.size_bytes,
                created_at: b.created_at.format("%Y-%m-%d %H:%M:%S").to_string(),
            })
            .collect(),
    })
}

/// POST /api/restart
pub async fn restart_server(
    State(state): State<ApiState>,
) -> Result<Json<SuccessResponse>, StatusCode> {
    state
        .process_tx
        .send(ProcessCommand::Restart)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(SuccessResponse {
        success: true,
        message: Some("Restart command sent".to_string()),
    }))
}

/// POST /api/stop
pub async fn stop_server(
    State(state): State<ApiState>,
) -> Result<Json<SuccessResponse>, StatusCode> {
    state
        .process_tx
        .send(ProcessCommand::Stop)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(SuccessResponse {
        success: true,
        message: Some("Stop command sent".to_string()),
    }))
}

/// DELETE /api/backups/:filename
pub async fn delete_backup_handler(
    State(state): State<ApiState>,
    Path(filename): Path<String>,
) -> Result<Json<SuccessResponse>, (StatusCode, String)> {
    delete_backup(&state.backup_path, &filename)
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

    Ok(Json(SuccessResponse {
        success: true,
        message: Some(format!("Deleted {}", filename)),
    }))
}

/// GET /api/backups/:filename - Download backup
pub async fn download_backup(
    State(state): State<ApiState>,
    Path(filename): Path<String>,
) -> Result<impl IntoResponse, StatusCode> {
    use axum::body::Body;
    use axum::http::header;
    use tokio_util::io::ReaderStream;

    // Security check
    if !filename.starts_with("backup_") || !filename.ends_with(".tar.xz") {
        return Err(StatusCode::BAD_REQUEST);
    }

    let file_path = state.backup_path.join(&filename);
    let file = tokio::fs::File::open(&file_path)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    let stream = ReaderStream::new(file);
    let body = Body::from_stream(stream);

    let content_disposition = format!("attachment; filename=\"{}\"", filename);

    Ok((
        [
            (header::CONTENT_TYPE, "application/x-xz".to_string()),
            (header::CONTENT_DISPOSITION, content_disposition),
        ],
        body,
    ))
}

/// GET /api/config
pub async fn get_config(State(state): State<ApiState>) -> Json<Config> {
    let config = state.config.read().clone();
    Json(config)
}

/// PUT /api/config
pub async fn update_config(
    State(state): State<ApiState>,
    Json(new_config): Json<Config>,
) -> Result<Json<SuccessResponse>, (StatusCode, String)> {
    // Save to file
    new_config
        .save("config-watcher.json")
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Update in memory
    *state.config.write() = new_config;

    Ok(Json(SuccessResponse {
        success: true,
        message: Some("Config updated (restart required for some changes)".to_string()),
    }))
}
