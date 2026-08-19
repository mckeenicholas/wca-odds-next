use rand::prelude::*;
use rand_distr::Normal;

use super::results::SimulationResult;
use crate::utils::{
    charts::{HistogramAccumulator, RankAccumulator},
    competitor::{Competitor, CompetitorStats},
    wca::{DNF_VALUE, EventType, calculate_average},
};

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

fn generate_skewnorm_value(
    stats: &CompetitorStats,
    rng: &mut ThreadRng,
    normal: &Normal<f64>,
    include_dnf: bool,
) -> i32 {
    let invalid = [stats.location, stats.shape, stats.skew]
        .iter()
        .any(|&x| x.is_nan() || x.is_infinite());
    if invalid {
        return DNF_VALUE;
    }

    if include_dnf && rng.random::<f32>() < stats.dnf_rate {
        return DNF_VALUE;
    }

    let u0 = normal.sample(rng) as f32;
    let v = normal.sample(rng) as f32;

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
    normal: &Normal<f64>,
    include_dnf: bool,
    acc: &mut CompetitorAccumulator,
) -> (i32, i32) {
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
            let val = generate_skewnorm_value(stats, rng, normal, include_dnf);

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
    let normal = Normal::new(0.0, 1.0).expect("Failed to init normal dist");

    let mut accumulators: Vec<CompetitorAccumulator> = (0..num_competitors)
        .map(|_| CompetitorAccumulator::new(num_competitors))
        .collect();

    for _ in 0..simulation_count {
        let mut round_results: Vec<(usize, i32, i32)> = Vec::with_capacity(num_competitors);

        for (idx, comp) in competitors.iter().enumerate() {
            let acc = &mut accumulators[idx];

            let (avg, best) = simulate_round(comp, event_type, &mut rng, &normal, include_dnf, acc);

            if avg != DNF_VALUE {
                acc.record_average(avg, event_type.is_fmc());
            }

            round_results.push((idx, avg, best));
        }

        round_results.sort_unstable_by_key(|&(_, avg, best)| (avg, best));

        let mut rank = 0;
        for (i, &(original_idx, avg, best)) in round_results.iter().enumerate() {
            if i > 0 {
                let (_, prev_avg, prev_best) = round_results[i - 1];
                if avg != prev_avg || best != prev_best {
                    rank = i;
                }
            }
            accumulators[original_idx].add_rank(rank);
        }
    }

    accumulators
        .into_iter()
        .map(|acc| acc.finalize(simulation_count, event_type))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simulation_tie_ranking() {
        // Create competitors with specific entered_results to test tie-breaker scenarios.
        // We will run simulations with 1 count, so results are exact and deterministic.

        // Competitor A: Ao5 solves = [1000, 1000, 1000, 1000, 1000] -> Avg = 1000, Best = 1000
        let comp_a = Competitor {
            name: "A".to_string(),
            id: "2026A".to_string(),
            country_iso2: "US".to_string(),
            entered_results: vec![1000, 1000, 1000, 1000, 1000],
            stats: None,
        };

        // Competitor B: Ao5 solves = [900, 1000, 1000, 1000, 1100] -> Avg = 1000, Best = 900
        // (Ao5 drops 900 and 1100, leaving 1000, 1000, 1000 -> avg = 1000, best = 900)
        let comp_b = Competitor {
            name: "B".to_string(),
            id: "2026B".to_string(),
            country_iso2: "US".to_string(),
            entered_results: vec![900, 1000, 1000, 1000, 1100],
            stats: None,
        };

        // Competitor C: Ao5 solves = [950, 1050, 1050, 1050, 1150] -> Avg = 1050, Best = 950
        let comp_c = Competitor {
            name: "C".to_string(),
            id: "2026C".to_string(),
            country_iso2: "US".to_string(),
            entered_results: vec![950, 1050, 1050, 1050, 1150],
            stats: None,
        };

        // Competitor D: Ao5 solves = [900, 1000, 1000, 1000, 1100] -> Avg = 1000, Best = 900 (Identical to B)
        let comp_d = Competitor {
            name: "D".to_string(),
            id: "2026D".to_string(),
            country_iso2: "US".to_string(),
            entered_results: vec![900, 1000, 1000, 1000, 1100],
            stats: None,
        };

        let competitors = vec![comp_a, comp_b, comp_c, comp_d];
        let event_type = EventType::Ao5;

        // Run 1 simulation
        let results = run_simulations(&competitors, &event_type, false, 1);

        // Under WCA tie-breaker rules:
        // - B and D have Avg = 1000, Best = 900
        // - A has Avg = 1000, Best = 1000
        // - C has Avg = 1050, Best = 950
        // Expected ordering:
        // Rank 0: B and D (tied, since their averages are 1000 and bests are 900)
        // Rank 2: A (Avg = 1000, but Best = 1000 which is worse than 900)
        // Rank 3: C (Avg = 1050, which is worse than 1000)
        //
        // Let's verify the ranks recorded (probabilities[0] should correspond to rank 0, probabilities[2] to rank 2, etc.)

        // Competitor B (index 1) and D (index 3) should have rank 0 (100% win probability)
        assert_eq!(results[1].win_probability(), 1.0);
        assert_eq!(results[3].win_probability(), 1.0);

        // Competitor A (index 0) should have rank 2 (100% probability for rank 2, i.e., third place 0-indexed rank 2)
        assert_eq!(results[0].rank_stats().as_slice()[2], 1.0);

        // Competitor C (index 2) should have rank 3 (100% probability for rank 3, i.e., fourth place 0-indexed rank 3)
        assert_eq!(results[2].rank_stats().as_slice()[3], 1.0);
    }
}
