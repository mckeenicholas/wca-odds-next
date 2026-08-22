use std::collections::HashMap;

use itertools::Itertools;
use serde::Serialize;

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

#[derive(Clone, Default)]
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_histogram_accumulator_and_data() {
        let mut acc = HistogramAccumulator::new();
        for _ in 0..50 {
            acc.record(100);
        }
        for _ in 0..30 {
            acc.record(110);
        }
        acc.record(120); // only 1 count

        // Min threshold = 0.05 (needs at least 5 counts out of 100)
        let data = acc.into_histogram_data(100, 1, 0.05);

        assert_eq!(data.get(&100), 0.50);
        assert_eq!(data.get(&110), 0.30);
        assert_eq!(data.get(&120), 0.0); // filtered out by threshold
        assert_eq!(data.get(&999), 0.0); // non-existent

        assert_eq!(data.key_range(), Some((100, 110)));
    }

    #[test]
    fn test_histogram_data_empty() {
        let acc = HistogramAccumulator::new();
        let data = acc.into_histogram_data(100, 1, 0.0);
        assert_eq!(data.key_range(), None);
        assert_eq!(data.get(&100), 0.0);
    }

    #[test]
    fn test_rank_accumulator_and_stats() {
        let mut acc = RankAccumulator::new(4);
        for _ in 0..100 {
            acc.record_rank(0);
        }
        for _ in 0..200 {
            acc.record_rank(1);
        }
        for _ in 0..300 {
            acc.record_rank(2);
        }
        for _ in 0..400 {
            acc.record_rank(3);
        }

        let stats = acc.into_rank_stats(1000);
        assert_eq!(stats.len(), 4);
        assert_eq!(stats.win_probability(), 0.10);
        assert!((stats.podium_probability() - 0.60).abs() < 1e-6);
        // expected rank: 1*0.1 + 2*0.2 + 3*0.3 + 4*0.4 = 0.1 + 0.4 + 0.9 + 1.6 = 3.0
        assert!((stats.expected_rank() - 3.0).abs() < 1e-6);
        assert_eq!(stats.as_slice(), &[0.1, 0.2, 0.3, 0.4]);
    }
}
