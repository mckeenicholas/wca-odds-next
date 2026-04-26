use axum::{Json, extract::State, response::IntoResponse};
use sqlx::PgPool;

use crate::utils::competitor::validate_date_range;
use crate::utils::database;
use crate::utils::http::AppError;
use crate::utils::types::{RankingHistoryRequest, RankingRequest};
use crate::utils::wca::EventType;

const MAX_WINDOW_DAYS: i64 = 31 * 12 * 5; // ~5 years
const TOP_N: i32 = 32;

pub async fn rankings_handler(
    State(pool): State<PgPool>,
    Json(payload): Json<RankingRequest>,
) -> Result<impl IntoResponse, AppError> {
    let db_event_id = match payload.event_id.as_str() {
        "all" | "kinch" | "kinch_strict" => payload.event_id.as_str(),
        other => {
            EventType::from_id(other)
                .ok_or_else(|| AppError::BadRequest(format!("Invalid event: \"{}\"", other)))?;
            other
        }
    };

    let results = database::fetch_ranks_by_date(&pool, db_event_id, TOP_N, payload.date).await?;

    Ok(Json(results).into_response())
}

pub async fn competitor_rankings_history_handler(
    State(pool): State<PgPool>,
    Json(payload): Json<RankingHistoryRequest>,
) -> Result<impl IntoResponse, AppError> {
    validate_date_range(
        payload.start_date,
        payload.end_date,
        Some(28),
        Some(MAX_WINDOW_DAYS),
    )?;

    let db_event_id = match payload.event_id.as_str() {
        "all" | "kinch" | "kinch_strict" => payload.event_id.as_str(),
        other => {
            EventType::from_id(other)
                .ok_or_else(|| AppError::BadRequest(format!("Invalid event: \"{}\"", other)))?;
            other
        }
    };

    let rows = database::fetch_competitor_ranking_history(
        &pool,
        &payload.competitor_id,
        db_event_id,
        payload.start_date,
        payload.end_date,
    )
    .await?;

    Ok(Json(rows).into_response())
}
