use super::statistics::{self, SkewNormParams, WeightedStats};

#[derive(Debug, Clone)]
pub struct DatedCompetitionResult {
    pub days_since: i32,
    pub results: Vec<i32>,
}

#[derive(Debug)]
pub struct CompetitorStats {
    /// Location parameter (xi) from skew-normal fit
    pub location: f32,
    /// Scale/shape parameter (omega) from skew-normal fit
    pub shape: f32,
    /// Skewness parameter (alpha) from skew-normal fit
    pub skew: f32,
    /// Rate of DNF results (0.0 to 1.0)
    pub dnf_rate: f32,
    /// Weighted mean of non-DNF times
    pub mean: f32,
    /// Number of non-DNF results used in the calculation
    pub num_non_dnf_results: u32,
}

#[derive(Debug)]
pub struct Competitor {
    pub name: String,
    pub id: String,
    pub entered_results: Vec<i32>,
    pub stats: Option<CompetitorStats>,
}

impl Competitor {
    pub fn new(
        name: String,
        id: String,
        results: Vec<DatedCompetitionResult>,
        halflife: f32,
    ) -> Self {
        let stats = Self::calculate_stats(&results, halflife);
        Self {
            name,
            id,
            entered_results: vec![],
            stats,
        }
    }

    pub fn calculate_stats(
        results: &[DatedCompetitionResult],
        halflife: f32,
    ) -> Option<CompetitorStats> {
        let weighted = Self::apply_weights(results, halflife);
        if weighted.is_empty() {
            return None;
        }

        let (dnf_sum, total_w) = weighted.iter().fold((0.0, 0.0), |(dnf, w_sum), &(val, w)| {
            if val < 0 {
                (dnf + w, w_sum + w)
            } else {
                (dnf, w_sum + w)
            }
        });

        let dnf_rate = if total_w > 0.0 {
            dnf_sum / total_w
        } else {
            0.0
        };

        let valid_times: Vec<(i32, f32)> =
            weighted.into_iter().filter(|&(val, _)| val > 0).collect();
        if valid_times.is_empty() {
            return None;
        }

        let num_non_dnf_results = valid_times.len() as u32;
        let stats: WeightedStats = statistics::calc_weighted_stats(&valid_times);
        let trimmed = statistics::trim_outliers(valid_times, &stats);
        let params: SkewNormParams = statistics::fit_weighted_skewnorm(&trimmed);

        Some(CompetitorStats {
            location: params.xi,
            shape: params.omega,
            skew: params.alpha,
            dnf_rate,
            mean: stats.mean,
            num_non_dnf_results,
        })
    }

    fn apply_weights(results: &[DatedCompetitionResult], halflife: f32) -> Vec<(i32, f32)> {
        let decay_rate = std::f32::consts::LN_2 / halflife;
        let mut weighted = Vec::new();
        for set in results {
            // Formula: e^(-decay * days)
            let weight = (-decay_rate * set.days_since as f32).exp();
            for &time in &set.results {
                weighted.push((time, weight));
            }
        }
        weighted
    }
}
