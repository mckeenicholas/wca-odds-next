use axum::{Json, extract::State, http::StatusCode, response::IntoResponse};
use chrono::Days;
use sqlx::PgPool;
use std::collections::HashMap;

use crate::utils::competitor::Competitor;
use crate::utils::database;
use crate::utils::simulation;
use crate::utils::types::{EventType, SimulationRequest};
use crate::utils::validation::clean_and_validate_wca_id;

const SIMULATION_COUNT: u32 = 100_000; // Seems to run pretty fast for now, can tune down if needed

pub async fn simulation_handler(
    State(pool): State<PgPool>,
    Json(payload): Json<SimulationRequest>,
) -> impl IntoResponse {
    if payload.competitor_ids.len() > 32 {
        return (StatusCode::BAD_REQUEST, "Max 32 competitors").into_response();
    }

    let is_too_short = payload
        .start_date
        .checked_add_days(Days::new(28))
        .is_none_or(|min_end_date| min_end_date > payload.end_date);

    if is_too_short {
        return (
            StatusCode::BAD_REQUEST,
            "Start date must be at least 28 days before end date (or dates are invalid)",
        )
            .into_response();
    }

    let event_id = payload.event_id.to_lowercase();

    let event_type = match EventType::from_id(&event_id) {
        Some(e) => e,
        None => {
            return (
                StatusCode::BAD_REQUEST,
                format!("Invalid event ID: {}.", payload.event_id),
            )
                .into_response();
        }
    };

    let competitor_ids_upper: Vec<String> = match payload
        .competitor_ids
        .iter()
        .map(|id| clean_and_validate_wca_id(id).ok_or_else(|| id.clone()))
        .collect::<Result<Vec<String>, String>>()
    {
        Ok(ids) => ids,
        Err(invalid_id) => {
            let error_msg = format!("Invalid competitor ID: {}", invalid_id);
            return (StatusCode::BAD_REQUEST, error_msg).into_response();
        }
    };

    let (result_rows, name_rows) = tokio::join!(
        database::fetch_competitor_results(
            &pool,
            &competitor_ids_upper,
            &payload.event_id,
            payload.start_date,
            payload.end_date
        ),
        database::fetch_competitor_names(&pool, &competitor_ids_upper)
    );

    let (results, mut names_map) = match (result_rows, name_rows) {
        (Ok(r), Ok(n)) => {
            let map: HashMap<String, String> = n.into_iter().collect();
            (r, map)
        }
        (Err(e), _) => {
            eprintln!("DB Error (results): {}", e);
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
        (_, Err(e)) => {
            eprintln!("DB Error (names): {}", e);
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    };

    let grouped = database::group_results_by_date(results);
    let mut raw_data = database::convert_to_dated_results(grouped);

    let mut competitors: Vec<Competitor> = Vec::new();
    for (i, id) in competitor_ids_upper.iter().enumerate() {
        let results = raw_data.remove(id).unwrap_or_default();

        let competitor_name = match names_map.remove(id) {
            Some(n) => n,
            None => {
                eprintln!("DB fetch missing competitor with id: {}.", id);
                return StatusCode::INTERNAL_SERVER_ERROR.into_response();
            }
        };

        let mut comp = Competitor::new(competitor_name, id.clone(), results, payload.half_life);

        if let Some(entered) = &payload.entered_times
            && let Some(times) = entered.get(i)
        {
            comp.entered_results = times.clone();
        }

        competitors.push(comp);
    }

    let include_dnf = payload.include_dnf.unwrap_or(false);
    let results =
        simulation::run_simulations(&competitors, &event_type, include_dnf, SIMULATION_COUNT);

    let response_data =
        simulation::format_results(competitors, results, matches!(event_type, EventType::Fmc));
    Json(response_data).into_response()
}
