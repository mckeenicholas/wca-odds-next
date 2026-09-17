use rand::{prelude::*, rngs::SmallRng};
use rand_distr::{Distribution, Normal};

use super::results::SimulationResult;
use crate::utils::{
    charts::{HistogramAccumulator, HistogramData, RankAccumulator},
    competitor::{Competitor, CompetitorStats},
    wca::{DNF_VALUE, EventType, calculate_average},
};

const HIST_INCLUDE_THRESHOLD: f64 = 0.0001;

struct CompetitorAccumulator {
    hist_single: Option<HistogramAccumulator>,
    hist_average: Option<HistogramAccumulator>,
    ranks: RankAccumulator,
}

impl CompetitorAccumulator {
    fn new(num_competitors: usize, record_histograms: bool) -> Self {
        Self {
            hist_single: if record_histograms {
                Some(HistogramAccumulator::new())
            } else {
                None
            },
            hist_average: if record_histograms {
                Some(HistogramAccumulator::new())
            } else {
                None
            },
            ranks: RankAccumulator::new(num_competitors),
        }
    }

    fn record_single(&mut self, solve: i32, is_fmc: bool) {
        if let Some(hist) = &mut self.hist_single {
            let hist_value = Self::truncate_for_histogram(solve, is_fmc);
            hist.record(hist_value);
        }
    }

    fn record_average(&mut self, solve: i32, is_fmc: bool) {
        if let Some(hist) = &mut self.hist_average {
            let hist_value = Self::truncate_for_histogram(solve, is_fmc);
            hist.record(hist_value);
        }
    }

    fn add_rank(&mut self, rank: usize) {
        self.ranks.record_rank(rank);
    }

    fn finalize(self, simulation_count: u32, event_type: EventType) -> SimulationResult {
        let single_scale = 100 / event_type.num_solves() as i32;

        SimulationResult::new(
            self.ranks.into_rank_stats(simulation_count),
            self.hist_single.map_or_else(HistogramData::default, |h| {
                h.into_histogram_data(simulation_count, single_scale, HIST_INCLUDE_THRESHOLD)
            }),
            self.hist_average.map_or_else(HistogramData::default, |h| {
                h.into_histogram_data(simulation_count, 100, HIST_INCLUDE_THRESHOLD)
            }),
        )
    }

    fn truncate_for_histogram(input: i32, is_fmc: bool) -> i32 {
        if is_fmc { input } else { (input / 10) * 10 }
    }
}

fn generate_skewnorm_value(
    stats: &CompetitorStats,
    rng: &mut SmallRng,
    normal: Normal<f32>,
    include_dnf: bool,
) -> i32 {
    if !stats.is_valid {
        return DNF_VALUE;
    }

    if include_dnf && stats.dnf_rate > 0.0 && rng.random::<f32>() < stats.dnf_rate {
        return DNF_VALUE;
    }

    let u0 = normal.sample(rng);
    let v = normal.sample(rng);

    let u1 = stats.delta.mul_add(u0, stats.delta_factor * v);
    let z = if u0 >= 0.0 { u1 } else { -u1 };

    let result = z.mul_add(stats.shape, stats.location);
    (result as i32).max(1)
}

#[derive(Clone, Copy)]
struct PreparedCompetitor {
    stats: Option<CompetitorStats>,
    manual_results: [i32; 5],
    has_manual_results: bool,
}

impl PreparedCompetitor {
    pub fn from_competitor(c: &Competitor) -> Self {
        let mut manual_results = [0; 5];
        let mut has_manual_results = false;

        for (slot, &res) in manual_results.iter_mut().zip(&c.entered_results) {
            if res != 0 {
                *slot = if res < 0 { DNF_VALUE } else { res };
                has_manual_results = true;
            }
        }

        Self {
            stats: c.stats,
            manual_results,
            has_manual_results,
        }
    }
}

fn simulate_round(
    competitor: &PreparedCompetitor,
    event_type: EventType,
    rng: &mut SmallRng,
    normal: Normal<f32>,
    include_dnf: bool,
    acc: &mut CompetitorAccumulator,
    record_histograms: bool,
) -> (i32, i32) {
    let count = event_type.num_solves();
    let mut solves = [DNF_VALUE; 5];
    let is_fmc = event_type.is_fmc();

    if competitor.has_manual_results {
        for (i, solve_slot) in solves.iter_mut().take(count).enumerate() {
            let manual_time = competitor.manual_results[i];
            if manual_time != 0 {
                *solve_slot = manual_time;
            } else if let Some(stats) = &competitor.stats {
                let val = generate_skewnorm_value(stats, rng, normal, include_dnf);
                let solve = if is_fmc { val * 100 } else { val };
                *solve_slot = solve;
                if record_histograms && val < DNF_VALUE {
                    acc.record_single(solve, is_fmc);
                }
            }
        }
    } else if let Some(stats) = &competitor.stats {
        for solve_slot in solves.iter_mut().take(count) {
            let val = generate_skewnorm_value(stats, rng, normal, include_dnf);
            let solve = if is_fmc { val * 100 } else { val };
            *solve_slot = solve;
            if record_histograms && val < DNF_VALUE {
                acc.record_single(solve, is_fmc);
            }
        }
    }

    calculate_average(&solves, event_type)
}

/// Encapsulates a competitor's round result (average and best single) bit-packed into a `u64`.
///
/// High 32 bits: `average` (primary ranking criterion)
/// Low 32 bits: `best` single (tie-breaker criterion)
///
/// Because all official WCA results and `DNF_VALUE` are non-negative integers fitting in `u32`,
/// the natural ordering of `u64` matches official WCA tie-break rules with zero branching overhead.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
#[repr(transparent)]
struct CompetitorScore(u64);

impl CompetitorScore {
    #[inline(always)]
    fn new(average: i32, best: i32) -> Self {
        Self(((average as u64) << 32) | (best.cast_unsigned() as u64))
    }
}

#[derive(Debug, Clone, Copy)]
struct RoundEntry {
    score: CompetitorScore,
    idx: usize,
}

pub fn run_simulations(
    competitors: &[Competitor],
    event_type: EventType,
    include_dnf: bool,
    simulation_count: u32,
    record_histograms: bool,
) -> Vec<SimulationResult> {
    let num_competitors = competitors.len();
    let mut rng = SmallRng::from_rng(&mut rand::rng());
    let normal = Normal::new(0.0f32, 1.0f32).expect("Failed to init normal dist");
    let is_fmc = event_type.is_fmc();

    let prepared: Vec<PreparedCompetitor> = competitors
        .iter()
        .map(PreparedCompetitor::from_competitor)
        .collect();

    let mut accumulators: Vec<CompetitorAccumulator> = (0..num_competitors)
        .map(|_| CompetitorAccumulator::new(num_competitors, record_histograms))
        .collect();
    let mut round_results = Vec::with_capacity(num_competitors);

    for _ in 0..simulation_count {
        round_results.clear();

        for (idx, (comp, acc)) in prepared.iter().zip(&mut accumulators).enumerate() {
            let (avg, best) = simulate_round(
                comp,
                event_type,
                &mut rng,
                normal,
                include_dnf,
                acc,
                record_histograms,
            );

            if record_histograms && avg != DNF_VALUE {
                acc.record_average(avg, is_fmc);
            }

            round_results.push(RoundEntry {
                score: CompetitorScore::new(avg, best),
                idx,
            });
        }

        round_results.sort_unstable_by_key(|entry| entry.score);

        // Track running rank to handle tied scores correctly
        if let Some(first) = round_results.first() {
            let mut current_rank = 0;
            let mut prev_score = first.score;
            for (i, entry) in round_results.iter().enumerate() {
                if entry.score != prev_score {
                    current_rank = i;
                    prev_score = entry.score;
                }
                accumulators[entry.idx].add_rank(current_rank);
            }
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
        let results = run_simulations(&competitors, event_type, false, 1, true);

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

    #[test]
    fn test_simulation_with_manual_dnf() {
        // Competitor with manual DNF solve: -1 is converted to DNF_VALUE
        let comp_dnf = Competitor {
            name: "DNFer".to_string(),
            id: "2026DNF1".to_string(),
            country_iso2: "US".to_string(),
            entered_results: vec![-1, -1, 1000, 1000, 1000],
            stats: None,
        };
        let comp_clean = Competitor {
            name: "Clean".to_string(),
            id: "2026CLN1".to_string(),
            country_iso2: "US".to_string(),
            entered_results: vec![1200, 1200, 1200, 1200, 1200],
            stats: None,
        };

        let competitors = vec![comp_dnf, comp_clean];
        let results = run_simulations(&competitors, EventType::Ao5, false, 1, true);

        // comp_dnf has 2 DNFs in Ao5 -> DNF average. comp_clean has 1200 avg.
        // comp_clean should win (rank 0), comp_dnf should be rank 1.
        assert_eq!(results[1].win_probability(), 1.0);
        assert_eq!(results[0].win_probability(), 0.0);
    }

    #[test]
    fn test_simulation_with_stats_generation() {
        let stats = CompetitorStats::new(1000.0, 50.0, 0.0, 0.0, 1000.0, 100);

        let comp = Competitor {
            name: "StatCompetitor".to_string(),
            id: "2026STAT".to_string(),
            country_iso2: "US".to_string(),
            entered_results: vec![],
            stats: Some(stats),
        };

        let results = run_simulations(&[comp], EventType::Ao5, false, 100, true);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].win_probability(), 1.0); // Only 1 competitor, so 100% win
        assert!(results[0].average_histogram().key_range().is_some());
    }

    #[test]
    fn test_simulation_fmc_scaling() {
        let comp_fmc1 = Competitor {
            name: "FMC1".to_string(),
            id: "2026FMC1".to_string(),
            country_iso2: "US".to_string(),
            entered_results: vec![2500, 2600, 2700], // 25, 26, 27 moves -> avg = 2600
            stats: None,
        };
        let comp_fmc2 = Competitor {
            name: "FMC2".to_string(),
            id: "2026FMC2".to_string(),
            country_iso2: "US".to_string(),
            entered_results: vec![2800, 2900, 3000], // 28, 29, 30 moves -> avg = 2900
            stats: None,
        };

        let results = run_simulations(&[comp_fmc1, comp_fmc2], EventType::Fmc, false, 1, true);
        assert_eq!(results[0].win_probability(), 1.0);
        assert_eq!(results[1].win_probability(), 0.0);
    }
}
