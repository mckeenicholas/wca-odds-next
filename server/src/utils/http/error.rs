use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde_json::json;

#[derive(Debug)]
pub enum AppError {
    BadRequest(String),
    Database(sqlx::Error),
    Internal(String),
}

impl From<sqlx::Error> for AppError {
    fn from(inner: sqlx::Error) -> Self {
        AppError::Database(inner)
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_message) = match self {
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg),
            AppError::Database(e) => {
                eprintln!("Database error: {}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Internal Server Error".to_string(),
                )
            }
            AppError::Internal(e) => {
                eprintln!("Internal error: {}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Internal Server Error".to_string(),
                )
            }
        };

        (status, Json(json!({ "error": error_message }))).into_response()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use http_body_util::BodyExt;

    #[tokio::test]
    async fn test_bad_request_response() {
        let err = AppError::BadRequest("Test error message".to_string());
        let res = err.into_response();

        assert_eq!(res.status(), StatusCode::BAD_REQUEST);

        let body_bytes = res.into_body().collect().await.unwrap().to_bytes();
        let json_val: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();
        assert_eq!(json_val["error"], "Test error message");
    }

    #[tokio::test]
    async fn test_internal_error_response() {
        let err = AppError::Internal("Sensitive internal failure details".to_string());
        let res = err.into_response();

        assert_eq!(res.status(), StatusCode::INTERNAL_SERVER_ERROR);

        let body_bytes = res.into_body().collect().await.unwrap().to_bytes();
        let json_val: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();
        assert_eq!(json_val["error"], "Internal Server Error");
    }

    #[tokio::test]
    async fn test_database_error_response() {
        let err: AppError = sqlx::Error::RowNotFound.into();
        let res = err.into_response();

        assert_eq!(res.status(), StatusCode::INTERNAL_SERVER_ERROR);

        let body_bytes = res.into_body().collect().await.unwrap().to_bytes();
        let json_val: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();
        assert_eq!(json_val["error"], "Internal Server Error");
    }
}
