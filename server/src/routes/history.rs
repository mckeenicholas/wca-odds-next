use axum::{Json, extract::State, http::StatusCode, response::IntoResponse};
use chrono::{Months, NaiveDate};
use sqlx::PgPool;
use std::collections::HashMap;

use crate::utils::competitor::Competitor;
use crate::utils::database;
use crate::utils::simulation;
use crate::utils::types::{
    CompetitorHistoryStat, DatedCompetitionResult, EventType, HistoryPoint,
    SimulationHistoryRequest,
};
use crate::utils::validation::clean_and_validate_wca_id;

const HISTORY_STEPS: u32 = 12;
const NUM_SIMULATIONS: u32 = 10_000;

pub async fn simulation_history_handler(
    State(pool): State<PgPool>,
    Json(payload): Json<SimulationHistoryRequest>,
) -> impl IntoResponse {
    // 1. Validation
    if payload.competitor_ids.len() > 32 {
        return (StatusCode::BAD_REQUEST, "Max 32 competitors").into_response();
    }

    // Check window validity
    let window_duration_days = (payload.end_date - payload.start_date).num_days();
    if window_duration_days < 28 {
        return (StatusCode::BAD_REQUEST, "Window too short (min 28 days)").into_response();
    }

    let competitor_ids_upper: Vec<String> = match payload
        .competitor_ids
        .iter()
        .map(|id| clean_and_validate_wca_id(id).ok_or_else(|| id.clone()))
        .collect::<Result<Vec<String>, String>>()
    {
        Ok(ids) => ids,
        Err(invalid_id) => {
            return (
                StatusCode::BAD_REQUEST,
                format!("Invalid competitor ID: {}", invalid_id),
            )
                .into_response();
        }
    };

    let event_type = match EventType::from_id(&payload.event_id) {
        Some(e) => e,
        None => {
            return (
                StatusCode::BAD_REQUEST,
                format!("Invalid event ID: {}.", payload.event_id),
            )
                .into_response();
        }
    };

    // We add a small safety buffer (2 extra months) to ensure we don't miss data on boundaries.
    let fetch_start_limit = payload
        .start_date
        .checked_sub_months(Months::new(HISTORY_STEPS + 2))
        .unwrap_or(payload.start_date);

    let (result_rows, name_rows) = tokio::join!(
        database::fetch_competitor_results(
            &pool,
            &competitor_ids_upper,
            &payload.event_id,
            fetch_start_limit,
            payload.end_date
        ),
        database::fetch_competitor_names(&pool, &competitor_ids_upper)
    );

    let (all_results, names_map) = match (result_rows, name_rows) {
        (Ok(r), Ok(n)) => (r, n.into_iter().collect::<HashMap<String, String>>()),
        (Err(e), _) => {
            eprintln!("DB Error (results): {}", e);
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
        (_, Err(e)) => {
            eprintln!("DB Error (names): {}", e);
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    };

    let grouped_raw = database::group_results_by_date(all_results);

    let mut history_points = Vec::with_capacity(HISTORY_STEPS as usize);

    let mut curr_end_date = payload.end_date;
    let mut curr_start_date = payload.start_date;

    for _ in 0..HISTORY_STEPS {
        let mut competitors: Vec<Competitor> = Vec::new();

        for id in &competitor_ids_upper {
            let raw_competitor_data = grouped_raw.get(id);

            let dated_results = if let Some(data) = raw_competitor_data {
                filter_and_convert_relative(data, curr_start_date, curr_end_date)
            } else {
                Vec::new()
            };

            let name = names_map.get(id).cloned().unwrap_or_else(|| id.clone());

            let comp = Competitor::new(name, id.clone(), dated_results, payload.half_life);
            competitors.push(comp);
        }

        let include_dnf = payload.include_dnf.unwrap_or(false);
        let sim_results =
            simulation::run_simulations(&competitors, &event_type, include_dnf, NUM_SIMULATIONS);

        let stats: Vec<CompetitorHistoryStat> = competitors
            .iter()
            .enumerate()
            .map(|(i, comp)| CompetitorHistoryStat {
                id: comp.id.clone(),
                name: comp.name.clone(),
                win_chance: sim_results.win_chance[i],
                pod_chance: sim_results.pod_chance[i],
                expected_rank: sim_results.expected_ranks[i],
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

        let next_end = curr_end_date.checked_sub_months(Months::new(1));
        let next_start = curr_start_date.checked_sub_months(Months::new(1));

        match (next_end, next_start) {
            (Some(ne), Some(ns)) => {
                curr_end_date = ne;
                curr_start_date = ns;
            }
            _ => break,
        }
    }

    // Order by oldest to newest
    history_points.reverse();

    Json(history_points).into_response()
}

fn filter_and_convert_relative(
    raw_data: &HashMap<NaiveDate, Vec<i32>>,
    window_start: NaiveDate,
    window_end: NaiveDate,
) -> Vec<DatedCompetitionResult> {
    let mut results = Vec::new();

    for (date, times) in raw_data {
        if *date >= window_start && *date <= window_end {
            let days_since = (window_end - *date).num_days() as i32;

            results.push(DatedCompetitionResult {
                days_since,
                results: times.clone(),
            });
        }
    }

    results
}
