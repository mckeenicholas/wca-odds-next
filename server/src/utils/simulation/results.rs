use crate::utils::charts::{
    HistogramData, RankStats, create_full_histogram_chart, create_individual_histogram_chart,
    generate_rank_chart,
};
use crate::utils::competitor::Competitor;
use crate::utils::types::{
    CompetitorSimulationResult, FullHistogramChartData, SimulationEndpointResults,
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
