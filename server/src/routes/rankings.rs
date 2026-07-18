use axum::Json;
use axum::extract::State;
use axum::response::IntoResponse;
use serde::Serialize;
use sqlx::PgPool;

use crate::utils::competitor::validate_date_range;
use crate::utils::database::{self, CountryFilter};
use crate::utils::http::AppError;
use crate::utils::types::{RankingHistoryRequest, RankingRequest};
use crate::utils::wca::EventType;

const MAX_WINDOW_DAYS: i64 = 31 * 12 * 5; // ~5 years
const PAGE_SIZE: i32 = 32;
const MAX_ITEMS: i32 = 512;

#[derive(Serialize)]
pub struct ValueDelta<T> {
    pub current: T,
    pub change: Option<T>,
}

#[derive(Serialize)]
pub struct SubRank {
    pub rank: i32,
    pub rank_change: Option<i32>,
}

#[derive(Serialize)]
pub struct RankingSnapshotResponse {
    pub person_id: String,
    pub name: String,
    pub country_iso2: String,
    pub global_rank: ValueDelta<i32>,
    pub score: ValueDelta<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sub_rank: Option<SubRank>,
}

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

    let rows = database::fetch_ranks_by_date(
        &pool,
        db_event_id,
        limit,
        offset,
        payload.date,
        country_filter.as_ref(),
    )
    .await?;

    let has_filter = country_filter.is_some();

    let results: Vec<RankingSnapshotResponse> = rows
        .into_iter()
        .enumerate()
        .map(|(i, row)| {
            let rank_change = row.prev_rank.map(|prev| prev - row.rank);
            let score_change = row.prev_value.map(|prev| row.value - prev);

            RankingSnapshotResponse {
                person_id: row.person_id,
                name: row.name,
                country_iso2: row.country_iso2,
                global_rank: ValueDelta {
                    current: row.rank,
                    change: rank_change,
                },
                score: ValueDelta {
                    current: row.value,
                    change: score_change,
                },
                sub_rank: if has_filter {
                    let current_sub = offset + i as i32 + 1;
                    Some(SubRank {
                        rank: current_sub,
                        rank_change: row.prev_sub_rank.map(|prev| prev - current_sub),
                    })
                } else {
                    None
                },
            }
        })
        .collect();

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
