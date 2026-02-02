use crate::config::Config;
use crate::watcher::process::ProcessCommand;
use crate::watcher::state::AppState;
use axum::{
    http::{header, StatusCode, Uri},
    response::{Html, IntoResponse, Response},
    routing::{delete, get, post, put},
    Router,
};
use parking_lot::RwLock;
use rust_embed::RustEmbed;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::{mpsc, watch};
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;

use super::api::{self, ApiState};
use super::websocket;

/// Embedded static files from web-ui/dist
#[derive(RustEmbed)]
#[folder = "web-ui/dist"]
struct Assets;

/// Start the web server
pub async fn start_server(
    config: Arc<RwLock<Config>>,
    app_state: Arc<AppState>,
    process_tx: mpsc::Sender<ProcessCommand>,
    shutdown_rx: watch::Receiver<bool>,
) {
    let web_config = config.read().web.clone();

    if !web_config.enabled {
        tracing::info!("Web server disabled");
        return;
    }

    let backup_path = {
        let cfg = config.read();
        let base = cfg
            .server
            .working_directory
            .clone()
            .map(PathBuf::from)
            .unwrap_or_else(|| std::env::current_dir().unwrap_or_default());
        base.join(&cfg.backup.backup_folder)
    };

    let api_state = ApiState {
        app_state,
        config,
        process_tx,
        backup_path,
    };

    // CORS for development
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Build router
    let app = Router::new()
        // API routes
        .route("/api/status", get(api::get_status))
        .route("/api/stats", get(api::get_stats))
        .route("/api/logs", get(api::get_logs))
        .route("/api/backups", get(api::get_backups))
        .route("/api/backups/:filename", get(api::download_backup))
        .route("/api/backups/:filename", delete(api::delete_backup_handler))
        .route("/api/state", get(api::get_full_state))
        .route("/api/restart", post(api::restart_server))
        .route("/api/stop", post(api::stop_server))
        .route("/api/config", get(api::get_config))
        .route("/api/config", put(api::update_config))
        // WebSocket
        .route("/ws", get(websocket::ws_handler))
        // Static files (SPA)
        .fallback(static_handler)
        .with_state(api_state)
        .layer(cors)
        .layer(TraceLayer::new_for_http());

    let addr: SocketAddr = format!("{}:{}", web_config.host, web_config.port)
        .parse()
        .expect("Invalid address");

    tracing::info!("Web server starting on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();

    // Run with graceful shutdown
    let mut shutdown = shutdown_rx.clone();
    axum::serve(listener, app)
        .with_graceful_shutdown(async move {
            loop {
                shutdown.changed().await.ok();
                if *shutdown.borrow() {
                    break;
                }
            }
        })
        .await
        .unwrap();

    tracing::info!("Web server stopped");
}

/// Serve static files from embedded assets
async fn static_handler(uri: Uri) -> Response<axum::body::Body> {
    let path = uri.path().trim_start_matches('/');

    // Try exact path first
    if let Some(content) = Assets::get(path) {
        let mime = mime_guess::from_path(path).first_or_octet_stream();
        return Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, mime.as_ref())
            .body(axum::body::Body::from(content.data.to_vec()))
            .unwrap();
    }

    // For SPA: return index.html for non-API routes
    if let Some(content) = Assets::get("index.html") {
        return Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, "text/html")
            .body(axum::body::Body::from(content.data.to_vec()))
            .unwrap();
    }

    // Fallback placeholder if no UI built yet
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "text/html")
        .body(axum::body::Body::from(
            r#"<!DOCTYPE html>
<html>
<head>
    <title>Server Watcher</title>
    <style>
        body {
            font-family: system-ui;
            background: #1a1a2e;
            color: #eee;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
        }
        .container { text-align: center; }
        h1 { color: #0f0; }
        p { color: #888; }
        code { background: #333; padding: 2px 8px; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Server Watcher</h1>
        <p>Web UI not built yet. Run:</p>
        <p><code>cd web-ui && npm install && npm run build</code></p>
        <p style="margin-top: 2rem;">API is available at <code>/api/*</code></p>
    </div>
</body>
</html>"#,
        ))
        .unwrap()
}
