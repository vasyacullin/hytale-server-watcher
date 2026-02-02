use axum::{
    extract::Request,
    http::StatusCode,
    middleware::Next,
    response::Response,
};

/// Extract token from Authorization header or query param
pub fn extract_token(request: &Request) -> Option<String> {
    // Try Authorization header first
    if let Some(auth_header) = request.headers().get("Authorization") {
        if let Ok(auth_str) = auth_header.to_str() {
            if let Some(token) = auth_str.strip_prefix("Bearer ") {
                return Some(token.to_string());
            }
        }
    }

    // Try query param
    if let Some(query) = request.uri().query() {
        for pair in query.split('&') {
            if let Some(token) = pair.strip_prefix("token=") {
                return Some(token.to_string());
            }
        }
    }

    None
}

/// Auth middleware
pub async fn auth_middleware(
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // Get expected token from extensions (set by server)
    let expected_token = request
        .extensions()
        .get::<Option<String>>()
        .cloned()
        .flatten();

    // If no token configured, allow all
    if expected_token.is_none() {
        return Ok(next.run(request).await);
    }

    let expected = expected_token.unwrap();
    let provided = extract_token(&request);

    match provided {
        Some(token) if token == expected => Ok(next.run(request).await),
        _ => Err(StatusCode::UNAUTHORIZED),
    }
}

/// Check if token is valid (for manual checks)
pub fn validate_token(provided: Option<&str>, expected: Option<&str>) -> bool {
    match (provided, expected) {
        (_, None) => true, // No auth required
        (Some(p), Some(e)) => p == e,
        (None, Some(_)) => false,
    }
}
