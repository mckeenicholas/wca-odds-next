use std::f32::consts::PI;

// Max skew for a skew-normal distribution derived from Azzalini's skew-normal distribution properties.
const MAX_SKEW_LIMIT: f32 = 0.99527;

/// Weighted statistics result with named fields for clarity. #[derive(Debug, Clone, Copy)]
pub struct WeightedStats {
    pub mean: f32,
    pub variance: f32,
    pub stdev: f32,
}

impl Default for WeightedStats {
    fn default() -> Self {
        Self {
            mean: 0.0,
            variance: 0.0,
            stdev: 0.0,
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub struct SkewNormParams {
    /// Skewness parameter (alpha) - controls the asymmetry
    pub alpha: f32,
    /// Scale/shape parameter (omega) - controls the spread
    pub omega: f32,
    /// Location parameter (xi) - controls the center
    pub xi: f32,
}

impl Default for SkewNormParams {
    fn default() -> Self {
        Self {
            alpha: 0.0,
            omega: 1.0,
            xi: 0.0,
        }
    }
}

pub fn calc_weighted_stats(data: &[(i32, f32)]) -> WeightedStats {
    if data.is_empty() {
        return WeightedStats::default();
    }

    let total_weight: f32 = data.iter().map(|(_, w)| *w).sum();
    if total_weight <= 0.0 {
        return WeightedStats::default();
    }

    let weighted_sum: f32 = data.iter().map(|&(val, w)| val as f32 * w).sum();
    let mean = weighted_sum / total_weight;

    let weighted_sq_diff: f32 = data
        .iter()
        .map(|&(val, w)| w * (val as f32 - mean).powi(2))
        .sum();

    let variance = if data.len() > 1 {
        let effective_n = total_weight.powi(2) / data.iter().map(|(_, w)| w.powi(2)).sum::<f32>();
        weighted_sq_diff / (total_weight * (effective_n - 1.0) / effective_n)
    } else {
        0.0
    };

    WeightedStats {
        mean,
        variance,
        stdev: variance.sqrt(),
    }
}

/// Fit a skew-normal distribution to weighted data using method of moments.
pub fn fit_weighted_skewnorm(data: &[(i32, f32)]) -> SkewNormParams {
    let stats = calc_weighted_stats(data);
    if stats.stdev == 0.0 {
        return SkewNormParams {
            alpha: 0.0,
            omega: 1.0,
            xi: stats.mean,
        };
    }

    let total_weight: f32 = data.iter().map(|(_, w)| *w).sum();
    let weighted_skewness = data
        .iter()
        .map(|&(val, w)| w * ((val as f32 - stats.mean) / stats.stdev).powi(3))
        .sum::<f32>()
        / total_weight;

    // Constants for skew normal approximation
    let max_skew =
        MAX_SKEW_LIMIT * ((4.0 - PI).sqrt() * (2.0 / PI).sqrt() * (1.0 - 2.0 / PI).powf(-1.5));
    let bounded_skew = weighted_skewness.clamp(-max_skew, max_skew);

    let delta_term = (PI / 2.0) * bounded_skew.abs().powf(2.0 / 3.0)
        / (bounded_skew.abs().powf(2.0 / 3.0) + ((4.0 - PI) / 2.0).powf(2.0 / 3.0));

    let delta = bounded_skew.signum() * delta_term.sqrt().clamp(-MAX_SKEW_LIMIT, MAX_SKEW_LIMIT);
    let alpha = delta / (1.0 - delta.powi(2)).sqrt();
    let omega = (stats.variance / (1.0 - 2.0 * delta.powi(2) / PI)).sqrt();
    let xi = stats.mean - omega * delta * (2.0 / PI).sqrt();

    SkewNormParams { alpha, omega, xi }
}

/// Remove outliers beyond 2 standard deviations from the mean.
pub fn trim_outliers(data: Vec<(i32, f32)>, stats: &WeightedStats) -> Vec<(i32, f32)> {
    let threshold = (stats.mean + stats.stdev * 2.0) as i32;
    data.into_iter()
        .filter(|&(val, _)| val <= threshold)
        .collect()
}
