use super::competitor::Competitor;
use super::constants::*;
use super::types::{CompetitorSimulationResult, CompetitorStats, EventType};
use rand::prelude::*;
use rand_distr::Normal;
use std::collections::HashMap;

/// Result type for simulation runs containing all computed statistics
pub struct SimulationResults {
    pub win_chance: Vec<f64>,
    pub pod_chance: Vec<f64>,
    pub expected_ranks: Vec<f64>,
    pub rank_dists: Vec<Vec<f64>>,
    pub hist_singles: Vec<Vec<(i32, f64)>>,
    pub hist_averages: Vec<Vec<(i32, f64)>>,
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

pub fn simulate_round(
    competitor: &Competitor,
    event_type: &EventType,
    rng: &mut ThreadRng,
    include_dnf: bool,
    hist_single: &mut HashMap<i32, i32>,
) -> i32 {
    let count = match event_type {
        EventType::Ao5 => AO5_SOLVE_COUNT,
        EventType::Bo5 => BO5_SOLVE_COUNT,
        EventType::Mo3 => MO3_SOLVE_COUNT,
        EventType::Bo3 => BO3_SOLVE_COUNT,
    };

    let mut solves = [DNF_VALUE; 5];

    for (i, solve) in solves.iter_mut().take(count).enumerate() {
        // 1. Check for manual entry (PRE-ENTERED)
        let manual_time = competitor.entered_results.get(i).copied().unwrap_or(0);

        // 1. Check for VALID manual entry (Must be non-zero)
        if manual_time != 0 {
            // Logic: Pre-entered times are NOT added to hist_single
            *solve = if manual_time < 0 {
                DNF_VALUE
            } else {
                manual_time
            };
        }
        // 2. Generate from stats (Only runs if manual_time is 0)
        else if let Some(stats) = &competitor.stats {
            let val = generate_skewnorm_value(stats, rng, include_dnf);

            *solve = val;

            // Logic: Only add if generated AND not DNF
            if val < DNF_VALUE {
                *hist_single.entry(val / 10).or_default() += 1;
            }
        }
    }

    // Calculate result based on event type
    match event_type {
        EventType::Ao5 => {
            solves.sort_unstable();
            if solves[3] >= DNF_VALUE {
                DNF_VALUE
            } else {
                let sum: i64 = (solves[1] as i64) + (solves[2] as i64) + (solves[3] as i64);
                (sum / 3) as i32
            }
        }
        EventType::Mo3 => {
            let active_solves = &solves[..3];
            if active_solves.iter().any(|&x| x >= DNF_VALUE) {
                DNF_VALUE
            } else {
                let sum: i64 = active_solves.iter().map(|&x| x as i64).sum();
                (sum / 3) as i32
            }
        }
        EventType::Bo3 => *solves[..3].iter().min().unwrap(),
        EventType::Bo5 => *solves.iter().min().unwrap(),
    }
}

fn generate_histogram(
    hist_map: Vec<HashMap<i32, i32>>,
    simulation_count: u32,
) -> Vec<Vec<(i32, f64)>> {
    hist_map
        .into_iter()
        .map(|m| {
            let mut vec: Vec<(i32, f64)> = m
                .into_iter()
                .map(|(k, v)| (k, v as f64 / simulation_count as f64))
                .collect();
            vec.sort_unstable_by_key(|(k, _)| *k);
            vec
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
                if res < DNF_VALUE {
                    *hist_average_map[idx].entry(res / 10).or_insert(0) += 1;
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

    let hist_singles = generate_histogram(hist_single_map, simulation_count);
    let hist_averages = generate_histogram(hist_average_map, simulation_count);

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
) -> Vec<CompetitorSimulationResult> {
    // Destructure everything for flat access
    let SimulationResults {
        win_chance,
        pod_chance,
        expected_ranks,
        rank_dists,
        hist_singles,
        hist_averages,
    } = results;

    // We use enumerate to index into the other vectors,
    // which is much cleaner than chaining .zip().zip().zip()
    competitors
        .into_iter()
        .enumerate()
        .map(|(i, comp)| {
            let stats = comp.stats.as_ref();

            CompetitorSimulationResult {
                id: comp.id,
                name: comp.name,
                expected_rank: expected_ranks[i],
                win_chance: win_chance[i],
                pod_chance: pod_chance[i],
                sample_size: stats.map(|s| s.num_non_dnf_results).unwrap_or(0),
                mean_no_dnf: stats.map(|s| s.mean as u32).unwrap_or(0),
                rank_dist: rank_dists[i].clone(),
                hist_values_single: hist_singles[i].clone(),
                hist_values_average: hist_averages[i].clone(),
            }
        })
        .collect()
}
