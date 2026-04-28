use axum::{
    Json,
    extract::{Query, State},
    response::IntoResponse,
};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};

use crate::utils::http::AppError;

#[derive(Deserialize)]
pub struct CountryOptionsQuery {
    pub include_regions: Option<bool>,
}

#[derive(Serialize, FromRow, Clone)]
pub struct CountryResult {
    pub id: String,
    pub iso2: String,
    pub name: String,
    pub continent_id: String,
}

// WCA continent pseudo-entries (excluded from DB load, synthesized here).
// Ordered alphabetically by name.
const CONTINENTS: &[(&str, &str, &str)] = &[
    ("_Africa", "XF", "Africa"),
    ("_Asia", "XA", "Asia"),
    ("_Europe", "XE", "Europe"),
    ("_North America", "XN", "North America"),
    ("_South America", "XS", "South America"),
    ("_Oceania", "XO", "Oceania"),
];

pub async fn country_list_handler(
    State(pool): State<PgPool>,
    query: Query<CountryOptionsQuery>,
) -> Result<impl IntoResponse, AppError> {
    let mut results: Vec<CountryResult> = Vec::new();

    if query.include_regions.unwrap_or(false) {
        let world = CountryResult {
            id: "World".to_string(),
            iso2: "ZZ".to_string(),
            name: "World".to_string(),
            continent_id: String::new(),
        };

        results.push(world);

        for (id, _iso2, name) in CONTINENTS {
            let region = CountryResult {
                id: id.to_string(),
                iso2: _iso2.to_string(),
                name: name.to_string(),
                continent_id: id.to_string(),
            };

            results.push(region);
        }
    }

    let countries = sqlx::query_as::<_, CountryResult>(
        r#"
            SELECT id, iso2, name, continent_id
            FROM countries
            ORDER BY name ASC
            "#,
    )
    .fetch_all(&pool)
    .await?;

    results.extend(countries);

    Ok(Json(results).into_response())
}
