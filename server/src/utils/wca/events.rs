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
pub fn calculate_average(solves: &mut [i32], event_type: EventType) -> i32 {
    match event_type {
        EventType::Ao5 => {
            solves.sort_unstable();
            if solves[3] >= DNF_VALUE {
                DNF_VALUE
            } else {
                let sum = solves[1] + solves[2] + solves[3];
                sum / 3
            }
        }
        EventType::Mo3 | EventType::Fmc => {
            let active_solves = &solves[..3];
            if active_solves.iter().any(|&x| x >= DNF_VALUE) {
                DNF_VALUE
            } else {
                let sum: i32 = active_solves.iter().sum();
                let avg = sum / 3;

                if matches!(event_type, EventType::Fmc) && avg % 10 == 6 {
                    // WCA rounds to nearest integer for FMC; integer division rounds down.
                    // For FMC results ending in 66, we manually nudge to 67.
                    avg + 1
                } else {
                    avg
                }
            }
        }
        EventType::Bo3 => *solves[..3].iter().min().unwrap(),
        EventType::Bo5 => *solves.iter().min().unwrap(),
    }
}
