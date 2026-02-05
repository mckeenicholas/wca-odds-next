/// Validate and normalize a WCA competitor ID.
///
/// WCA IDs follow the format: YYYYCCCCNN where:
/// - YYYY: 4 digits (year of first competition)
/// - CCCC: 4 uppercase letters (name identifier)
/// - NN: 2 digits (disambiguation number)
///
/// This function confirms whether the ID is valid,
/// but cannot check if the ID actually exists in the WCA database.
/// Returns None if the ID is invalid.
pub fn clean_and_validate_wca_id(id: &str) -> Option<String> {
    let id_upper = id.to_uppercase();

    // Must be exactly 10 characters
    if id_upper.len() != 10 {
        return None;
    }

    let chars: Vec<char> = id_upper.chars().collect();

    // First 4 characters must be digits (year)
    if !chars[0..4].iter().all(|c| c.is_ascii_digit()) {
        return None;
    }

    // Next 4 characters must be uppercase letters
    if !chars[4..8].iter().all(|c| c.is_ascii_uppercase()) {
        return None;
    }

    // Last 2 characters must be digits
    if !chars[8..10].iter().all(|c| c.is_ascii_digit()) {
        return None;
    }

    Some(id_upper)
}
