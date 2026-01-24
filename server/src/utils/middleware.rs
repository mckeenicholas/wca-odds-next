use axum::body::Body;
use axum::http::Request;
use axum::{middleware::Next, response::Response};
use std::time::Instant;
use tower_governor::{GovernorError, key_extractor::KeyExtractor};

#[derive(Clone, Copy)]
pub struct ForwardedIpExtractor;

impl KeyExtractor for ForwardedIpExtractor {
    type Key = std::net::IpAddr;

    fn extract<B>(&self, req: &Request<B>) -> Result<Self::Key, GovernorError> {
        let headers = req.headers();

        // Check Cloudflare header first
        // Fallback to X-Forwarded-For (from Nginx)
        // Fallback to Peer IP
        headers
            .get("cf-connecting-ip")
            .or_else(|| headers.get("x-forwarded-for"))
            .and_then(|val| val.to_str().ok())
            .and_then(|s| s.split(',').next())
            .and_then(|s| s.trim().parse().ok())
            .ok_or(GovernorError::UnableToExtractKey)
    }
}

pub async fn timer_middleware(req: Request<Body>, next: Next) -> Response {
    let start = Instant::now();
    let path = req.uri().path().to_string();
    let method = req.method().clone();

    let response = next.run(req).await;

    let latency = start.elapsed();
    println!(
        "[{}] {} -> {} executed in {:?}",
        method,
        path,
        response.status(),
        latency
    );

    response
}
