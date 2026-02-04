use crate::utils::charts::{
    CompetitorHistData, create_full_histogram_chart, create_invidual_histogram_chart,
    generate_rank_chart,
};
use crate::utils::types::{FullHistogramChartData, SimulationEndpointResults};

use super::competitor::Competitor;
use super::constants::*;
use super::types::{CompetitorSimulationResult, CompetitorStats, EventType};

use rand::prelude::*;
use rand_distr::Normal;
use std::collections::HashMap;

const HIST_INCLUDE_THRESHOLD: f64 = 0.0001; // This is the max resolution we show on the charts.

fn truncate_num(input: i32, is_fmc: bool) -> i32 {
    if is_fmc { input } else { (input / 10) * 10 }
}

pub struct SimulationResult {
    pub win_chance: f64,
    pub pod_chance: f64,
    pub expected_ranks: f64,
    pub rank_dist: Vec<f64>,
    pub hist_single: HashMap<i32, f64>,
    pub hist_average: HashMap<i32, f64>,
}

fn generate_skewnorm_value(stats: &CompetitorStats, rng: &mut ThreadRng, include_dnf: bool) -> i32 {
    let normal = Normal::new(0.0, 1.0).unwrap();

    if stats.location.is_nan() || stats.shape.is_nan() {
        return DNF_VALUE;
    }

    // Scalar implementation of the SIMD logic
    // 1. DNF Check
    if include_dnf && rng.random::<f32>() < stats.dnf_rate {
        return DNF_VALUE;
    }

    // 2. Skew Normal Generation
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

fn num_solves(event_type: EventType) -> usize {
    match event_type {
        EventType::Ao5 => AO5_SOLVE_COUNT,
        EventType::Bo5 => BO5_SOLVE_COUNT,
        EventType::Mo3 => MO3_SOLVE_COUNT,
        EventType::Fmc => MO3_SOLVE_COUNT,
        EventType::Bo3 => BO3_SOLVE_COUNT,
    }
}

fn simulate_round(
    competitor: &Competitor,
    event_type: &EventType,
    rng: &mut ThreadRng,
    include_dnf: bool,
    hist_single: &mut HashMap<i32, i32>,
) -> i32 {
    let count = num_solves(*event_type);

    let mut solves = [DNF_VALUE; 5];

    for (i, solve) in solves.iter_mut().take(count).enumerate() {
        let manual_time = competitor.entered_results.get(i).copied().unwrap_or(0);

        // 1. Check for valid (nonzero) manual entry
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
                *hist_single
                    .entry(truncate_num(*solve, matches!(event_type, EventType::Fmc)))
                    .or_default() += 1;
            }
        }
    }

    match event_type {
        EventType::Ao5 => {
            solves.sort_unstable();
            if solves[3] >= DNF_VALUE {
                DNF_VALUE
            } else {
                let sum = solves[1] + solves[2] + solves[3];
                sum / 3
            }
        }
        EventType::Mo3 | EventType::Fmc => {
            let active_solves = &solves[..3];
            if active_solves.iter().any(|&x| x >= DNF_VALUE) {
                DNF_VALUE
            } else {
                let sum: i32 = active_solves.iter().sum();
                let avg = sum / 3;

                if matches!(event_type, EventType::Fmc) && avg % 10 == 6 {
                    // Because integer division rounds down here, but the WCA site rounds to the nearest integer,
                    // for FMC results ending in 66, we manually nudge to 67
                    avg + 1
                } else {
                    avg
                }
            }
        }
        EventType::Bo3 => *solves[..3].iter().min().unwrap(),
        EventType::Bo5 => *solves.iter().min().unwrap(),
    }
}

fn generate_histogram(
    hist_map: HashMap<i32, i32>,
    simulation_count: u32,
    event_type: EventType,
    is_single: bool,
) -> HashMap<i32, f64> {
    let min_needed = (HIST_INCLUDE_THRESHOLD * simulation_count as f64) as i32;

    let scale_amount = if is_single {
        100 / num_solves(event_type) as i32
    } else {
        100
    };

    hist_map
        .into_iter()
        .filter_map(|(k, v)| {
            if v < min_needed {
                None
            } else {
                Some((k, (v * scale_amount) as f64 / simulation_count as f64))
            }
        })
        .collect()
}

#[derive(Clone)]
struct SimulationAccumulator {
    wins: u32,
    pods: u32,
    rank_sum: u32,
    rank_counts: Vec<u32>,
    hist_single_counts: HashMap<i32, i32>,
    hist_average_counts: HashMap<i32, i32>,
}

pub fn run_simulations(
    competitors: &[Competitor],
    event_type: &EventType,
    include_dnf: bool,
    simulation_count: u32,
) -> Vec<SimulationResult> {
    let num_competitors = competitors.len();
    let mut rng = rand::rng();

    let mut accumulators: Vec<SimulationAccumulator> = vec![
        SimulationAccumulator {
            wins: 0,
            pods: 0,
            rank_sum: 0,
            rank_counts: vec![0; num_competitors],
            hist_single_counts: HashMap::new(),
            hist_average_counts: HashMap::new(),
        };
        num_competitors
    ];

    for _ in 0..simulation_count {
        let mut round_results: Vec<(usize, i32)> = Vec::with_capacity(num_competitors);

        for (idx, comp) in competitors.iter().enumerate() {
            let acc = &mut accumulators[idx];

            let res = simulate_round(
                comp,
                event_type,
                &mut rng,
                include_dnf,
                &mut acc.hist_single_counts,
            );

            if res != DNF_VALUE {
                *acc.hist_average_counts
                    .entry(truncate_num(res, matches!(event_type, EventType::Fmc)))
                    .or_default() += 1;
            }

            round_results.push((idx, res));
        }

        round_results.sort_unstable_by_key(|&(_, time)| time);

        for (rank, &(original_idx, _)) in round_results.iter().enumerate() {
            let acc = &mut accumulators[original_idx];

            if rank == 0 {
                acc.wins += 1;
            }
            if rank < 3 {
                acc.pods += 1;
            }
            acc.rank_sum += (rank as u32) + 1;
            acc.rank_counts[rank] += 1;
        }
    }

    accumulators
        .into_iter()
        .map(|acc| {
            let hist_single =
                generate_histogram(acc.hist_single_counts, simulation_count, *event_type, true);

            let hist_average = generate_histogram(
                acc.hist_average_counts,
                simulation_count,
                *event_type,
                false,
            );

            let rank_dist: Vec<f64> = acc
                .rank_counts
                .into_iter()
                .map(|c| c as f64 / simulation_count as f64)
                .collect();

            SimulationResult {
                win_chance: acc.wins as f64 / simulation_count as f64,
                pod_chance: acc.pods as f64 / simulation_count as f64,
                expected_ranks: acc.rank_sum as f64 / simulation_count as f64,
                rank_dist,
                hist_single,
                hist_average,
            }
        })
        .collect()
}

pub fn format_results(
    competitors: Vec<Competitor>,
    results: Vec<SimulationResult>,
    is_fmc: bool,
) -> SimulationEndpointResults {
    let hist_single_data = results
        .iter()
        .zip(&competitors)
        .map(|(res, competitor)| CompetitorHistData {
            name: &competitor.name,
            results: &res.hist_single,
        })
        .collect::<Vec<_>>();

    let full_histogram_single = create_full_histogram_chart(&hist_single_data, is_fmc, false);

    let hist_average_data = results
        .iter()
        .zip(&competitors)
        .map(|(res, competitor)| CompetitorHistData {
            name: &competitor.name,
            results: &res.hist_average,
        })
        .collect::<Vec<_>>();

    let full_histogram_average = create_full_histogram_chart(&hist_average_data, is_fmc, true);

    let full_histogram = FullHistogramChartData {
        single: full_histogram_single,
        average: full_histogram_average,
    };

    let rank_histogram_data = competitors
        .iter()
        .zip(&results)
        .map(|(c, res)| (c.name.as_str(), &res.rank_dist[..]))
        .collect::<Vec<_>>();

    let rank_histogram = generate_rank_chart(&rank_histogram_data);

    let competitor_results = competitors
        .into_iter()
        .zip(results)
        .map(|(comp, res)| {
            let stats = comp.stats.as_ref();

            let histogram =
                create_invidual_histogram_chart(&res.hist_single, &res.hist_average, is_fmc);

            CompetitorSimulationResult {
                id: comp.id,
                name: comp.name,
                expected_rank: res.expected_ranks,
                win_chance: res.win_chance,
                pod_chance: res.pod_chance,
                sample_size: stats.map(|s| s.num_non_dnf_results).unwrap_or(0),
                mean_no_dnf: stats.map(|s| s.mean as u32).unwrap_or(0),
                histogram,
            }
        })
        .collect();

    SimulationEndpointResults {
        competitor_results,
        full_histogram,
        rank_histogram,
    }
}
