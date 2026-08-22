use super::constants::*;

/// WCA event format types, defining how results are calculated.
#[derive(Debug, Clone, PartialEq, Copy)]
pub enum EventType {
    /// Average of 5: best 3 of 5 solves averaged (drop best and worst)
    Ao5,
    /// Best of 5: best single from 5 attempts
    Bo5,
    /// Mean of 3: average of all 3 solves
    Mo3,
    /// Best of 3: best single from 3 attempts
    Bo3,
    /// Fewest Moves Challenge: special Mean of 3 with move-based scoring
    Fmc,
}

impl EventType {
    /// Parse a WCA event ID string into an EventType.
    pub fn from_id(id: &str) -> Option<Self> {
        match id {
            "222" | "333" | "444" | "555" | "333oh" | "minx" | "pyram" | "clock" | "skewb"
            | "sq1" => Some(Self::Ao5),
            "333bf" => Some(Self::Bo5),
            "666" | "777" => Some(Self::Mo3),
            "333fm" => Some(Self::Fmc),
            "444bf" | "555bf" => Some(Self::Bo3),
            _ => None,
        }
    }

    /// Get the number of solves for this event type.
    pub fn num_solves(&self) -> usize {
        match self {
            EventType::Ao5 => AO5_SOLVE_COUNT,
            EventType::Bo5 => BO5_SOLVE_COUNT,
            EventType::Mo3 => MO3_SOLVE_COUNT,
            EventType::Fmc => MO3_SOLVE_COUNT,
            EventType::Bo3 => BO3_SOLVE_COUNT,
        }
    }

    /// Check if this is an FMC (Fewest Moves Challenge) event.
    pub fn is_fmc(&self) -> bool {
        matches!(self, EventType::Fmc)
    }
}

/// Calculate the official WCA average/result from a set of solves.
/// Returns a tuple of (average, best)
pub fn calculate_average(solves: &mut [i32], event_type: EventType) -> (i32, i32) {
    match event_type {
        EventType::Ao5 => {
            solves.sort_unstable();
            let best_time = solves[0];
            if solves[3] >= DNF_VALUE {
                (DNF_VALUE, best_time)
            } else {
                let sum = solves[1] + solves[2] + solves[3];
                ((sum + 1) / 3, best_time)
            }
        }
        EventType::Mo3 | EventType::Fmc => {
            let active_solves = &solves[..3];
            let best_time = *active_solves.iter().min().unwrap();
            if active_solves.iter().any(|&x| x >= DNF_VALUE) {
                (DNF_VALUE, best_time)
            } else {
                let sum: i32 = active_solves.iter().sum();
                ((sum + 1) / 3, best_time)
            }
        }
        EventType::Bo3 => {
            let best_time = *solves[..3].iter().min().unwrap();
            (best_time, best_time)
        }
        EventType::Bo5 => {
            let best_time = *solves.iter().min().unwrap();
            (best_time, best_time)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_event_type_from_id() {
        assert_eq!(EventType::from_id("333"), Some(EventType::Ao5));
        assert_eq!(EventType::from_id("222"), Some(EventType::Ao5));
        assert_eq!(EventType::from_id("444"), Some(EventType::Ao5));
        assert_eq!(EventType::from_id("555"), Some(EventType::Ao5));
        assert_eq!(EventType::from_id("333oh"), Some(EventType::Ao5));
        assert_eq!(EventType::from_id("minx"), Some(EventType::Ao5));
        assert_eq!(EventType::from_id("pyram"), Some(EventType::Ao5));
        assert_eq!(EventType::from_id("clock"), Some(EventType::Ao5));
        assert_eq!(EventType::from_id("skewb"), Some(EventType::Ao5));
        assert_eq!(EventType::from_id("sq1"), Some(EventType::Ao5));
        assert_eq!(EventType::from_id("333bf"), Some(EventType::Bo5));
        assert_eq!(EventType::from_id("666"), Some(EventType::Mo3));
        assert_eq!(EventType::from_id("777"), Some(EventType::Mo3));
        assert_eq!(EventType::from_id("333fm"), Some(EventType::Fmc));
        assert_eq!(EventType::from_id("444bf"), Some(EventType::Bo3));
        assert_eq!(EventType::from_id("555bf"), Some(EventType::Bo3));
        assert_eq!(EventType::from_id("unknown"), None);
        assert_eq!(EventType::from_id(""), None);
    }

    #[test]
    fn test_event_type_properties() {
        assert_eq!(EventType::Ao5.num_solves(), 5);
        assert_eq!(EventType::Bo5.num_solves(), 5);
        assert_eq!(EventType::Mo3.num_solves(), 3);
        assert_eq!(EventType::Fmc.num_solves(), 3);
        assert_eq!(EventType::Bo3.num_solves(), 3);

        assert!(EventType::Fmc.is_fmc());
        assert!(!EventType::Ao5.is_fmc());
        assert!(!EventType::Mo3.is_fmc());
    }

    #[test]
    fn test_calculate_average_ao5_standard() {
        let mut solves = [1000, 1200, 900, 1100, 1300];
        let (avg, best) = calculate_average(&mut solves, EventType::Ao5);
        assert_eq!(best, 900);
        // Sorted: [900, 1000, 1100, 1200, 1300] -> drop 900 & 1300 -> avg of 1000, 1100, 1200 = 1100
        assert_eq!(avg, 1100);
    }

    #[test]
    fn test_calculate_average_ao5_rounding() {
        let mut solves1 = [1000, 1000, 1000, 1001, 1000];
        let (avg1, _) = calculate_average(&mut solves1, EventType::Ao5);
        // Middle: 1000, 1000, 1000 -> (3000+1)/3 = 1000
        assert_eq!(avg1, 1000);

        let mut solves2 = [1000, 1000, 1001, 1001, 1000];
        let (avg2, _) = calculate_average(&mut solves2, EventType::Ao5);
        // Middle: 1000, 1000, 1001 -> sum=3001 -> (3001+1)/3 = 1000
        assert_eq!(avg2, 1000);

        let mut solves3 = [1000, 1001, 1001, 1001, 1000];
        let (avg3, _) = calculate_average(&mut solves3, EventType::Ao5);
        // Middle: 1000, 1001, 1001 -> sum=3002 -> (3002+1)/3 = 1001
        assert_eq!(avg3, 1001);
    }

    #[test]
    fn test_calculate_average_ao5_dnf() {
        // Single DNF is dropped as the worst solve
        let mut solves = [1000, 1200, DNF_VALUE, 1100, 900];
        let (avg, best) = calculate_average(&mut solves, EventType::Ao5);
        assert_eq!(best, 900);
        assert_eq!(avg, 1100);

        // Double DNF results in DNF average
        let mut double_dnf = [1000, DNF_VALUE, DNF_VALUE, 1100, 900];
        let (avg_dnf, best_dnf) = calculate_average(&mut double_dnf, EventType::Ao5);
        assert_eq!(best_dnf, 900);
        assert_eq!(avg_dnf, DNF_VALUE);

        // All DNF
        let mut all_dnf = [DNF_VALUE; 5];
        let (all_avg, all_best) = calculate_average(&mut all_dnf, EventType::Ao5);
        assert_eq!(all_best, DNF_VALUE);
        assert_eq!(all_avg, DNF_VALUE);
    }

    #[test]
    fn test_calculate_average_mo3_and_fmc() {
        let mut solves = [1000, 1100, 1200, 0, 0];
        let (avg, best) = calculate_average(&mut solves, EventType::Mo3);
        assert_eq!(best, 1000);
        assert_eq!(avg, 1100);

        // FMC rounding test
        let mut fmc_solves = [25, 26, 26, 0, 0];
        let (fmc_avg, fmc_best) = calculate_average(&mut fmc_solves, EventType::Fmc);
        assert_eq!(fmc_best, 25);
        // (25 + 26 + 26 + 1) / 3 = 78 / 3 = 26
        assert_eq!(fmc_avg, 26);

        // Single DNF results in DNF average for Mo3
        let mut mo3_dnf = [1000, DNF_VALUE, 1100, 0, 0];
        let (avg_dnf, best_dnf) = calculate_average(&mut mo3_dnf, EventType::Mo3);
        assert_eq!(best_dnf, 1000);
        assert_eq!(avg_dnf, DNF_VALUE);
    }

    #[test]
    fn test_calculate_average_bo3_and_bo5() {
        let mut bo3_solves = [1200, 900, 1100, 0, 0];
        let (avg_bo3, best_bo3) = calculate_average(&mut bo3_solves, EventType::Bo3);
        assert_eq!(best_bo3, 900);
        assert_eq!(avg_bo3, 900);

        let mut bo3_with_dnf = [DNF_VALUE, 950, 1100, 0, 0];
        let (avg_dnf, best_dnf) = calculate_average(&mut bo3_with_dnf, EventType::Bo3);
        assert_eq!(best_dnf, 950);
        assert_eq!(avg_dnf, 950);

        let mut bo5_solves = [1200, 1500, 850, 1100, 1300];
        let (avg_bo5, best_bo5) = calculate_average(&mut bo5_solves, EventType::Bo5);
        assert_eq!(best_bo5, 850);
        assert_eq!(avg_bo5, 850);
    }
}
