use super::statistics::{
    SkewNormParams, WeightedStats, {self},
};

#[derive(Debug, Clone)]
pub struct DatedCompetitionResult {
    pub days_since: i32,
    pub results: Vec<i32>,
}

#[derive(Debug, Clone)]
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

#[derive(Debug, Clone)]
pub struct Competitor {
    pub name: String,
    pub id: String,
    pub country_iso2: String,
    pub entered_results: Vec<i32>,
    pub stats: Option<CompetitorStats>,
}

impl Competitor {
    pub fn new(
        name: String,
        id: String,
        country_iso2: String,
        results: Vec<DatedCompetitionResult>,
        halflife: f32,
    ) -> Self {
        let stats = Self::calculate_stats(&results, halflife);
        Self {
            name,
            id,
            country_iso2,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_competitor_empty_results() {
        let comp = Competitor::new(
            "Test Person".to_string(),
            "2020TEST01".to_string(),
            "US".to_string(),
            vec![],
            30.0,
        );
        assert_eq!(comp.name, "Test Person");
        assert_eq!(comp.id, "2020TEST01");
        assert_eq!(comp.country_iso2, "US");
        assert!(comp.entered_results.is_empty());
        assert!(comp.stats.is_none());
    }

    #[test]
    fn test_competitor_all_dnf() {
        let results = vec![DatedCompetitionResult {
            days_since: 0,
            results: vec![-1, -1, -1],
        }];
        let comp = Competitor::new(
            "Test Person".to_string(),
            "2020TEST01".to_string(),
            "US".to_string(),
            results,
            30.0,
        );
        assert!(comp.stats.is_none());
    }

    #[test]
    fn test_competitor_stats_calculation() {
        let results = vec![
            DatedCompetitionResult {
                days_since: 0,
                results: vec![1000, 1100, 900],
            },
            DatedCompetitionResult {
                days_since: 30,
                results: vec![1200, -1], // -1 is DNF
            },
        ];
        let comp = Competitor::new(
            "Test Person".to_string(),
            "2020TEST01".to_string(),
            "US".to_string(),
            results,
            30.0, // halflife = 30 days
        );

        assert!(comp.stats.is_some());
        let stats = comp.stats.unwrap();

        // 4 non-DNF results
        assert_eq!(stats.num_non_dnf_results, 4);
        // DNF rate: at day 0, weights are 1.0 (total 3.0). At day 30, weights are 0.5 (total 1.0: 0.5 valid, 0.5 DNF).
        // Total weight = 3.0 + 1.0 = 4.0. DNF weight = 0.5. dnf_rate = 0.5 / 4.0 = 0.125
        assert!((stats.dnf_rate - 0.125).abs() < 1e-4);
        assert!(stats.mean > 0.0);
        assert!(!stats.location.is_nan());
        assert!(!stats.shape.is_nan());
        assert!(!stats.skew.is_nan());
    }

    #[test]
    fn test_apply_weights_halflife() {
        let results = vec![
            DatedCompetitionResult {
                days_since: 0,
                results: vec![1000],
            },
            DatedCompetitionResult {
                days_since: 60,
                results: vec![2000],
            },
        ];
        let weighted = Competitor::apply_weights(&results, 60.0);
        assert_eq!(weighted.len(), 2);
        assert_eq!(weighted[0].0, 1000);
        assert!((weighted[0].1 - 1.0).abs() < 1e-4);
        assert_eq!(weighted[1].0, 2000);
        // At 1 halflife, weight should be exactly 0.5
        assert!((weighted[1].1 - 0.5).abs() < 1e-4);
    }
}
