use crate::utils::charts::{
    CompetitorHistData, create_full_histogram_chart, create_invidual_histogram_chart,
    generate_rank_chart,
};
use crate::utils::types::{FullHistogramChartData, SimulationEndpointResults};

use super::competitor::Competitor;
use super::constants::*;
use super::types::{CompetitorSimulationResult, CompetitorStats, EventType};

use itertools::izip;
use rand::prelude::*;
use rand_distr::Normal;
use std::collections::HashMap;

const HIST_INCLUDE_THRESHOLD: f64 = 0.0001; // This is the max resolution we show on the charts.

fn truncate_num(input: i32, is_fmc: bool) -> i32 {
    if is_fmc { input } else { (input / 10) * 10 }
}

/// Result type for simulation runs containing all computed statistics
pub struct SimulationResults {
    pub win_chance: Vec<f64>,
    pub pod_chance: Vec<f64>,
    pub expected_ranks: Vec<f64>,
    pub rank_dists: Vec<Vec<f64>>,
    pub hist_singles: Vec<HashMap<i32, f64>>,
    pub hist_averages: Vec<HashMap<i32, f64>>,
}

pub fn generate_skewnorm_value(
    stats: &CompetitorStats,
    rng: &mut ThreadRng,
    include_dnf: bool,
) -> i32 {
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

pub fn num_solves(event_type: EventType) -> usize {
    match event_type {
        EventType::Ao5 => AO5_SOLVE_COUNT,
        EventType::Bo5 => BO5_SOLVE_COUNT,
        EventType::Mo3 => MO3_SOLVE_COUNT,
        EventType::Fmc => MO3_SOLVE_COUNT,
        EventType::Bo3 => BO3_SOLVE_COUNT,
    }
}

pub fn simulate_round(
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
    hist_map: Vec<HashMap<i32, i32>>,
    simulation_count: u32,
    event_type: EventType,
    is_single: bool,
) -> Vec<HashMap<i32, f64>> {
    let min_needed = (HIST_INCLUDE_THRESHOLD * simulation_count as f64) as i32;

    let scale_amount = if is_single {
        100 / num_solves(event_type) as i32
    } else {
        100
    };

    hist_map
        .into_iter()
        .map(|m| {
            m.into_iter()
                .filter_map(|(k, v)| {
                    if v < min_needed {
                        None
                    } else {
                        Some((k, (v * scale_amount) as f64 / simulation_count as f64)) // Multiply by 100 to convert to percent
                    }
                })
                .collect()
        })
        .collect()
}

pub fn run_simulations(
    competitors: &[Competitor],
    event_type: &EventType,
    include_dnf: bool,
    simulation_count: u32,
) -> SimulationResults {
    let num_competitors = competitors.len();

    // Output structures
    let mut win_counts = vec![0u32; num_competitors];
    let mut pod_counts = vec![0u32; num_competitors];
    let mut total_ranks = vec![0u32; num_competitors];
    let mut rank_dist_count = vec![vec![0u32; num_competitors]; num_competitors];
    let mut hist_average_map: Vec<HashMap<i32, i32>> = vec![HashMap::new(); num_competitors];
    let mut hist_single_map: Vec<HashMap<i32, i32>> = vec![HashMap::new(); num_competitors];

    let mut rng = rand::rng();

    for _ in 0..simulation_count {
        // Run one round for everyone
        let mut round_results: Vec<(usize, i32)> = competitors
            .iter()
            .enumerate()
            .map(|(idx, comp)| {
                let res = simulate_round(
                    comp,
                    event_type,
                    &mut rng,
                    include_dnf,
                    &mut hist_single_map[idx],
                );

                // Add to AVERAGE histogram
                if res != DNF_VALUE {
                    *hist_average_map[idx]
                        .entry(truncate_num(res, matches!(event_type, EventType::Fmc)))
                        .or_default() += 1;
                }

                (idx, res)
            })
            .collect();

        // Sort to determine ranks (Low time wins)
        round_results.sort_unstable_by_key(|&(_, time)| time);

        // Update Stats
        for (rank, &(original_idx, _)) in round_results.iter().enumerate() {
            if rank == 0 {
                win_counts[original_idx] += 1;
            }
            if rank < 3 {
                pod_counts[original_idx] += 1;
            }
            total_ranks[original_idx] += (rank as u32) + 1;
            rank_dist_count[original_idx][rank] += 1;
        }
    }

    let rank_dists = rank_dist_count
        .into_iter()
        .map(|counts| {
            counts
                .into_iter()
                .map(|v| v as f64 / simulation_count as f64)
                .collect()
        })
        .collect();

    let hist_singles = generate_histogram(hist_single_map, simulation_count, *event_type, true);
    let hist_averages = generate_histogram(hist_average_map, simulation_count, *event_type, false);

    SimulationResults {
        win_chance: win_counts
            .into_iter()
            .map(|v| v as f64 / simulation_count as f64)
            .collect(),
        pod_chance: pod_counts
            .into_iter()
            .map(|v| v as f64 / simulation_count as f64)
            .collect(),
        expected_ranks: total_ranks
            .into_iter()
            .map(|v| v as f64 / simulation_count as f64)
            .collect(),
        rank_dists,
        hist_singles,
        hist_averages,
    }
}

pub fn format_results(
    competitors: Vec<Competitor>,
    results: SimulationResults,
    is_fmc: bool,
) -> SimulationEndpointResults {
    let SimulationResults {
        win_chance,
        pod_chance,
        expected_ranks,
        rank_dists,
        hist_singles,
        hist_averages,
    } = results;

    let hist_single_data = hist_singles
        .iter()
        .zip(&competitors)
        .map(|(results, competitor)| CompetitorHistData {
            name: &competitor.name,
            results,
        })
        .collect::<Vec<_>>();

    let full_histogram_single = create_full_histogram_chart(&hist_single_data, is_fmc, false);

    let hist_average_data = hist_averages
        .iter()
        .zip(&competitors)
        .map(|(results, competitor)| CompetitorHistData {
            name: &competitor.name,
            results,
        })
        .collect::<Vec<_>>();

    let full_histogram_average = create_full_histogram_chart(&hist_average_data, is_fmc, true);

    let full_histogram = FullHistogramChartData {
        single: full_histogram_single,
        average: full_histogram_average,
    };

    let rank_histogram_data = competitors
        .iter()
        .zip(&rank_dists)
        .map(|(c, rd)| (c.name.as_str(), rd.as_slice()))
        .collect::<Vec<_>>();

    let rank_histogram = generate_rank_chart(&rank_histogram_data);

    let competitor_results = izip!(
        competitors,
        expected_ranks,
        win_chance,
        pod_chance,
        &hist_singles,
        &hist_averages
    )
    .map(|(comp, exp_rank, win, pod, h_single, h_avg)| {
        let stats = comp.stats.as_ref();

        let histogram = create_invidual_histogram_chart(h_single, h_avg, is_fmc);

        CompetitorSimulationResult {
            id: comp.id,
            name: comp.name,
            expected_rank: exp_rank,
            win_chance: win,
            pod_chance: pod,
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
