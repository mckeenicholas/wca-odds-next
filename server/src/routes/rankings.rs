use axum::{Json, extract::State, response::IntoResponse};
use sqlx::PgPool;

use crate::utils::competitor::validate_date_range;
use crate::utils::database::{self, CountryFilter};
use crate::utils::http::AppError;
use crate::utils::types::{RankingHistoryRequest, RankingRequest};
use crate::utils::wca::EventType;

const MAX_WINDOW_DAYS: i64 = 31 * 12 * 5; // ~5 years
const PAGE_SIZE: i32 = 32;
const MAX_ITEMS: i32 = 512;

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

    let offset = payload.offset.unwrap_or(0).max(0);
    if offset >= MAX_ITEMS {
        return Ok(Json(Vec::<database::RankingSnapshotRow>::new()).into_response());
    }
    let limit = PAGE_SIZE.min(MAX_ITEMS - offset);

    let country_filter = payload.country_id.as_deref().and_then(|id| {
        if id.is_empty() || id == "World" {
            None
        } else if id.starts_with('_') {
            Some(CountryFilter::Continent(id.to_string()))
        } else {
            Some(CountryFilter::Country(id.to_string()))
        }
    });

    let results = database::fetch_ranks_by_date(
        &pool,
        db_event_id,
        limit,
        offset,
        payload.date,
        country_filter.as_ref(),
    )
    .await?;

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
