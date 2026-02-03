use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::utils::charts::ChartData;

#[derive(Debug, Clone, PartialEq, Copy)]
pub enum EventType {
    Ao5,
    Bo5,
    Mo3,
    Bo3,
    Fmc,
}

impl EventType {
    pub fn from_id(id: &str) -> Option<Self> {
        match id {
            "222" | "333" | "444" | "555" | "333oh" | "minx" | "pyram" | "clock" | "skewb"
            | "sq1" => Some(Self::Ao5),
            "333bf" => Some(Self::Bo5),
            "666" | "777" => Some(Self::Mo3),
            "333fm" => Some(Self::Fmc),
            "444bf" | "555bf" => Some(Self::Bo3),
            _ => None,
        }
    }
}

#[derive(Debug, Clone)]
pub struct DatedCompetitionResult {
    pub days_since: i32,
    pub results: Vec<i32>,
}

#[derive(Debug)]
pub struct CompetitorStats {
    pub location: f32,
    pub shape: f32,
    pub skew: f32,
    pub dnf_rate: f32,
    pub mean: f32,
    // pub stdev: f32,
    pub num_non_dnf_results: u32,
}

// --- REQUEST/RESPONSE TYPES ---
#[derive(Debug, Deserialize)]
pub struct SimulationRequest {
    pub competitor_ids: Vec<String>,
    pub event_id: String,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
    pub half_life: f32,
    pub entered_times: Option<Vec<Vec<i32>>>, // Optional manual overrides
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

#[derive(Debug, FromRow)]
pub struct CompetitorRow {
    pub person_id: String,
    pub competition_date: NaiveDate,
    pub value: i32,
}

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
