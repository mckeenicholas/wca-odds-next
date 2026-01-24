use std::f32::consts::PI;

pub fn calc_weighted_stats(data: &[(i32, f32)]) -> (f32, f32, f32) {
    if data.is_empty() {
        return (0.0, 0.0, 0.0);
    }

    let total_weight: f32 = data.iter().map(|(_, w)| *w).sum();
    if total_weight <= 0.0 {
        return (0.0, 0.0, 0.0);
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

    (mean, variance, variance.sqrt())
}

pub fn fit_weighted_skewnorm(data: &[(i32, f32)]) -> (f32, f32, f32) {
    let (mean, variance, stdev) = calc_weighted_stats(data);
    if stdev == 0.0 {
        return (0.0, 1.0, mean);
    }

    let total_weight: f32 = data.iter().map(|(_, w)| *w).sum();
    let weighted_skewness = data
        .iter()
        .map(|&(val, w)| w * ((val as f32 - mean) / stdev).powi(3))
        .sum::<f32>()
        / total_weight;

    // Constants for skew normal approximation
    let max_skew = 0.995 * ((4.0 - PI).sqrt() * (2.0 / PI).sqrt() * (1.0 - 2.0 / PI).powf(-1.5));
    let bounded_skew = weighted_skewness.clamp(-max_skew, max_skew);

    let delta_term = (PI / 2.0) * bounded_skew.abs().powf(2.0 / 3.0)
        / (bounded_skew.abs().powf(2.0 / 3.0) + ((4.0 - PI) / 2.0).powf(2.0 / 3.0));

    let delta = bounded_skew.signum() * delta_term.sqrt().clamp(-0.995, 0.995);
    let alpha = delta / (1.0 - delta.powi(2)).sqrt();
    let omega = (variance / (1.0 - 2.0 * delta.powi(2) / PI)).sqrt();
    let xi = mean - omega * delta * (2.0 / PI).sqrt();

    (alpha, omega, xi)
}

pub fn trim_outliers(data: Vec<(i32, f32)>, mean: f32, stdev: f32) -> Vec<(i32, f32)> {
    let threshold = (mean + stdev * 2.0) as i32;
    data.into_iter()
        .filter(|&(val, _)| val <= threshold)
        .collect()
}
