use std::collections::HashMap;

use chrono::{Months, NaiveDate};
use sqlx::PgPool;

use super::model::{Competitor, DatedCompetitionResult};
use crate::utils::{
    database,
    http::AppError,
    wca::{EventType, clean_and_validate_wca_id},
};

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
        let mut names_map: HashMap<String, (String, String)> = name_rows?
            .into_iter()
            .map(|(id, name, iso2)| (id, (name, iso2)))
            .collect();

        let grouped_by_date = database::group_results_by_date(results);
        let mut dated_results_map = database::convert_to_dated_results(grouped_by_date, end_date);

        let competitors: Vec<Competitor> = valid_ids
            .into_iter()
            .map(|id| {
                let (name, country_iso2) = names_map
                    .remove(&id)
                    .unwrap_or_else(|| (id.clone(), String::new()));
                let results = dated_results_map.remove(&id).unwrap_or_default();
                Competitor::new(name, id, country_iso2, results, half_life)
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
    pub names_map: HashMap<String, (String, String)>,
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
        let names_map: HashMap<String, (String, String)> = name_rows?
            .into_iter()
            .map(|(id, name, iso2)| (id, (name, iso2)))
            .collect();
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

                let (name, country_iso2) = self
                    .names_map
                    .get(id)
                    .cloned()
                    .unwrap_or_else(|| (id.clone(), String::new()));

                Competitor::new(
                    name,
                    id.clone(),
                    country_iso2,
                    dated_results,
                    self.half_life,
                )
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

    validate_date_range(start_date, end_date, Some(28), None)
}

pub fn validate_date_range(
    start_date: NaiveDate,
    end_date: NaiveDate,
    min_days: Option<i64>,
    max_days: Option<i64>,
) -> Result<(), AppError> {
    let window_days = (end_date - start_date).num_days();

    if let Some(min) = min_days
        && window_days < min
    {
        return Err(AppError::BadRequest(format!(
            "Date window too short (min {min} days)"
        )));
    }

    if let Some(max) = max_days
        && window_days > max
    {
        return Err(AppError::BadRequest(format!(
            "Date window too long (max {max} days)"
        )));
    }

    Ok(())
}

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_competitor_ids() {
        let valid = vec!["2015MCKE02".to_string(), "1982THAI01".to_string()];
        let res = validate_competitor_ids(&valid);
        assert!(res.is_ok());
        assert_eq!(res.unwrap(), vec!["2015MCKE02", "1982THAI01"]);

        let invalid = vec!["2015MCKE02".to_string(), "INVALID".to_string()];
        assert!(validate_competitor_ids(&invalid).is_err());
    }

    #[test]
    fn test_validate_request_constraints() {
        let start = NaiveDate::from_ymd_opt(2025, 1, 1).unwrap();
        let end = NaiveDate::from_ymd_opt(2025, 3, 1).unwrap();

        // Valid count (<= 32) and valid date range (>= 28 days)
        assert!(validate_request_constraints(10, start, end).is_ok());
        assert!(validate_request_constraints(32, start, end).is_ok());

        // Invalid: > 32 competitors
        assert!(validate_request_constraints(33, start, end).is_err());

        // Invalid: date range too short (< 28 days)
        let short_end = NaiveDate::from_ymd_opt(2025, 1, 10).unwrap();
        assert!(validate_request_constraints(10, start, short_end).is_err());
    }

    #[test]
    fn test_validate_date_range() {
        let start = NaiveDate::from_ymd_opt(2025, 1, 1).unwrap();
        let end = NaiveDate::from_ymd_opt(2025, 1, 31).unwrap(); // 30 days

        assert!(validate_date_range(start, end, Some(28), Some(60)).is_ok());
        assert!(validate_date_range(start, end, Some(35), None).is_err());
        assert!(validate_date_range(start, end, None, Some(20)).is_err());
    }

    #[test]
    fn test_calculate_fetch_start() {
        let start = NaiveDate::from_ymd_opt(2025, 6, 15).unwrap();
        // 12 steps + 2 buffer = 14 months prior -> 2024-04-15
        let fetch_start = HistoryContext::calculate_fetch_start(start, 12);
        assert_eq!(fetch_start, NaiveDate::from_ymd_opt(2024, 4, 15).unwrap());
    }

    #[test]
    fn test_filter_and_convert_relative() {
        let mut raw_data = HashMap::new();
        let d1 = NaiveDate::from_ymd_opt(2025, 1, 10).unwrap();
        let d2 = NaiveDate::from_ymd_opt(2025, 2, 10).unwrap();
        let d3 = NaiveDate::from_ymd_opt(2025, 3, 10).unwrap();

        raw_data.insert(d1, vec![1000, 1100]);
        raw_data.insert(d2, vec![900, 950]);
        raw_data.insert(d3, vec![800]);

        let window_start = NaiveDate::from_ymd_opt(2025, 2, 1).unwrap();
        let window_end = NaiveDate::from_ymd_opt(2025, 2, 28).unwrap();

        let filtered = filter_and_convert_relative(&raw_data, window_start, window_end);
        // Only d2 should be included (2025-02-10)
        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].results, vec![900, 950]);
        // days_since: 2025-02-28 - 2025-02-10 = 18 days
        assert_eq!(filtered[0].days_since, 18);
    }

    #[test]
    fn test_with_manual_entries() {
        let comp1 = Competitor::new(
            "P1".to_string(),
            "2020P101".to_string(),
            "US".to_string(),
            vec![],
            30.0,
        );
        let comp2 = Competitor::new(
            "P2".to_string(),
            "2020P201".to_string(),
            "CA".to_string(),
            vec![],
            30.0,
        );

        let ctx = CompetitorContext {
            competitors: vec![comp1, comp2],
            event_type: EventType::Ao5,
        };

        let manual = vec![vec![1000, 1100], vec![900]];
        let updated = ctx.with_manual_entries(manual);

        assert_eq!(updated.competitors[0].entered_results, vec![1000, 1100]);
        assert_eq!(updated.competitors[1].entered_results, vec![900]);
    }
}
