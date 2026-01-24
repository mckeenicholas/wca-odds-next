use axum::{
    Router,
    http::Method,
    routing::{get, post},
};

mod routes;
mod utils;

use routes::{health, history, simulation};

use sqlx::postgres::PgPoolOptions;
use std::env;
use tower_http::cors::CorsLayer;

#[tokio::main]
async fn main() {
    let host = env::var("POSTGRES_HOST").unwrap_or_else(|_| "localhost".to_string());
    let port = env::var("POSTGRES_PORT").unwrap_or_else(|_| "5432".to_string());
    let user = env::var("POSTGRES_USER").expect("POSTGRES_USER must be set");
    let pass = env::var("POSTGRES_PASSWORD").expect("POSTGRES_PASSWORD must be set");
    let db_name = env::var("POSTGRES_DB").expect("POSTGRES_DB must be set");

    let database_url = format!("postgres://{}:{}@{}:{}/{}", user, pass, host, port, db_name);

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("Failed to connect to Postgres");

    let cors = CorsLayer::new()
        .allow_origin(
            "http://localhost:5173"
                .parse::<axum::http::HeaderValue>()
                .unwrap(),
        )
        .allow_methods([Method::GET, Method::POST])
        .allow_headers([axum::http::header::CONTENT_TYPE]);

    let app = Router::new()
        .route("/api/health", get(health::health_check))
        .route("/api/simulation", post(simulation::simulation_handler))
        .route("/api/history", post(history::simulation_history_handler))
        .with_state(pool)
        .layer(cors);

    println!("Server running on port 3000");
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
