use itertools::Itertools;
use serde::Serialize;
use std::collections::HashMap;

#[derive(Serialize)]
pub struct ChartData {
    pub labels: Vec<String>,
    pub data: Vec<ChartPoint>,
}

#[derive(Serialize, Clone)]
pub struct ChartPoint {
    pub name: String,
    pub values: Vec<f64>,
}

#[derive(Clone, Default)]
pub struct HistogramAccumulator {
    counts: HashMap<i32, i32>,
}

impl HistogramAccumulator {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn record(&mut self, key: i32) {
        *self.counts.entry(key).or_default() += 1;
    }

    pub fn into_histogram_data(
        self,
        sample_count: u32,
        scale_factor: i32,
        min_threshold: f64,
    ) -> HistogramData {
        let min_count = (min_threshold * sample_count as f64) as i32;
        let bins = self
            .counts
            .into_iter()
            .filter(|(_, count)| *count >= min_count)
            .map(|(key, count)| (key, (count * scale_factor) as f64 / sample_count as f64))
            .collect();
        HistogramData { bins }
    }
}

pub struct HistogramData {
    bins: HashMap<i32, f64>,
}

impl HistogramData {
    pub fn get(&self, key: &i32) -> f64 {
        *self.bins.get(key).unwrap_or(&0.0)
    }

    pub fn key_range(&self) -> Option<(i32, i32)> {
        self.bins
            .keys()
            .minmax()
            .into_option()
            .map(|(min, max)| (*min, *max))
    }
}

pub struct RankAccumulator {
    counts: Vec<u32>,
}

impl RankAccumulator {
    pub fn new(num_competitors: usize) -> Self {
        Self {
            counts: vec![0; num_competitors],
        }
    }

    pub fn record_rank(&mut self, rank: usize) {
        self.counts[rank] += 1;
    }

    pub fn into_rank_stats(self, sample_count: u32) -> RankStats {
        let probabilities = self
            .counts
            .into_iter()
            .map(|c| c as f64 / sample_count as f64)
            .collect();

        RankStats { probabilities }
    }
}

#[derive(Clone, Serialize)]
pub struct RankStats {
    probabilities: Vec<f64>,
}

impl RankStats {
    pub fn win_probability(&self) -> f64 {
        self.probabilities.first().copied().unwrap_or(0.0)
    }

    pub fn podium_probability(&self) -> f64 {
        self.probabilities.iter().take(3).sum()
    }

    pub fn expected_rank(&self) -> f64 {
        self.probabilities
            .iter()
            .enumerate()
            .map(|(rank, prob)| (rank + 1) as f64 * prob)
            .sum()
    }

    pub fn as_slice(&self) -> &[f64] {
        &self.probabilities
    }

    pub fn len(&self) -> usize {
        self.probabilities.len()
    }
}
