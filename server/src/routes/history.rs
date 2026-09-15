use axum::{Json, extract::State, response::IntoResponse};
use chrono::Months;
use sqlx::PgPool;

use crate::utils::{
    competitor::{HistoryContext, validate_request_constraints},
    http::AppError,
    simulation,
    types::{CompetitorHistoryStat, HistoryPoint, SimulationHistoryRequest},
};

const HISTORY_STEPS: u32 = 12;
const NUM_SIMULATIONS: u32 = 10_000;

pub async fn simulation_history_handler(
    State(pool): State<PgPool>,
    Json(payload): Json<SimulationHistoryRequest>,
) -> Result<impl IntoResponse, AppError> {
    validate_request_constraints(
        payload.competitor_ids.len(),
        payload.start_date,
        payload.end_date,
    )?;

    let fetch_start = HistoryContext::calculate_fetch_start(payload.start_date, HISTORY_STEPS);
    let ctx = HistoryContext::load(
        &pool,
        &payload.competitor_ids,
        &payload.event_id,
        fetch_start,
        payload.end_date,
        payload.half_life,
    )
    .await?;

    let include_dnf = payload.include_dnf.unwrap_or(false);

    let history_points = tokio::task::spawn_blocking(move || {
        (0..HISTORY_STEPS)
            .rev()
            .filter_map(|step| {
                let start = payload.start_date.checked_sub_months(Months::new(step))?;
                let end = payload.end_date.checked_sub_months(Months::new(step))?;
                Some((start, end))
            })
            .map(|(curr_start_date, curr_end_date)| {
                let competitors = ctx.build_competitors_for_window(curr_start_date, curr_end_date);

                let sim_results = simulation::run_simulations(
                    &competitors,
                    ctx.event_type,
                    include_dnf,
                    NUM_SIMULATIONS,
                    false,
                );

                let stats: Vec<CompetitorHistoryStat> = competitors
                    .into_iter()
                    .zip(sim_results)
                    .map(|(comp, res)| CompetitorHistoryStat {
                        sample_size: comp.stats.as_ref().map_or(0, |s| s.num_non_dnf_results),
                        id: comp.id,
                        name: comp.name,
                        country_iso2: comp.country_iso2,
                        win_chance: res.win_probability(),
                        pod_chance: res.podium_probability(),
                        expected_rank: res.expected_rank(),
                    })
                    .collect();

                HistoryPoint {
                    date: curr_end_date,
                    competitors: stats,
                }
            })
            .collect::<Vec<_>>()
    })
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?;

    Ok(Json(history_points).into_response())
}
