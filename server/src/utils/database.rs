use crate::utils::competitor::DatedCompetitionResult;
use chrono::{NaiveDate, Utc};
use sqlx::{FromRow, PgPool};
use std::collections::HashMap;

/// Database row for competitor results.
#[derive(Debug, FromRow)]
pub struct CompetitorRow {
    pub person_id: String,
    pub competition_date: NaiveDate,
    pub value: i32,
}

pub async fn fetch_competitor_results<T: AsRef<str>>(
    pool: &PgPool,
    competitor_ids: &[T],
    event_id: &str,
    start_date: NaiveDate,
    end_date: NaiveDate,
) -> Result<Vec<CompetitorRow>, sqlx::Error> {
    sqlx::query_as::<_, CompetitorRow>(
        r#"
        SELECT person_id, competition_date, value 
        FROM results 
        WHERE person_id = ANY($1) 
        AND event_id = $2
        AND competition_date BETWEEN $3 AND $4
        "#,
    )
    .bind(
        competitor_ids
            .iter()
            .map(|s| s.as_ref())
            .collect::<Vec<_>>(),
    )
    .bind(event_id)
    .bind(start_date)
    .bind(end_date)
    .fetch_all(pool)
    .await
}

pub async fn fetch_competitor_names<T: AsRef<str>>(
    pool: &PgPool,
    competitor_ids: &[T],
) -> Result<Vec<(String, String)>, sqlx::Error> {
    sqlx::query_as::<_, (String, String)>(
        r#"SELECT person_id, name from persons WHERE person_id = ANY($1)"#,
    )
    .bind(
        competitor_ids
            .iter()
            .map(|s| s.as_ref())
            .collect::<Vec<_>>(),
    )
    .fetch_all(pool)
    .await
}

pub fn group_results_by_date(
    rows: Vec<CompetitorRow>,
) -> HashMap<String, HashMap<NaiveDate, Vec<i32>>> {
    let mut temp_group: HashMap<String, HashMap<NaiveDate, Vec<i32>>> = HashMap::new();

    for row in rows {
        temp_group
            .entry(row.person_id)
            .or_default()
            .entry(row.competition_date)
            .or_default()
            .push(row.value);
    }

    temp_group
}

pub fn convert_to_dated_results(
    grouped: HashMap<String, HashMap<NaiveDate, Vec<i32>>>,
) -> HashMap<String, Vec<DatedCompetitionResult>> {
    let today = Utc::now().date_naive();

    let raw_data: HashMap<String, Vec<DatedCompetitionResult>> = grouped
        .into_iter()
        .map(|(name, dates)| {
            let results = dates
                .into_iter()
                .map(|(date, times)| {
                    let days_since = (today - date).num_days() as i32;
                    DatedCompetitionResult {
                        days_since,
                        results: times,
                    }
                })
                .collect();
            (name, results)
        })
        .collect();

    raw_data
}
