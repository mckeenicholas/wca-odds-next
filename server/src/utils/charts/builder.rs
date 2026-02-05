use itertools::Itertools;

use super::histogram::HistogramKeys;
use super::models::{ChartData, ChartPoint, HistogramData, RankStats};

pub struct HistogramChartBuilder<'a> {
    series: Vec<(&'a str, &'a HistogramData)>,
    is_fmc: bool,
    is_average: bool,
}

impl<'a> HistogramChartBuilder<'a> {
    pub fn new(is_fmc: bool, is_average: bool) -> Self {
        Self {
            series: Vec::new(),
            is_fmc,
            is_average,
        }
    }

    pub fn add_series(mut self, name: &'a str, data: &'a HistogramData) -> Self {
        self.series.push((name, data));
        self
    }

    pub fn build(self) -> ChartData {
        if self.series.is_empty() {
            return ChartData {
                labels: vec![],
                data: vec![],
            };
        }

        let Some((min, max)) = self.find_key_range() else {
            return ChartData {
                labels: self.series.iter().map(|(n, _)| n.to_string()).collect(),
                data: vec![],
            };
        };

        let Some(key_iter) = HistogramKeys::new(min, max, self.is_fmc, self.is_average) else {
            return ChartData {
                labels: self.series.iter().map(|(n, _)| n.to_string()).collect(),
                data: vec![],
            };
        };

        let raw_points: Vec<ChartPoint> = key_iter
            .map(|key| {
                let values = self.series.iter().map(|(_, data)| data.get(&key)).collect();
                ChartPoint {
                    name: key.to_string(),
                    values,
                }
            })
            .collect();

        let final_data = Self::maybe_merge_points(raw_points, self.series.len());

        ChartData {
            labels: self.series.iter().map(|(n, _)| n.to_string()).collect(),
            data: final_data,
        }
    }

    fn find_key_range(&self) -> Option<(i32, i32)> {
        self.series
            .iter()
            .filter_map(|(_, data)| data.key_range())
            .flat_map(|(min, max)| [min, max])
            .minmax()
            .into_option()
    }

    fn maybe_merge_points(points: Vec<ChartPoint>, num_series: usize) -> Vec<ChartPoint> {
        if points.is_empty() {
            return points;
        }

        let log_len = (points.len() as f64).log2().ceil() as i32;
        if log_len <= 8 {
            return points;
        }

        let merge_factor = 2_usize.pow((log_len - 8) as u32);
        points
            .chunks(merge_factor)
            .map(|chunk| {
                let mut sums = vec![0.0; num_series];
                for point in chunk {
                    for (i, val) in point.values.iter().enumerate() {
                        sums[i] += val;
                    }
                }
                ChartPoint {
                    name: chunk[0].name.clone(),
                    values: sums.into_iter().map(|s| s / chunk.len() as f64).collect(),
                }
            })
            .collect()
    }
}

pub struct IndividualHistogramBuilder<'a> {
    singles: &'a HistogramData,
    averages: &'a HistogramData,
    is_fmc: bool,
}

impl<'a> IndividualHistogramBuilder<'a> {
    pub fn new(singles: &'a HistogramData, averages: &'a HistogramData, is_fmc: bool) -> Self {
        Self {
            singles,
            averages,
            is_fmc,
        }
    }

    pub fn build(self) -> ChartData {
        let labels = vec!["single".into(), "average".into()];

        let range1 = self.singles.key_range();
        let range2 = self.averages.key_range();

        let (min_key, max_key) = match (range1, range2) {
            (Some((min1, max1)), Some((min2, max2))) => (min1.min(min2), max1.max(max2)),
            (Some((min, max)), None) | (None, Some((min, max))) => (min, max),
            (None, None) => {
                return ChartData {
                    labels,
                    data: vec![],
                };
            }
        };

        let Some(key_iter) = HistogramKeys::new(min_key, max_key, self.is_fmc, true) else {
            return ChartData {
                labels,
                data: vec![],
            };
        };

        let data = key_iter
            .map(|key| ChartPoint {
                name: key.to_string(),
                values: vec![self.singles.get(&key), self.averages.get(&key)],
            })
            .collect();

        ChartData { labels, data }
    }
}

pub struct RankChartBuilder<'a> {
    series: Vec<(&'a str, &'a RankStats)>,
}

impl<'a> RankChartBuilder<'a> {
    pub fn new() -> Self {
        Self { series: Vec::new() }
    }

    pub fn add_competitor(&mut self, name: &'a str, stats: &'a RankStats) {
        self.series.push((name, stats));
    }

    pub fn into_chart_data(self) -> ChartData {
        let labels: Vec<String> = self.series.iter().map(|(n, _)| n.to_string()).collect();

        if self.series.is_empty() {
            return ChartData {
                labels,
                data: vec![],
            };
        }

        let rank_count = self.series[0].1.len();
        let data = (0..rank_count)
            .map(|rank_idx| {
                let values: Vec<f64> = self
                    .series
                    .iter()
                    .map(|(_, dist)| dist.as_slice().get(rank_idx).copied().unwrap_or(0.0) * 100.0)
                    .collect();
                ChartPoint {
                    name: (rank_idx + 1).to_string(),
                    values,
                }
            })
            .collect();

        ChartData { labels, data }
    }
}

impl Default for RankChartBuilder<'_> {
    fn default() -> Self {
        Self::new()
    }
}
