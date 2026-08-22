use std::{
    hash::{DefaultHasher, Hash, Hasher},
    time::Instant,
};

use axum::{
    body::Body,
    extract::State,
    http::{Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use http_body_util::BodyExt;
use moka::future::Cache;
use tower_governor::{GovernorError, key_extractor::KeyExtractor};

/// IP extractor that handles proxied requests (Cloudflare, Nginx).
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

// Log simulation execution time in case values have to be re-tuned due to high use
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
    if req.uri().path() == "/api/health" {
        return Ok(next.run(req).await);
    }

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

#[cfg(test)]
mod tests {
    use std::net::Ipv4Addr;

    use super::*;

    #[test]
    fn test_forwarded_ip_extractor_cloudflare() {
        let req = Request::builder()
            .header("cf-connecting-ip", "203.0.113.195")
            .body(())
            .unwrap();

        let extractor = ForwardedIpExtractor;
        let ip = extractor.extract(&req).unwrap();
        assert_eq!(ip, std::net::IpAddr::V4(Ipv4Addr::new(203, 0, 113, 195)));
    }

    #[test]
    fn test_forwarded_ip_extractor_x_forwarded_for() {
        let req = Request::builder()
            .header(
                "x-forwarded-for",
                "198.51.100.1, 198.51.100.2, 198.51.100.3",
            )
            .body(())
            .unwrap();

        let extractor = ForwardedIpExtractor;
        let ip = extractor.extract(&req).unwrap();
        assert_eq!(ip, std::net::IpAddr::V4(Ipv4Addr::new(198, 51, 100, 1)));
    }

    #[test]
    fn test_forwarded_ip_extractor_precedence() {
        let req = Request::builder()
            .header("cf-connecting-ip", "203.0.113.1")
            .header("x-forwarded-for", "198.51.100.1")
            .body(())
            .unwrap();

        let extractor = ForwardedIpExtractor;
        let ip = extractor.extract(&req).unwrap();
        // cf-connecting-ip takes precedence
        assert_eq!(ip, std::net::IpAddr::V4(Ipv4Addr::new(203, 0, 113, 1)));
    }

    #[test]
    fn test_forwarded_ip_extractor_missing_or_invalid() {
        let req_empty = Request::builder().body(()).unwrap();
        assert!(ForwardedIpExtractor.extract(&req_empty).is_err());

        let req_invalid = Request::builder()
            .header("x-forwarded-for", "not-an-ip-address")
            .body(())
            .unwrap();
        assert!(ForwardedIpExtractor.extract(&req_invalid).is_err());
    }
}
