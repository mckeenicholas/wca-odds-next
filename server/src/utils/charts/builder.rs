use itertools::Itertools;

use super::{
    histogram::HistogramKeys,
    models::{ChartData, ChartPoint, HistogramData, RankStats},
};

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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::utils::charts::models::HistogramAccumulator;

    #[test]
    fn test_histogram_chart_builder_empty() {
        let builder = HistogramChartBuilder::new(false, false);
        let chart = builder.build();
        assert!(chart.labels.is_empty());
        assert!(chart.data.is_empty());
    }

    #[test]
    fn test_histogram_chart_builder_standard() {
        let mut acc1 = HistogramAccumulator::new();
        acc1.record(100);
        acc1.record(110);
        let data1 = acc1.into_histogram_data(10, 1, 0.0);

        let mut acc2 = HistogramAccumulator::new();
        acc2.record(110);
        acc2.record(120);
        let data2 = acc2.into_histogram_data(10, 1, 0.0);

        let chart = HistogramChartBuilder::new(false, false)
            .add_series("Alice", &data1)
            .add_series("Bob", &data2)
            .build();

        assert_eq!(chart.labels, vec!["Alice", "Bob"]);
        // Key range: min 100 -> start 80, max 120 -> end 140.
        // Points: 80, 90, 100, 110, 120, 130, 140
        assert_eq!(chart.data.len(), 7);
        // At key 100: Alice has 0.1, Bob has 0.0
        let pt_100 = chart.data.iter().find(|p| p.name == "100").unwrap();
        assert_eq!(pt_100.values, vec![0.1, 0.0]);
        // At key 110: Alice has 0.1, Bob has 0.1
        let pt_110 = chart.data.iter().find(|p| p.name == "110").unwrap();
        assert_eq!(pt_110.values, vec![0.1, 0.1]);
    }

    #[test]
    fn test_histogram_chart_builder_point_merging() {
        // Create histogram with wide span (> 256 keys of step 10)
        let mut acc = HistogramAccumulator::new();
        acc.record(1000);
        acc.record(5000); // 400 steps of 10
        let data = acc.into_histogram_data(10, 1, 0.0);

        let chart = HistogramChartBuilder::new(false, false)
            .add_series("Competitor", &data)
            .build();

        // Total raw points would be (5020 - 980) / 10 + 1 = 405 points.
        // log2(405) = 9 -> merge_factor = 2^(9-8) = 2.
        // Resulting points should be ~405 / 2 = 203.
        assert!(chart.data.len() <= 256);
        assert!(!chart.data.is_empty());
    }

    #[test]
    fn test_individual_histogram_builder() {
        let mut acc_s = HistogramAccumulator::new();
        acc_s.record(100);
        let singles = acc_s.into_histogram_data(10, 1, 0.0);

        let mut acc_a = HistogramAccumulator::new();
        acc_a.record(120);
        let averages = acc_a.into_histogram_data(10, 1, 0.0);

        let builder = IndividualHistogramBuilder::new(&singles, &averages, false);
        let chart = builder.build();

        assert_eq!(chart.labels, vec!["single", "average"]);
        // Key range: 100 to 120 -> with padding 80 to 140 -> 7 points
        assert_eq!(chart.data.len(), 7);
        for pt in &chart.data {
            assert_eq!(pt.values.len(), 2);
        }
    }

    #[test]
    fn test_individual_histogram_builder_empty() {
        let singles = HistogramData::default();
        let averages = HistogramData::default();

        let builder = IndividualHistogramBuilder::new(&singles, &averages, false);
        let chart = builder.build();

        assert_eq!(chart.labels, vec!["single", "average"]);
        assert!(chart.data.is_empty());
    }

    #[test]
    fn test_rank_chart_builder_empty() {
        let builder = RankChartBuilder::default();
        let chart = builder.into_chart_data();
        assert!(chart.labels.is_empty());
        assert!(chart.data.is_empty());
    }
}
