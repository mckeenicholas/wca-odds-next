use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

use crate::utils::charts::ChartData;

// --- API Request DTOs ---

#[derive(Debug, Deserialize)]
pub struct SimulationRequest {
    pub competitor_ids: Vec<String>,
    pub event_id: String,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
    pub half_life: f32,
    pub entered_times: Option<Vec<Vec<i32>>>,
    pub include_dnf: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct SimulationHistoryRequest {
    pub competitor_ids: Vec<String>,
    pub event_id: String,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
    pub half_life: f32,
    pub include_dnf: Option<bool>,
}

// --- API Response DTOs ---

#[derive(Serialize)]
pub struct CompetitorSimulationResult {
    pub name: String,
    pub id: String,
    pub country_iso2: String,
    pub win_chance: f64,
    pub pod_chance: f64,
    pub expected_rank: f64,
    pub sample_size: u32,
    pub mean_no_dnf: u32,
    pub histogram: ChartData,
}

#[derive(Serialize)]
pub struct HistoryPoint {
    pub date: NaiveDate,
    pub competitors: Vec<CompetitorHistoryStat>,
}

#[derive(Serialize)]
pub struct CompetitorHistoryStat {
    pub id: String,
    pub name: String,
    pub country_iso2: String,
    pub win_chance: f64,
    pub pod_chance: f64,
    pub expected_rank: f64,
    pub sample_size: u32,
}

#[derive(Serialize)]
pub struct FullHistogramChartData {
    pub single: ChartData,
    pub average: ChartData,
}

#[derive(Serialize)]
pub struct SimulationEndpointResults {
    pub competitor_results: Vec<CompetitorSimulationResult>,
    pub full_histogram: FullHistogramChartData,
    pub rank_histogram: ChartData,
}

#[derive(Debug, Deserialize)]
pub struct RankingRequest {
    pub event_id: String,
    pub date: Option<NaiveDate>,
    pub country_id: Option<String>,
    pub offset: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct RankingHistoryRequest {
    pub competitor_id: String,
    pub event_id: String,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simulation_request_deserialization() {
        let json_str = r#"{
            "competitor_ids": ["2015MCKE02", "1982THAI01"],
            "event_id": "333",
            "start_date": "2024-01-01",
            "end_date": "2025-01-01",
            "half_life": 90.0,
            "entered_times": [[1000, 1100], []],
            "include_dnf": true
        }"#;

        let req: SimulationRequest = serde_json::from_str(json_str).unwrap();
        assert_eq!(req.competitor_ids.len(), 2);
        assert_eq!(req.event_id, "333");
        assert_eq!(req.start_date, NaiveDate::from_ymd_opt(2024, 1, 1).unwrap());
        assert_eq!(req.end_date, NaiveDate::from_ymd_opt(2025, 1, 1).unwrap());
        assert_eq!(req.half_life, 90.0);
        assert_eq!(req.entered_times, Some(vec![vec![1000, 1100], vec![]]));
        assert_eq!(req.include_dnf, Some(true));
    }

    #[test]
    fn test_ranking_request_deserialization() {
        let json_str = r#"{
            "event_id": "333",
            "date": "2025-01-01",
            "country_id": "_North America",
            "offset": 32
        }"#;

        let req: RankingRequest = serde_json::from_str(json_str).unwrap();
        assert_eq!(req.event_id, "333");
        assert_eq!(req.date, NaiveDate::from_ymd_opt(2025, 1, 1));
        assert_eq!(req.country_id, Some("_North America".to_string()));
        assert_eq!(req.offset, Some(32));
    }
}
