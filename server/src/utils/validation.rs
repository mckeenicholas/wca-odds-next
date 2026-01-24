pub fn clean_and_validate_wca_id(id: &str) -> Option<String> {
    let id_upper = id.to_uppercase();

    // Must be exactly 10 characters
    if id_upper.len() != 10 {
        return None;
    }

    let chars: Vec<char> = id_upper.chars().collect();

    if !chars[0..4].iter().all(|c| c.is_ascii_digit()) {
        return None;
    }

    if !chars[4..8].iter().all(|c| c.is_ascii_uppercase()) {
        return None;
    }

    if !chars[8..10].iter().all(|c| c.is_ascii_digit()) {
        return None;
    }

    Some(id_upper)
}
