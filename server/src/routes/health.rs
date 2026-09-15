use axum::{extract::State, http::StatusCode};
use serde::Serialize;
use sqlx::PgPool;

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub database: String,
}

pub async fn health_check(State(pool): State<PgPool>) -> (StatusCode, axum::Json<HealthResponse>) {
    match sqlx::query("SELECT 1").execute(&pool).await {
        Ok(_) => (
            StatusCode::OK,
            axum::Json(HealthResponse {
                status: "healthy".to_string(),
                database: "connected".to_string(),
            }),
        ),
        Err(e) => {
            eprintln!("Health check database ping failed: {e}");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                axum::Json(HealthResponse {
                    status: "unhealthy".to_string(),
                    database: "disconnected".to_string(),
                }),
            )
        }
    }
}
