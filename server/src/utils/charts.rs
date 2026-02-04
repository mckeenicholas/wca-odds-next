use std::collections::HashMap;

use itertools::Itertools;
use serde::Serialize;

#[derive(Serialize)]
pub struct ChartData {
    labels: Vec<String>,
    data: Vec<ChartPoint>,
}

#[derive(Serialize)]
pub struct ChartPoint {
    name: String,
    values: Vec<f64>,
}

pub struct CompetitorHistData<'a> {
    pub name: &'a str,
    pub results: &'a HashMap<i32, f64>,
}

const PAD_AMOUNT_CS: i32 = 20; // 20 centiseconds
const PAD_AMOUNT_MOVES: i32 = 100; // 1 move for FMC

pub struct HistogramKeys {
    count: i32,
    max: i32,
    is_fmc: bool,
    is_average: bool,
}

impl HistogramKeys {
    fn new(min: i32, max: i32, is_fmc: bool, is_average: bool) -> Option<Self> {
        let pad_amount = if is_fmc {
            PAD_AMOUNT_MOVES
        } else {
            PAD_AMOUNT_CS
        };

        let start_val = (min - pad_amount).max(0);
        let decimals = start_val % 100;

        let is_valid = if is_fmc {
            decimals == 0 || decimals == 33 || decimals == 67
        } else {
            start_val % 10 == 0
        };

        if !is_valid {
            return None;
        }

        Some(Self {
            count: start_val,
            max: max + pad_amount,
            is_fmc,
            is_average,
        })
    }
}

impl Iterator for HistogramKeys {
    type Item = i32;

    fn next(&mut self) -> Option<Self::Item> {
        if self.count > self.max {
            return None;
        }

        let yield_val = self.count;
        let decimals = self.count % 100;

        self.count = match (self.is_fmc, self.is_average, decimals) {
            (true, true, 0) => self.count + 33,
            (true, true, 33) => self.count + 34,
            (true, true, 67) => self.count + 33,
            (true, false, _) => self.count + 100,
            _ => self.count + 10,
        };

        Some(yield_val)
    }
}

type HistInfo = HashMap<i32, f64>;
pub fn create_invidual_histogram_chart(
    singles: &HistInfo,
    averages: &HistInfo,
    is_fmc: bool,
) -> ChartData {
    let labels = vec!["single".into(), "average".into()];

    let (min_key, max_key) = match singles.keys().chain(averages.keys()).minmax() {
        itertools::MinMaxResult::MinMax(&min, &max) => (min, max),
        itertools::MinMaxResult::OneElement(&val) => (val, val),
        _ => {
            return ChartData {
                labels,
                data: vec![],
            };
        }
    };

    let hist_key_iter = match HistogramKeys::new(min_key, max_key, is_fmc, true) {
        Some(iter) => iter,
        None => {
            return ChartData {
                labels,
                data: vec![],
            };
        }
    };

    let data = hist_key_iter
        .map(|i| ChartPoint {
            name: i.to_string(),
            values: vec![
                *singles.get(&i).unwrap_or(&0.0),
                *averages.get(&i).unwrap_or(&0.0),
            ],
        })
        .collect();

    ChartData { labels, data }
}

pub fn create_full_histogram_chart(
    competitors: &[CompetitorHistData],
    is_fmc: bool,
    is_average: bool,
) -> ChartData {
    let (min_key, max_key) = match competitors.iter().flat_map(|c| c.results.keys()).minmax() {
        itertools::MinMaxResult::MinMax(&min, &max) => (min, max),
        itertools::MinMaxResult::OneElement(&val) => (val, val),
        itertools::MinMaxResult::NoElements => {
            return ChartData {
                labels: vec![],
                data: vec![],
            };
        }
    };

    // 2. Initialize our custom iterator
    let hist_key_iter = match HistogramKeys::new(min_key, max_key, is_fmc, is_average) {
        Some(iter) => iter,
        None => {
            return ChartData {
                labels: vec![],
                data: vec![],
            };
        }
    };

    // 3. Map the iterator directly into ChartPoints
    let raw_points: Vec<ChartPoint> = hist_key_iter
        .map(|time| {
            let values = competitors
                .iter()
                .map(|c| *c.results.get(&time).unwrap_or(&0.0))
                .collect();

            ChartPoint {
                name: time.to_string(),
                values,
            }
        })
        .collect();

    // 4. Handle point merging logic
    let log_len = (raw_points.len() as f64).log2().ceil() as i32;
    let final_data = if log_len <= 8 {
        raw_points
    } else {
        let merge_factor = 2_usize.pow((log_len - 8) as u32);
        average_chunks(raw_points, merge_factor, competitors.len())
    };

    ChartData {
        labels: competitors.iter().map(|c| c.name.to_string()).collect(),
        data: final_data,
    }
}

fn average_chunks(
    points: Vec<ChartPoint>,
    chunk_size: usize,
    num_competitors: usize,
) -> Vec<ChartPoint> {
    points
        .chunks(chunk_size)
        .map(|chunk| {
            // Sum up columns
            let mut sums = vec![0.0; num_competitors];
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

pub fn generate_rank_chart(input_data: &[(&str, &[f64])]) -> ChartData {
    let labels: Vec<String> = input_data.iter().map(|v| v.0.to_string()).collect();

    let mut data = Vec::new();

    for rank_idx in 0..input_data.len() {
        let values: Vec<f64> = input_data
            .iter()
            .map(|(_, probs)| probs[rank_idx] * 100.0)
            .collect();

        data.push(ChartPoint {
            name: (rank_idx + 1).to_string(),
            values,
        });
    }

    ChartData { labels, data }
}
