use super::Result;

const DIGITS: &str = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

pub(crate) fn rank_between(before: Option<&str>, after: Option<&str>) -> Result<String> {
    if let (Some(before), Some(after)) = (before, after) {
        if before >= after {
            return Err(format!("Cannot rank between {before} and {after}"));
        }
    }

    let digits: Vec<char> = DIGITS.chars().collect();
    let min_digit = 0;
    let max_digit = digits.len() - 1;
    let mid_digit = max_digit / 2;
    let mut prefix = String::new();

    for index in 0.. {
        let low = digit_at(before, index, min_digit)?;
        let high = digit_at(after, index, max_digit)?;

        if high - low > 1 {
            prefix.push(digits[(low + high) / 2]);
            return Ok(prefix);
        }

        prefix.push(*digits.get(low).unwrap_or(&digits[mid_digit]));
    }

    unreachable!()
}

fn digit_at(value: Option<&str>, index: usize, fallback: usize) -> Result<usize> {
    let Some(value) = value else {
        return Ok(fallback);
    };
    let Some(character) = value.chars().nth(index) else {
        return Ok(fallback);
    };
    DIGITS
        .chars()
        .position(|digit| digit == character)
        .ok_or_else(|| format!("Invalid rank character: {character}"))
}
