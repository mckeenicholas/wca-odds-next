use axum::{Json, extract::State, response::IntoResponse};
use sqlx::PgPool;

use crate::utils::competitor::{CompetitorContext, validate_request_constraints};
use crate::utils::http::AppError;
use crate::utils::simulation;
use crate::utils::types::SimulationRequest;
use crate::utils::wca::EventType;

const SIMULATION_COUNT: u32 = 100_000;

pub async fn simulation_handler(
    State(pool): State<PgPool>,
    Json(payload): Json<SimulationRequest>,
) -> Result<impl IntoResponse, AppError> {
    validate_request_constraints(
        payload.competitor_ids.len(),
        payload.start_date,
        payload.end_date,
    )?;

    let mut ctx = CompetitorContext::load(
        &pool,
        &payload.competitor_ids,
        &payload.event_id,
        payload.start_date,
        payload.end_date,
        payload.half_life,
    )
    .await?;

    if let Some(entries) = payload.entered_times {
        ctx = ctx.with_manual_entries(entries);
    }

    let include_dnf = payload.include_dnf.unwrap_or(false);
    let results = simulation::run_simulations(
        &ctx.competitors,
        &ctx.event_type,
        include_dnf,
        SIMULATION_COUNT,
    );

    let response = simulation::format_results(
        ctx.competitors,
        results,
        matches!(ctx.event_type, EventType::Fmc),
    );
    Ok(Json(response).into_response())
}
