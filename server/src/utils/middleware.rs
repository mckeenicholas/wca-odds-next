use axum::{
    body::Body,
    extract::State,
    http::{Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use http_body_util::BodyExt;
use moka::future::Cache;
use std::{
    hash::{DefaultHasher, Hash, Hasher},
    time::Instant,
};
use tower_governor::{GovernorError, key_extractor::KeyExtractor};

#[derive(Clone, Copy)]
pub struct ForwardedIpExtractor;

impl KeyExtractor for ForwardedIpExtractor {
    type Key = std::net::IpAddr;

    fn extract<Body>(&self, req: &Request<Body>) -> Result<Self::Key, GovernorError> {
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

pub type ResponseCache = Cache<u64, Vec<u8>>;

pub async fn caching_middleware(
    State(cache): State<ResponseCache>,
    req: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    let method = req.method().clone();
    let uri = req.uri().to_string();

    let mut hasher = DefaultHasher::new();
    method.hash(&mut hasher);
    uri.hash(&mut hasher);

    let (parts, body) = req.into_parts();

    let bytes = match body.collect().await {
        Ok(collected) => collected.to_bytes(),
        Err(e) => {
            eprintln!("Error in caching middleware: {e}");
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    bytes.hash(&mut hasher);
    let key = hasher.finish();

    let req = Request::from_parts(parts, Body::from(bytes));

    if let Some(cached_body) = cache.get(&key).await {
        return Ok((
            [(axum::http::header::CONTENT_TYPE, "application/json")],
            Body::from(cached_body),
        )
            .into_response());
    }

    let res = next.run(req).await;

    if res.status() == StatusCode::OK {
        let (parts, body) = res.into_parts();

        let bytes = match body.collect().await {
            Ok(collected) => collected.to_bytes(),
            Err(e) => {
                eprintln!("Error in caching middleware: {e}");
                return Err(StatusCode::INTERNAL_SERVER_ERROR);
            }
        };

        cache.insert(key, bytes.to_vec()).await;

        Ok(Response::from_parts(parts, Body::from(bytes)))
    } else {
        Ok(res)
    }
}
