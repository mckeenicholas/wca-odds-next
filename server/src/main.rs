use axum::{
    Router,
    http::Method,
    middleware,
    routing::{get, post},
};
use sqlx::postgres::PgPoolOptions;
use std::env;
use tower_governor::{GovernorLayer, governor::GovernorConfigBuilder};
use tower_http::cors::CorsLayer;

mod routes;
mod utils;

use routes::{health, history, simulation};
use utils::middleware::ForwardedIpExtractor;

use crate::utils::middleware::timer_middleware;

const ALLOWED_ORIGINS: &[&str] = &["http://localhost:5173", "https://odds.nmckee.org"];

#[tokio::main]
async fn main() {
    let host = env::var("POSTGRES_HOST").unwrap_or_else(|_| "localhost".to_string());
    let port = env::var("POSTGRES_PORT").unwrap_or_else(|_| "5432".to_string());
    let user = env::var("POSTGRES_USER").expect("POSTGRES_USER must be set");
    let pass = env::var("POSTGRES_PASSWORD").expect("POSTGRES_PASSWORD must be set");
    let db_name = env::var("POSTGRES_DB").expect("POSTGRES_DB must be set");
    let port_num: u16 = env::var("PORT")
        .map(|v| v.parse::<u16>().expect("Invalid port number"))
        .unwrap_or(3000);

    let database_url = format!("postgres://{}:{}@{}:{}/{}", user, pass, host, port, db_name);

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("Failed to connect to Postgres");

    let governor_conf = GovernorConfigBuilder::default()
        .per_second(5)
        .burst_size(10)
        .key_extractor(ForwardedIpExtractor) // Uses the peer IP
        .finish()
        .unwrap();

    // let governor = GovernorLayer::new(governor_conf);

    let cors = CorsLayer::new()
        .allow_origin(
            ALLOWED_ORIGINS
                .iter()
                .map(|origin| axum::http::HeaderValue::from_str(origin))
                .collect::<Result<Vec<_>, _>>()
                .unwrap(),
        )
        .allow_methods([Method::GET, Method::POST])
        .allow_headers([axum::http::header::CONTENT_TYPE]);

    let app = Router::new()
        .route("/api/health", get(health::health_check))
        .route("/api/simulation", post(simulation::simulation_handler))
        .route("/api/history", post(history::simulation_history_handler))
        .with_state(pool)
        .layer(middleware::from_fn(timer_middleware))
        // .layer(governor)
        .layer(cors);

    let addr = format!("0.0.0.0:{}", port_num);
    println!("Server running on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
