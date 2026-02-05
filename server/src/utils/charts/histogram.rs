use super::builder::HistogramChartBuilder;
use super::builder::IndividualHistogramBuilder;
use super::models::{ChartData, HistogramData};

const PAD_AMOUNT_CS: i32 = 20; // 20 centiseconds
const PAD_AMOUNT_MOVES: i32 = 100; // 1 move for FMC

pub struct HistogramKeys {
    count: i32,
    max: i32,
    is_fmc: bool,
    is_average: bool,
}

impl HistogramKeys {
    pub fn new(min: i32, max: i32, is_fmc: bool, is_average: bool) -> Option<Self> {
        let pad_amount = if is_fmc {
            PAD_AMOUNT_MOVES
        } else {
            PAD_AMOUNT_CS
        };

        let start_val = (min - pad_amount).max(0);
        let decimals = start_val % 100;

        let is_valid = if is_fmc {
            // For FMC, valid starts are 0, 33 (X.33), 67 (X.67) - representing 1/3 fractions approx
            decimals == 0 || decimals == 33 || decimals == 67
        } else {
            start_val % 10 == 0
        };

        if !is_valid {
            return None;
        }

        Some(Self {
            count: start_val,
            max: max + pad_amount,
            is_fmc,
            is_average,
        })
    }
}

impl Iterator for HistogramKeys {
    type Item = i32;

    fn next(&mut self) -> Option<Self::Item> {
        if self.count > self.max {
            return None;
        }

        let yield_val = self.count;
        let decimals = self.count % 100;

        self.count = match (self.is_fmc, self.is_average, decimals) {
            // FMC & Average: Steps of 33/34/33 to approximate 100/3
            (true, true, 0) => self.count + 33,
            (true, true, 33) => self.count + 34,
            (true, true, 67) => self.count + 33,
            // FMC & Single: Step 100 (1 move)
            (true, false, _) => self.count + 100,
            // Standard Time: Step 10
            _ => self.count + 10,
        };

        Some(yield_val)
    }
}

pub fn create_individual_histogram_chart(
    singles: &HistogramData,
    averages: &HistogramData,
    is_fmc: bool,
) -> ChartData {
    IndividualHistogramBuilder::new(singles, averages, is_fmc).build()
}

pub fn create_full_histogram_chart(
    competitors: &[(&str, &HistogramData)],
    is_fmc: bool,
    is_average: bool,
) -> ChartData {
    let mut builder = HistogramChartBuilder::new(is_fmc, is_average);
    for (name, data) in competitors {
        builder = builder.add_series(name, data);
    }
    builder.build()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_histogram_keys_standard() {
        // Standard time, step 10
        let keys: Vec<i32> = HistogramKeys::new(100, 130, false, false)
            .unwrap()
            .collect();
        // Min 100 -> Start 80 (pad 20). Max 130 -> End 150.
        // Steps: 80, 90, 100, 110, 120, 130, 140, 150
        assert_eq!(keys, vec![80, 90, 100, 110, 120, 130, 140, 150]);
    }

    #[test]
    fn test_histogram_keys_fmc_single() {
        // FMC Single, step 100
        let keys: Vec<i32> = HistogramKeys::new(2000, 2200, true, false)
            .unwrap()
            .collect();
        // Min 2000 -> Start 1900 (pad 100). Max 2200 -> End 2300.
        // Steps: 1900, 2000, 2100, 2200, 2300
        assert_eq!(keys, vec![1900, 2000, 2100, 2200, 2300]);
    }
}
