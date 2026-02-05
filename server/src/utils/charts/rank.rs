use super::builder::RankChartBuilder;
use super::models::{ChartData, RankStats};

pub fn generate_rank_chart(competitors: &[(&str, &RankStats)]) -> ChartData {
    let mut builder = RankChartBuilder::new();

    competitors
        .iter()
        .for_each(|(name, stats)| builder.add_competitor(name, stats));

    builder.into_chart_data()
}

#[cfg(test)]
mod tests {
    use super::super::models::RankAccumulator;
    use super::*;

    #[test]
    fn test_generate_rank_chart() {
        let mut acc1 = RankAccumulator::new(3);
        let mut acc2 = RankAccumulator::new(3);

        for _ in 0..500 {
            acc1.record_rank(0);
        }
        for _ in 0..300 {
            acc1.record_rank(1);
        }
        for _ in 0..200 {
            acc1.record_rank(2);
        }

        for _ in 0..100 {
            acc2.record_rank(0);
        }
        for _ in 0..400 {
            acc2.record_rank(1);
        }
        for _ in 0..500 {
            acc2.record_rank(2);
        }

        let stats1 = acc1.into_rank_stats(1000);
        let stats2 = acc2.into_rank_stats(1000);

        let input = vec![("P1", &stats1), ("P2", &stats2)];

        let chart = generate_rank_chart(&input);

        assert_eq!(chart.labels.len(), 2);
        assert_eq!(chart.labels[0], "P1");
        assert_eq!(chart.data.len(), 3);
        assert_eq!(chart.data[0].name, "1");
        assert_eq!(chart.data[0].values[0], 50.0);
        assert_eq!(chart.data[0].values[1], 10.0);
    }
}
