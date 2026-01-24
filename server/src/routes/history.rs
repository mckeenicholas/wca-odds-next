use axum::{Json, extract::State, http::StatusCode, response::IntoResponse};
use chrono::{Months, NaiveDate};
use sqlx::PgPool;
use std::collections::HashMap;

use crate::utils::competitor::Competitor;
use crate::utils::database;
use crate::utils::simulation;
use crate::utils::types::{
    CompetitorHistoryStat, DatedCompetitionResult, EventType, HistoryPoint,
    SimulationHistoryRequest, SimulationHistoryResponse,
};
use crate::utils::validation::clean_and_validate_wca_id;

// --- CONFIGURATION CONSTANTS ---
// How many data points to generate (e.g., 12 = 1 year of history, 24 = 2 years)
const HISTORY_STEPS: u32 = 12;
// Number of simulations per point (Lower is faster)
const NUM_SIMULATIONS: u32 = 5_000;

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

    // 2. Determine Data Fetching Range
    // The "Latest" window ends at payload.end_date.
    // The "Oldest" window ends at payload.end_date - HISTORY_STEPS months.
    // The "Oldest" window starts at (Oldest End) - window_duration.
    // Therefore, we need to fetch data starting from roughly:
    // payload.start_date - HISTORY_STEPS months.

    // We add a small safety buffer (e.g., 2 extra months) to ensure we don't miss data on boundaries.
    let fetch_start_limit = payload
        .start_date
        .checked_sub_months(Months::new(HISTORY_STEPS + 2))
        .unwrap_or(payload.start_date);

    // --- Data Fetching ---
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

    // Group raw rows by Person -> Date -> Values
    let grouped_raw = database::group_results_by_date(all_results);

    // 3. Run History Loop (in blocking task to prevent server stall)
    let history_response = tokio::task::spawn_blocking(move || {
        let mut history_points = Vec::with_capacity(HISTORY_STEPS as usize);

        // Start from the user's requested end date
        let mut curr_end_date = payload.end_date;
        let mut curr_start_date = payload.start_date;

        for _ in 0..HISTORY_STEPS {
            // --- A. Prepare Competitors for this specific point in time ---
            let mut competitors: Vec<Competitor> = Vec::new();

            for id in &competitor_ids_upper {
                let raw_competitor_data = grouped_raw.get(id);

                // Filter results to fit in [curr_start, curr_end]
                // AND convert 'days_since' relative to 'curr_end_date'
                let dated_results = if let Some(data) = raw_competitor_data {
                    filter_and_convert_relative(data, curr_start_date, curr_end_date)
                } else {
                    Vec::new()
                };

                let name = names_map.get(id).cloned().unwrap_or_else(|| id.clone());

                // Create competitor
                let comp = Competitor::new(name, id.clone(), dated_results, payload.half_life);
                competitors.push(comp);
            }

            // --- B. Run Simulation ---
            let include_dnf = payload.include_dnf.unwrap_or(false);
            // Ensure run_simulations accepts the count param, or update this call
            let sim_results = simulation::run_simulations(
                &competitors,
                &event_type,
                include_dnf,
                NUM_SIMULATIONS,
            );

            // --- C. Extract Stats ---
            let stats: Vec<CompetitorHistoryStat> = competitors
                .iter()
                .enumerate()
                .map(|(i, comp)| CompetitorHistoryStat {
                    id: comp.id.clone(),
                    name: comp.name.clone(),
                    win_count: sim_results.win_counts[i],
                    pod_count: sim_results.pod_counts[i],
                    total_rank: sim_results.total_ranks[i],
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

            // --- D. Shift Window Backwards (1 Month) ---
            let next_end = curr_end_date.checked_sub_months(Months::new(1));
            let next_start = curr_start_date.checked_sub_months(Months::new(1));

            match (next_end, next_start) {
                (Some(ne), Some(ns)) => {
                    curr_end_date = ne;
                    curr_start_date = ns;
                }
                _ => break, // Stop if dates underflow (very unlikely with modern dates)
            }
        }

        // REVERSE: Output Oldest -> Newest
        history_points.reverse();

        SimulationHistoryResponse {
            history: history_points,
        }
    })
    .await;

    // Handle JoinHandle errors
    match history_response {
        Ok(response) => Json(response).into_response(),
        Err(e) => {
            eprintln!("Simulation task join error: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

/// Helper to filter raw dates to a window and calculate days_since relative to the end of that window
fn filter_and_convert_relative(
    raw_data: &HashMap<NaiveDate, Vec<i32>>,
    window_start: NaiveDate,
    window_end: NaiveDate,
) -> Vec<DatedCompetitionResult> {
    let mut results = Vec::new();

    for (date, times) in raw_data {
        // 1. Filter: Must be within the current window
        if *date >= window_start && *date <= window_end {
            // 2. Relative Time: Days since the 'window_end' (the simulation date)
            let days_since = (window_end - *date).num_days() as i32;

            results.push(DatedCompetitionResult {
                days_since,
                results: times.clone(),
            });
        }
    }

    results
}
