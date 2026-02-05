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
