use super::calc;
use super::types::{CompetitorStats, DatedCompetitionResult};

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

        // Filter valid times for distribution fitting
        let valid_times: Vec<(i32, f32)> =
            weighted.into_iter().filter(|&(val, _)| val > 0).collect();
        if valid_times.is_empty() {
            return None;
        }

        let num_non_dnf_results = valid_times.len() as u32;
        let (mean, _, stdev) = calc::calc_weighted_stats(&valid_times);
        let trimmed = calc::trim_outliers(valid_times, mean, stdev);
        let (skew, shape, location) = calc::fit_weighted_skewnorm(&trimmed);

        Some(CompetitorStats {
            location,
            shape,
            skew,
            dnf_rate,
            mean,
            // stdev,
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

    // Bounds for histogram generation
    // pub fn get_hist_bounds(&self) -> (i32, i32) {
    //     if let Some(s) = &self.stats {
    //         let min = ((s.mean - s.stdev * 4.0) / 10.0) as i32;
    //         let max = ((s.mean + s.stdev * 4.0) / 10.0) as i32;
    //         (min, max)
    //     } else {
    //         (i32::MAX, 0)
    //     }
    // }
}
