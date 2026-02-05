use crate::utils::charts::{HistogramAccumulator, RankAccumulator};
use crate::utils::competitor::{Competitor, CompetitorStats};
use crate::utils::wca::{DNF_VALUE, EventType, calculate_average};
use rand::prelude::*;
use rand_distr::Normal;

use super::results::SimulationResult;

const HIST_INCLUDE_THRESHOLD: f64 = 0.0001;

struct CompetitorAccumulator {
    hist_single: HistogramAccumulator,
    hist_average: HistogramAccumulator,
    ranks: RankAccumulator,
}

impl CompetitorAccumulator {
    fn new(num_competitors: usize) -> Self {
        Self {
            hist_single: HistogramAccumulator::new(),
            hist_average: HistogramAccumulator::new(),
            ranks: RankAccumulator::new(num_competitors),
        }
    }

    fn record_single(&mut self, solve: i32, is_fmc: bool) {
        let hist_value = Self::truncate_for_histogram(solve, is_fmc);
        self.hist_single.record(hist_value);
    }

    fn record_average(&mut self, solve: i32, is_fmc: bool) {
        let hist_value = Self::truncate_for_histogram(solve, is_fmc);
        self.hist_average.record(hist_value);
    }

    fn add_rank(&mut self, rank: usize) {
        self.ranks.record_rank(rank);
    }

    fn finalize(self, simulation_count: u32, event_type: &EventType) -> SimulationResult {
        let single_scale = 100 / event_type.num_solves() as i32;

        SimulationResult::new(
            self.ranks.into_rank_stats(simulation_count),
            self.hist_single.into_histogram_data(
                simulation_count,
                single_scale,
                HIST_INCLUDE_THRESHOLD,
            ),
            self.hist_average
                .into_histogram_data(simulation_count, 100, HIST_INCLUDE_THRESHOLD),
        )
    }

    fn truncate_for_histogram(input: i32, is_fmc: bool) -> i32 {
        if is_fmc { input } else { (input / 10) * 10 }
    }
}

fn generate_skewnorm_value(stats: &CompetitorStats, rng: &mut ThreadRng, include_dnf: bool) -> i32 {
    let normal = Normal::new(0.0, 1.0).unwrap();

    if stats.location.is_nan() || stats.shape.is_nan() {
        return DNF_VALUE;
    }

    if include_dnf && rng.random::<f32>() < stats.dnf_rate {
        return DNF_VALUE;
    }

    let u0 = normal.sample(rng);
    let v = normal.sample(rng);

    let alpha = stats.skew;
    let omega = stats.shape;
    let xi = stats.location;

    let delta = alpha / (1.0 + alpha.powi(2)).sqrt();
    let u1 = delta * u0 + (1.0 - delta.powi(2)).sqrt() * v;

    let z = if u0 >= 0.0 { u1 } else { -u1 };

    let result = xi + (omega * z);
    (result as i32).max(1)
}

fn simulate_round(
    competitor: &Competitor,
    event_type: &EventType,
    rng: &mut rand::rngs::ThreadRng,
    include_dnf: bool,
    acc: &mut CompetitorAccumulator,
) -> i32 {
    let count = event_type.num_solves();
    let mut solves = [DNF_VALUE; 5];

    for (i, solve) in solves.iter_mut().take(count).enumerate() {
        let manual_time = competitor.entered_results.get(i).copied().unwrap_or(0);

        if manual_time != 0 {
            *solve = if manual_time < 0 {
                DNF_VALUE
            } else {
                manual_time
            };
        } else if let Some(stats) = &competitor.stats {
            let val = generate_skewnorm_value(stats, rng, include_dnf);

            *solve = match event_type {
                EventType::Fmc => val * 100,
                _ => val,
            };

            if val < DNF_VALUE {
                acc.record_single(*solve, event_type.is_fmc());
            }
        }
    }

    calculate_average(&mut solves, *event_type)
}

pub fn run_simulations(
    competitors: &[Competitor],
    event_type: &EventType,
    include_dnf: bool,
    simulation_count: u32,
) -> Vec<SimulationResult> {
    let num_competitors = competitors.len();
    let mut rng = rand::rng();

    let mut accumulators: Vec<CompetitorAccumulator> = (0..num_competitors)
        .map(|_| CompetitorAccumulator::new(num_competitors))
        .collect();

    for _ in 0..simulation_count {
        let mut round_results: Vec<(usize, i32)> = Vec::with_capacity(num_competitors);

        for (idx, comp) in competitors.iter().enumerate() {
            let acc = &mut accumulators[idx];

            let avg = simulate_round(comp, event_type, &mut rng, include_dnf, acc);

            if avg != DNF_VALUE {
                acc.record_average(avg, event_type.is_fmc());
            }

            round_results.push((idx, avg));
        }

        round_results.sort_unstable_by_key(|&(_, time)| time);

        for (rank, &(original_idx, _)) in round_results.iter().enumerate() {
            accumulators[original_idx].add_rank(rank);
        }
    }

    accumulators
        .into_iter()
        .map(|acc| acc.finalize(simulation_count, event_type))
        .collect()
}
