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
    let event_type = ctx.event_type;
    let competitors = ctx.competitors.clone();
    let response = tokio::task::spawn_blocking(move || {
        let results =
            simulation::run_simulations(&competitors, &event_type, include_dnf, SIMULATION_COUNT);

        simulation::format_results(competitors, results, matches!(event_type, EventType::Fmc))
    })
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?;

    Ok(Json(response).into_response())
}
