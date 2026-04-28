use crate::utils::{database::fetch_competitor_rank_info, wca::clean_and_validate_wca_id};
use axum::{
    Json,
    extract::{Query, State},
    response::IntoResponse,
};
use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};
use std::collections::HashMap;

use crate::utils::http::AppError;

#[derive(Deserialize)]
pub struct SearchQuery {
    q: Option<String>,
}

#[derive(Serialize, FromRow)]
pub struct Person {
    pub person_id: String,
    pub name: String,
    pub country_iso2: Option<String>,
}

async fn query_name(pool: &PgPool, term: &str) -> Vec<Person> {
    // If the term has numbers, it's likely an ID, so skip name search
    if term.chars().any(|c| c.is_ascii_digit()) {
        return Vec::new();
    }

    sqlx::query_as::<_, Person>(
        r#"
        SELECT p.person_id, p.name, c.iso2 AS country_iso2
        FROM persons p
        LEFT JOIN countries c ON c.id = p.country_id
        WHERE p.name ILIKE $1
        LIMIT 16
        "#,
    )
    .bind(format!("%{}%", term))
    .fetch_all(pool)
    .await
    .unwrap_or_default()
}

async fn query_id(pool: &PgPool, term: &str) -> Vec<Person> {
    sqlx::query_as::<_, Person>(
        r#"
        SELECT p.person_id, p.name, c.iso2 AS country_iso2
        FROM persons p
        LEFT JOIN countries c ON c.id = p.country_id
        WHERE p.person_id ILIKE $1
        LIMIT 16
        "#,
    )
    .bind(format!("%{}%", term))
    .fetch_all(pool)
    .await
    .unwrap_or_default()
}

pub async fn search_handler(
    State(pool): State<PgPool>,
    query: Query<SearchQuery>,
) -> Result<impl IntoResponse, AppError> {
    let search_term = match &query.q {
        Some(q) if !q.trim().is_empty() => q.trim().to_string(),
        _ => return Ok(Json(Vec::<Person>::new())),
    };

    let id_future = query_id(&pool, &search_term);
    let name_future = query_name(&pool, &search_term);

    let (id_results, name_results) = tokio::join!(id_future, name_future);

    let mut persons_map: HashMap<String, Person> = HashMap::new();

    for p in id_results.into_iter().chain(name_results.into_iter()) {
        persons_map.insert(p.person_id.clone(), p);
    }

    let mut final_persons: Vec<Person> = persons_map.into_values().collect();

    final_persons.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(Json(final_persons))
}

#[derive(Deserialize)]
pub struct PersonRankDetailsRequest {
    person_id: String,
    date: Option<NaiveDate>,
}

pub async fn person_rank_details(
    State(pool): State<PgPool>,
    Json(payload): Json<PersonRankDetailsRequest>,
) -> Result<impl IntoResponse, AppError> {
    let wca_id = payload.person_id;

    let id_validated = clean_and_validate_wca_id(&wca_id)
        .ok_or_else(|| AppError::BadRequest(format!("Invalid WCA ID {wca_id}")))?;

    let person_rank_info = fetch_competitor_rank_info(&pool, &id_validated, payload.date).await?;

    Ok(Json(person_rank_info))
}
