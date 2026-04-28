use crate::utils::competitor::DatedCompetitionResult;
use chrono::{NaiveDate, Utc};
use serde::Serialize;
use sqlx::{FromRow, PgPool, Postgres, QueryBuilder};
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
) -> Result<Vec<(String, String, String)>, sqlx::Error> {
    sqlx::query_as::<_, (String, String, String)>(
        r#"
        SELECT p.person_id, p.name, COALESCE(c.iso2, '') AS country_iso2
        FROM persons p
        LEFT JOIN countries c ON c.id = p.country_id
        WHERE p.person_id = ANY($1)
        "#,
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

/// Database row for ranking snapshots.
#[derive(Debug, FromRow, Serialize)]
pub struct RankingSnapshotRow {
    pub person_id: String,
    pub name: String,
    pub country_iso2: String,
    pub value: f32,
    pub rank: i32,
}

pub enum CountryFilter {
    Country(String),   // filter by persons.country_id
    Continent(String), // filter by countries.continent_id
}

pub async fn fetch_ranks_by_date(
    pool: &PgPool,
    event_id: &str,
    limit: i32,
    offset: i32,
    date: Option<NaiveDate>,
    country_filter: Option<&CountryFilter>,
) -> Result<Vec<RankingSnapshotRow>, sqlx::Error> {
    let mut qb: QueryBuilder<Postgres> = QueryBuilder::new(
        r#"SELECT rs.person_id, p.name, COALESCE(c.iso2, '') AS country_iso2, rs.value, rs.rank
        FROM ranking_snapshots rs
        JOIN persons p ON p.person_id = rs.person_id
        LEFT JOIN countries c ON c.id = p.country_id
        WHERE rs.event_id = "#,
    );
    qb.push_bind(event_id);
    qb.push(
        r#" AND rs.snapshot_date = (
            SELECT snapshot_date FROM ranking_snapshots
            WHERE snapshot_date <= COALESCE("#,
    );
    qb.push_bind(date);
    qb.push(", CURRENT_DATE) ORDER BY snapshot_date DESC LIMIT 1)");

    match country_filter {
        Some(CountryFilter::Country(id)) => {
            qb.push(" AND p.country_id = ");
            qb.push_bind(id.as_str());
        }
        Some(CountryFilter::Continent(id)) => {
            qb.push(" AND c.continent_id = ");
            qb.push_bind(id.as_str());
        }
        None => {}
    }

    qb.push(" ORDER BY rs.rank LIMIT ");
    qb.push_bind(limit);
    qb.push(" OFFSET ");
    qb.push_bind(offset);

    qb.build_query_as::<RankingSnapshotRow>()
        .fetch_all(pool)
        .await
}

#[derive(Debug, FromRow, Serialize)]
pub struct RankingSnapshotHistoryRow {
    pub snapshot_date: NaiveDate,
    pub value: f32,
    pub rank: i32,
}

pub async fn fetch_competitor_ranking_history(
    pool: &PgPool,
    competitor_id: &str,
    event_id: &str,
    start_date: NaiveDate,
    end_date: NaiveDate,
) -> Result<Vec<RankingSnapshotHistoryRow>, sqlx::Error> {
    sqlx::query_as::<_, RankingSnapshotHistoryRow>(
        r#"
        SELECT rs.snapshot_date, rs.value, rs.rank
        FROM ranking_snapshots rs
        JOIN persons p ON p.person_id = rs.person_id
        WHERE rs.event_id = $1
          AND rs.snapshot_date BETWEEN $2 AND $3
          AND rs.person_id = $4
        ORDER BY rs.snapshot_date
        "#,
    )
    .bind(event_id)
    .bind(start_date)
    .bind(end_date)
    .bind(competitor_id)
    .fetch_all(pool)
    .await
}

pub async fn fetch_competitor_rank_info(
    pool: &PgPool,
    competitor_id: &str,
    date: Option<NaiveDate>,
) -> Result<Vec<RankingSnapshotHistoryRow>, sqlx::Error> {
    sqlx::query_as::<_, RankingSnapshotHistoryRow>(
        r#"
        SELECT rs.person_id, p.name, rs.value, rs.rank
        FROM ranking_snapshots rs
        JOIN persons p ON p.person_id = rs.person_id
        WHERE p.person_id = $1
        AND rs.snapshot_date = (
              SELECT snapshot_date 
              FROM ranking_snapshots 
              WHERE snapshot_date <= COALESCE($2, CURRENT_DATE)
              ORDER BY snapshot_date DESC 
              LIMIT 1
          )
        "#,
    )
    .bind(competitor_id)
    .bind(date)
    .fetch_all(pool)
    .await
}
