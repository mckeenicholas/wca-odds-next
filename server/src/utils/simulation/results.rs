use crate::utils::{
    charts::{
        HistogramData, RankStats, create_full_histogram_chart, create_individual_histogram_chart,
        generate_rank_chart,
    },
    competitor::Competitor,
    types::{CompetitorSimulationResult, FullHistogramChartData, SimulationEndpointResults},
};

pub struct SimulationResult {
    rank_stats: RankStats,
    hist_single: HistogramData,
    hist_average: HistogramData,
}

impl SimulationResult {
    pub fn new(
        rank_stats: RankStats,
        hist_single: HistogramData,
        hist_average: HistogramData,
    ) -> Self {
        Self {
            rank_stats,
            hist_single,
            hist_average,
        }
    }

    pub fn win_probability(&self) -> f64 {
        self.rank_stats.win_probability()
    }

    pub fn podium_probability(&self) -> f64 {
        self.rank_stats.podium_probability()
    }

    pub fn expected_rank(&self) -> f64 {
        self.rank_stats.expected_rank()
    }

    pub fn single_histogram(&self) -> &HistogramData {
        &self.hist_single
    }

    pub fn average_histogram(&self) -> &HistogramData {
        &self.hist_average
    }

    pub fn rank_stats(&self) -> &RankStats {
        &self.rank_stats
    }
}

pub fn format_results(
    competitors: Vec<Competitor>,
    results: Vec<SimulationResult>,
    is_fmc: bool,
) -> SimulationEndpointResults {
    let hist_single_data: Vec<(&str, &HistogramData)> = results
        .iter()
        .zip(&competitors)
        .map(|(res, comp)| (comp.name.as_str(), res.single_histogram()))
        .collect();

    let full_histogram_single = create_full_histogram_chart(&hist_single_data, is_fmc, false);

    let hist_average_data: Vec<(&str, &HistogramData)> = results
        .iter()
        .zip(&competitors)
        .map(|(res, comp)| (comp.name.as_str(), res.average_histogram()))
        .collect();

    let full_histogram_average = create_full_histogram_chart(&hist_average_data, is_fmc, true);

    let full_histogram = FullHistogramChartData {
        single: full_histogram_single,
        average: full_histogram_average,
    };

    let rank_histogram_data: Vec<(&str, &RankStats)> = competitors
        .iter()
        .zip(&results)
        .map(|(comp, res)| (comp.name.as_str(), res.rank_stats()))
        .collect();

    let rank_histogram = generate_rank_chart(&rank_histogram_data);

    let competitor_results = competitors
        .into_iter()
        .zip(results)
        .map(|(comp, res)| {
            let stats = comp.stats.as_ref();

            let histogram = create_individual_histogram_chart(
                res.single_histogram(),
                res.average_histogram(),
                is_fmc,
            );

            CompetitorSimulationResult {
                id: comp.id,
                name: comp.name,
                country_iso2: comp.country_iso2,
                expected_rank: res.expected_rank(),
                win_chance: res.win_probability(),
                pod_chance: res.podium_probability(),
                sample_size: stats.map(|s| s.num_non_dnf_results).unwrap_or(0),
                mean_no_dnf: stats.map(|s| s.mean as u32).unwrap_or(0),
                histogram,
            }
        })
        .collect();

    SimulationEndpointResults {
        competitor_results,
        full_histogram,
        rank_histogram,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::utils::charts::models::{HistogramAccumulator, RankAccumulator};

    #[test]
    fn test_simulation_result_accessors() {
        let mut rank_acc = RankAccumulator::new(3);
        rank_acc.record_rank(0);
        let rank_stats = rank_acc.into_rank_stats(1);

        let mut hist_s = HistogramAccumulator::new();
        hist_s.record(100);
        let single_hist = hist_s.into_histogram_data(1, 1, 0.0);

        let mut hist_a = HistogramAccumulator::new();
        hist_a.record(110);
        let avg_hist = hist_a.into_histogram_data(1, 1, 0.0);

        let result = SimulationResult::new(rank_stats, single_hist, avg_hist);

        assert_eq!(result.win_probability(), 1.0);
        assert_eq!(result.podium_probability(), 1.0);
        assert_eq!(result.expected_rank(), 1.0);
        assert_eq!(result.single_histogram().get(&100), 1.0);
        assert_eq!(result.average_histogram().get(&110), 1.0);
    }

    #[test]
    fn test_format_results() {
        let comp1 = Competitor {
            name: "Alice".to_string(),
            id: "2020ALIC01".to_string(),
            country_iso2: "US".to_string(),
            entered_results: vec![],
            stats: None,
        };

        let mut rank_acc = RankAccumulator::new(1);
        rank_acc.record_rank(0);
        let rank_stats = rank_acc.into_rank_stats(1);
        let single_hist = HistogramData::default();
        let avg_hist = HistogramData::default();

        let sim_res = SimulationResult::new(rank_stats, single_hist, avg_hist);

        let endpoint_results = format_results(vec![comp1], vec![sim_res], false);

        assert_eq!(endpoint_results.competitor_results.len(), 1);
        assert_eq!(endpoint_results.competitor_results[0].name, "Alice");
        assert_eq!(endpoint_results.competitor_results[0].id, "2020ALIC01");
        assert_eq!(endpoint_results.competitor_results[0].win_chance, 1.0);
        assert_eq!(endpoint_results.rank_histogram.labels, vec!["Alice"]);
    }
}
