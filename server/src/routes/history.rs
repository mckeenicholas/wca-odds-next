use axum::{Json, extract::State, response::IntoResponse};
use chrono::Months;
use sqlx::PgPool;

use crate::utils::competitor::{HistoryContext, validate_request_constraints};
use crate::utils::http::AppError;
use crate::utils::simulation;
use crate::utils::types::{CompetitorHistoryStat, HistoryPoint, SimulationHistoryRequest};

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
    let mut history_points = Vec::with_capacity(HISTORY_STEPS as usize);

    let mut curr_end_date = payload.end_date;
    let mut curr_start_date = payload.start_date;

    for _ in 0..HISTORY_STEPS {
        let competitors = ctx.build_competitors_for_window(curr_start_date, curr_end_date);

        let sim_results = simulation::run_simulations(
            &competitors,
            &ctx.event_type,
            include_dnf,
            NUM_SIMULATIONS,
        );

        let stats: Vec<CompetitorHistoryStat> = competitors
            .iter()
            .zip(sim_results)
            .map(|(comp, res)| CompetitorHistoryStat {
                id: comp.id.clone(),
                name: comp.name.clone(),
                win_chance: res.win_probability(),
                pod_chance: res.podium_probability(),
                expected_rank: res.expected_rank(),
                sample_size: comp
                    .stats
                    .as_ref()
                    .map(|s| s.num_non_dnf_results)
                    .unwrap_or(0),
            })
            .collect();

        history_points.push(HistoryPoint {
            date: curr_end_date,
            competitors: stats,
        });

        match (
            curr_end_date.checked_sub_months(Months::new(1)),
            curr_start_date.checked_sub_months(Months::new(1)),
        ) {
            (Some(ne), Some(ns)) => {
                curr_end_date = ne;
                curr_start_date = ns;
            }
            _ => break,
        }
    }

    history_points.reverse();
    Ok(Json(history_points).into_response())
}
