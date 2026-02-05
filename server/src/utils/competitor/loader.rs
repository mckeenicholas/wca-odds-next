use super::model::Competitor;
use crate::utils::database;
use crate::utils::http::AppError;
use crate::utils::wca::{EventType, clean_and_validate_wca_id};
use chrono::{Months, NaiveDate};
use sqlx::PgPool;
use std::collections::HashMap;

pub struct CompetitorContext {
    pub competitors: Vec<Competitor>,
    pub event_type: EventType,
}

impl CompetitorContext {
    pub async fn load(
        pool: &PgPool,
        competitor_ids: &[String],
        event_id: &str,
        start_date: NaiveDate,
        end_date: NaiveDate,
        half_life: f32,
    ) -> Result<Self, AppError> {
        let event_type = EventType::from_id(event_id)
            .ok_or_else(|| AppError::BadRequest(format!("Invalid event: {}", event_id)))?;

        let valid_ids = validate_competitor_ids(competitor_ids)?;

        let (result_rows, name_rows) = tokio::join!(
            database::fetch_competitor_results(pool, &valid_ids, event_id, start_date, end_date),
            database::fetch_competitor_names(pool, &valid_ids)
        );

        let results = result_rows?;
        let mut names_map: HashMap<String, String> = name_rows?.into_iter().collect();

        let grouped_by_date = database::group_results_by_date(results);
        let mut dated_results_map = database::convert_to_dated_results(grouped_by_date);

        let competitors: Vec<Competitor> = valid_ids
            .into_iter()
            .map(|id| {
                let name = names_map.remove(&id).unwrap_or_else(|| id.clone());
                let results = dated_results_map.remove(&id).unwrap_or_default();
                Competitor::new(name, id, results, half_life)
            })
            .collect();

        Ok(Self {
            competitors,
            event_type,
        })
    }

    pub fn with_manual_entries(mut self, entries: Vec<Vec<i32>>) -> Self {
        if !entries.is_empty() {
            for (comp, times) in self.competitors.iter_mut().zip(entries) {
                comp.entered_results = times;
            }
        }
        self
    }
}

pub struct HistoryContext {
    pub event_type: EventType,
    pub valid_ids: Vec<String>,
    pub names_map: HashMap<String, String>,
    pub grouped_results: HashMap<String, HashMap<NaiveDate, Vec<i32>>>,
    pub half_life: f32,
}

impl HistoryContext {
    pub async fn load(
        pool: &PgPool,
        competitor_ids: &[String],
        event_id: &str,
        fetch_start: NaiveDate,
        fetch_end: NaiveDate,
        half_life: f32,
    ) -> Result<Self, AppError> {
        let event_type = EventType::from_id(event_id)
            .ok_or_else(|| AppError::BadRequest(format!("Invalid event: {}", event_id)))?;

        let valid_ids = validate_competitor_ids(competitor_ids)?;

        let (result_rows, name_rows) = tokio::join!(
            database::fetch_competitor_results(pool, &valid_ids, event_id, fetch_start, fetch_end),
            database::fetch_competitor_names(pool, &valid_ids)
        );

        let results = result_rows?;
        let names_map: HashMap<String, String> = name_rows?.into_iter().collect();
        let grouped_results = database::group_results_by_date(results);

        Ok(Self {
            event_type,
            valid_ids,
            names_map,
            grouped_results,
            half_life,
        })
    }

    pub fn build_competitors_for_window(
        &self,
        window_start: NaiveDate,
        window_end: NaiveDate,
    ) -> Vec<Competitor> {
        self.valid_ids
            .iter()
            .map(|id| {
                let dated_results = self
                    .grouped_results
                    .get(id)
                    .map(|data| filter_and_convert_relative(data, window_start, window_end))
                    .unwrap_or_default();

                let name = self
                    .names_map
                    .get(id)
                    .cloned()
                    .unwrap_or_else(|| id.clone());

                Competitor::new(name, id.clone(), dated_results, self.half_life)
            })
            .collect()
    }

    pub fn calculate_fetch_start(start_date: NaiveDate, history_steps: u32) -> NaiveDate {
        // Add 2 extra months as safety buffer
        start_date
            .checked_sub_months(Months::new(history_steps + 2))
            .unwrap_or(start_date)
    }
}

pub fn validate_competitor_ids(ids: &[String]) -> Result<Vec<String>, AppError> {
    ids.iter()
        .map(|id| {
            clean_and_validate_wca_id(id)
                .ok_or_else(|| AppError::BadRequest(format!("Invalid ID: {}", id)))
        })
        .collect()
}

/// Validate common request constraints (competitor count, date range).
pub fn validate_request_constraints(
    competitor_count: usize,
    start_date: NaiveDate,
    end_date: NaiveDate,
) -> Result<(), AppError> {
    if competitor_count > 32 {
        return Err(AppError::BadRequest("Max 32 competitors".into()));
    }

    let window_days = (end_date - start_date).num_days();
    if window_days < 28 {
        return Err(AppError::BadRequest(
            "Date window too short (min 28 days)".into(),
        ));
    }

    Ok(())
}

use super::model::DatedCompetitionResult;

fn filter_and_convert_relative(
    raw_data: &HashMap<NaiveDate, Vec<i32>>,
    window_start: NaiveDate,
    window_end: NaiveDate,
) -> Vec<DatedCompetitionResult> {
    raw_data
        .iter()
        .filter(|(date, _)| **date >= window_start && **date <= window_end)
        .map(|(date, times)| {
            let days_since = (window_end - *date).num_days() as i32;
            DatedCompetitionResult {
                days_since,
                results: times.clone(),
            }
        })
        .collect()
}
