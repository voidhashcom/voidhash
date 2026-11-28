//! Number-to-text helpers that avoid `core::fmt`, which adds tens of
//! kilobytes to a module. Combine them with [`cat!`](crate::cat).

use alloc::string::String;

/// An integer in decimal: `int(-42) == "-42"`.
pub fn int(value: i64) -> String {
    let mut out = String::new();
    push_int(&mut out, value);
    out
}

/// A non-negative integer left-padded with zeros to `width` digits:
/// `padded(7, 2) == "07"`.
pub fn padded(value: u64, width: usize) -> String {
    let digits = int(value as i64);
    let mut out = String::with_capacity(width.max(digits.len()));
    for _ in digits.len()..width {
        out.push('0');
    }
    out.push_str(&digits);
    out
}

/// A number rounded to `decimals` fractional digits, without trailing zeros:
/// `fixed(2.50, 2) == "2.5"`, `fixed(3.0, 2) == "3"`.
pub fn fixed(value: f64, decimals: u32) -> String {
    let mut out = String::new();
    push_fixed(&mut out, value, decimals);
    out
}

pub(crate) fn push_int(out: &mut String, value: i64) {
    if value < 0 {
        out.push('-');
    }
    let mut magnitude = value.unsigned_abs();
    let mut digits = [0u8; 20];
    let mut count = 0;
    loop {
        digits[count] = b'0' + (magnitude % 10) as u8;
        count += 1;
        magnitude /= 10;
        if magnitude == 0 {
            break;
        }
    }
    for digit in digits[..count].iter().rev() {
        out.push(*digit as char);
    }
}

pub(crate) fn push_fixed(out: &mut String, value: f64, decimals: u32) {
    if !value.is_finite() {
        out.push('0');
        return;
    }
    let scale = 10u64.pow(decimals.min(9)) as f64;
    let scaled = libm::round(libm::fabs(value) * scale);
    let whole = (scaled / scale) as u64;
    let mut fraction = (scaled - whole as f64 * scale) as u64;
    if value < 0.0 && scaled > 0.0 {
        out.push('-');
    }
    push_int(out, whole as i64);
    if fraction == 0 {
        return;
    }
    let mut width = decimals.min(9) as usize;
    while fraction.is_multiple_of(10) {
        fraction /= 10;
        width -= 1;
    }
    out.push('.');
    out.push_str(&padded(fraction, width));
}

/// Concatenates string-like values into a `String`.
///
/// ```
/// use voidhash_ui::prelude::*;
/// let caught = 3;
/// assert_eq!(cat!("Caught ", int(caught), " of ", int(5)), "Caught 3 of 5");
/// ```
#[macro_export]
macro_rules! cat {
    ($($part:expr),* $(,)?) => {{
        let mut out = $crate::__private::String::new();
        $( out.push_str(::core::convert::AsRef::<str>::as_ref(&$part)); )*
        out
    }};
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats_integers() {
        assert_eq!(int(0), "0");
        assert_eq!(int(-42), "-42");
        assert_eq!(int(i64::MIN), "-9223372036854775808");
        assert_eq!(padded(7, 2), "07");
        assert_eq!(padded(123, 2), "123");
    }

    #[test]
    fn formats_decimals() {
        assert_eq!(fixed(2.5, 2), "2.5");
        assert_eq!(fixed(3.0, 2), "3");
        assert_eq!(fixed(-0.125, 2), "-0.13");
        assert_eq!(fixed(1.05, 2), "1.05");
        assert_eq!(fixed(-0.001, 2), "0");
    }
}
