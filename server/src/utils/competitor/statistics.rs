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
        if effective_n > 1.001 {
            weighted_sq_diff / (total_weight * (effective_n - 1.0) / effective_n)
        } else {
            0.0
        }
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
    if data.len() <= 1 || stats.stdev == 0.0 {
        return data;
    }

    let threshold = (stats.mean + stats.stdev * 2.0) as i32;

    data.into_iter()
        .filter(|&(val, _)| val <= threshold)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calc_weighted_stats_empty() {
        let stats = calc_weighted_stats(&[]);
        assert_eq!(stats.mean, 0.0);
        assert_eq!(stats.variance, 0.0);
        assert_eq!(stats.stdev, 0.0);

        let zero_weight_stats = calc_weighted_stats(&[(100, 0.0), (200, 0.0)]);
        assert_eq!(zero_weight_stats.mean, 0.0);
        assert_eq!(zero_weight_stats.variance, 0.0);
        assert_eq!(zero_weight_stats.stdev, 0.0);
    }

    #[test]
    fn test_calc_weighted_stats_single() {
        let stats = calc_weighted_stats(&[(1500, 1.0)]);
        assert_eq!(stats.mean, 1500.0);
        assert_eq!(stats.variance, 0.0);
        assert_eq!(stats.stdev, 0.0);
    }

    #[test]
    fn test_calc_weighted_stats_uniform() {
        let data = vec![(100, 1.0), (200, 1.0), (300, 1.0)];
        let stats = calc_weighted_stats(&data);
        assert!((stats.mean - 200.0).abs() < 1e-4);
        // Sample variance for [100, 200, 300] = (( -100)^2 + 0^2 + 100^2 ) / 2 = 20000 / 2 = 10000
        assert!((stats.variance - 10000.0).abs() < 1e-3);
        assert!((stats.stdev - 100.0).abs() < 1e-4);
    }

    #[test]
    fn test_calc_weighted_stats_weighted() {
        // Double weight on 100: mean = (100*2 + 200*1) / 3 = 400 / 3 = 133.333
        let data = vec![(100, 2.0), (200, 1.0)];
        let stats = calc_weighted_stats(&data);
        assert!((stats.mean - (400.0 / 3.0)).abs() < 1e-4);
        assert!(stats.variance > 0.0);
        assert!(stats.stdev > 0.0);
    }

    #[test]
    fn test_fit_weighted_skewnorm_zero_variance() {
        let data = vec![(1000, 1.0), (1000, 1.0)];
        let params = fit_weighted_skewnorm(&data);
        assert_eq!(params.alpha, 0.0);
        assert_eq!(params.omega, 1.0);
        assert_eq!(params.xi, 1000.0);
    }

    #[test]
    fn test_fit_weighted_skewnorm_symmetric() {
        // Symmetric data should have alpha ~ 0
        let data = vec![
            (800, 1.0),
            (900, 2.0),
            (1000, 4.0),
            (1100, 2.0),
            (1200, 1.0),
        ];
        let params = fit_weighted_skewnorm(&data);
        assert!(params.alpha.abs() < 0.1);
        assert!((params.xi - 1000.0).abs() < 10.0);
        assert!(params.omega > 0.0);
    }

    #[test]
    fn test_fit_weighted_skewnorm_skewed() {
        // Right-skewed data (tail extends to the right)
        let data = vec![(800, 5.0), (850, 4.0), (900, 3.0), (1200, 1.0), (1600, 1.0)];
        let params = fit_weighted_skewnorm(&data);
        assert!(params.alpha > 0.0);
        assert!(!params.alpha.is_nan() && !params.alpha.is_infinite());
        assert!(!params.omega.is_nan() && !params.omega.is_infinite());
        assert!(!params.xi.is_nan() && !params.xi.is_infinite());
    }

    #[test]
    fn test_trim_outliers() {
        let stats = WeightedStats {
            mean: 1000.0,
            variance: 10000.0,
            stdev: 100.0,
        };

        // Threshold is mean + 2*stdev = 1200
        let data = vec![
            (800, 1.0),
            (1000, 1.0),
            (1200, 1.0), // kept
            (1201, 1.0), // trimmed
            (1500, 1.0), // trimmed
        ];

        let trimmed = trim_outliers(data, &stats);
        let vals: Vec<i32> = trimmed.into_iter().map(|(v, _)| v).collect();
        assert_eq!(vals, vec![800, 1000, 1200]);
    }

    #[test]
    fn test_trim_outliers_edge_cases() {
        let stats = WeightedStats {
            mean: 1000.0,
            variance: 0.0,
            stdev: 0.0,
        };
        let single = vec![(1000, 1.0)];
        assert_eq!(trim_outliers(single.clone(), &stats), single);

        let data = vec![(1000, 1.0), (1000, 1.0)];
        assert_eq!(trim_outliers(data.clone(), &stats), data);
    }
}
