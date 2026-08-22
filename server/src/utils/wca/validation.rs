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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_wca_ids() {
        assert_eq!(
            clean_and_validate_wca_id("2015MCKE02"),
            Some("2015MCKE02".to_string())
        );
        // Lowercase should be normalized to uppercase
        assert_eq!(
            clean_and_validate_wca_id("2015mcke02"),
            Some("2015MCKE02".to_string())
        );
        assert_eq!(
            clean_and_validate_wca_id("1982THAI01"),
            Some("1982THAI01".to_string())
        );
        assert_eq!(
            clean_and_validate_wca_id("1982FRAN01"),
            Some("1982FRAN01".to_string())
        );
    }

    #[test]
    fn test_invalid_wca_ids() {
        // Too short
        assert_eq!(clean_and_validate_wca_id("2015MCKE0"), None);
        // Too long
        assert_eq!(clean_and_validate_wca_id("2015MCKE001"), None);
        // Empty
        assert_eq!(clean_and_validate_wca_id(""), None);
        // Invalid year (letters instead of digits)
        assert_eq!(clean_and_validate_wca_id("ABCDMCKE02"), None);
        assert_eq!(clean_and_validate_wca_id("201AMCKE02"), None);
        // Invalid name (digits instead of letters)
        assert_eq!(clean_and_validate_wca_id("2015123402"), None);
        assert_eq!(clean_and_validate_wca_id("2015MCK102"), None);
        // Special characters in name
        assert_eq!(clean_and_validate_wca_id("2015MC-E02"), None);
        assert_eq!(clean_and_validate_wca_id("2015MC E02"), None);
        // Invalid suffix (letters instead of digits)
        assert_eq!(clean_and_validate_wca_id("2015MCKEAA"), None);
        assert_eq!(clean_and_validate_wca_id("2015MCKE0A"), None);
    }
}
