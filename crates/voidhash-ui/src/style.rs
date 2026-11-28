//! Colours, fonts, alignment and transitions used by view modifiers.

use alloc::string::String;

use crate::value::{Map, Value};

/// An sRGB colour with alpha.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Default)]
pub struct Color {
    /// Red channel.
    pub r: u8,
    /// Green channel.
    pub g: u8,
    /// Blue channel.
    pub b: u8,
    /// Alpha channel; 255 is opaque.
    pub a: u8,
}

impl Color {
    /// Fully transparent.
    pub const CLEAR: Color = Color::rgba(0, 0, 0, 0);
    /// Opaque white.
    pub const WHITE: Color = Color::rgb(255, 255, 255);
    /// Opaque black.
    pub const BLACK: Color = Color::rgb(0, 0, 0);
    /// Default accent of the dark paywall palette (violet).
    pub const ACCENT: Color = Color::hex("#7c3aed");
    /// Page background of the dark paywall palette.
    pub const BACKGROUND: Color = Color::hex("#0b0b10");
    /// Card and control background of the dark paywall palette.
    pub const SURFACE: Color = Color::hex("#17171f");
    /// Primary text on dark backgrounds.
    pub const PRIMARY: Color = Color::hex("#f5f5f7");
    /// Secondary text on dark backgrounds.
    pub const SECONDARY: Color = Color::hex("#a1a1aa");
    /// Hairlines and subtle borders on dark backgrounds.
    pub const SEPARATOR: Color = Color::rgba(255, 255, 255, 24);

    /// An opaque colour.
    pub const fn rgb(r: u8, g: u8, b: u8) -> Color {
        Color { r, g, b, a: 255 }
    }

    /// A colour with alpha (0 transparent, 255 opaque).
    pub const fn rgba(r: u8, g: u8, b: u8, a: u8) -> Color {
        Color { r, g, b, a }
    }

    /// Parses `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa` at compile time.
    /// Panics (a compile error in a `const`) on anything else.
    pub const fn hex(text: &str) -> Color {
        match Color::parse(text) {
            Some(color) => color,
            None => panic!("expected a colour like #7c3aed"),
        }
    }

    /// Parses `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa`.
    pub const fn parse(text: &str) -> Option<Color> {
        let bytes = text.as_bytes();
        if bytes.is_empty() || bytes[0] != b'#' {
            return None;
        }
        let digits = bytes.len() - 1;
        let mut channels = [0u8, 0, 0, 255];
        let short = digits == 3 || digits == 4;
        if !(short || digits == 6 || digits == 8) {
            return None;
        }
        let count = if digits == 3 || digits == 6 { 3 } else { 4 };
        let mut index = 0;
        while index < count {
            let value = if short {
                match nibble(bytes[1 + index]) {
                    Some(digit) => digit << 4 | digit,
                    None => return None,
                }
            } else {
                match (nibble(bytes[1 + index * 2]), nibble(bytes[2 + index * 2])) {
                    (Some(high), Some(low)) => high << 4 | low,
                    _ => return None,
                }
            };
            channels[index] = value;
            index += 1;
        }
        Some(Color::rgba(
            channels[0],
            channels[1],
            channels[2],
            channels[3],
        ))
    }

    /// This colour with its alpha multiplied by `opacity` (0–1).
    pub fn opacity(self, opacity: f32) -> Color {
        let alpha = f32::from(self.a) * opacity.clamp(0.0, 1.0);
        Color {
            a: (alpha + 0.5) as u8,
            ..self
        }
    }

    /// Linear interpolation towards `other` (`t` from 0 to 1).
    pub fn mix(self, other: Color, t: f32) -> Color {
        let t = t.clamp(0.0, 1.0);
        let channel = |from: u8, to: u8| {
            (f32::from(from) + (f32::from(to) - f32::from(from)) * t + 0.5) as u8
        };
        Color {
            r: channel(self.r, other.r),
            g: channel(self.g, other.g),
            b: channel(self.b, other.b),
            a: channel(self.a, other.a),
        }
    }

    /// The `0xRRGGBBAA` form used by canvas draw lists.
    pub const fn to_u32(self) -> u32 {
        (self.r as u32) << 24 | (self.g as u32) << 16 | (self.b as u32) << 8 | self.a as u32
    }

    /// The `#rrggbb` or `#rrggbbaa` form used in styles.
    pub fn to_hex(self) -> String {
        const DIGITS: &[u8; 16] = b"0123456789abcdef";
        let mut out = String::with_capacity(9);
        out.push('#');
        let channels = [self.r, self.g, self.b, self.a];
        let count = if self.a == 255 { 3 } else { 4 };
        for channel in &channels[..count] {
            out.push(DIGITS[usize::from(channel >> 4)] as char);
            out.push(DIGITS[usize::from(channel & 15)] as char);
        }
        out
    }
}

const fn nibble(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}

/// A text style: size in logical pixels and weight (100–900).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Font {
    /// Font size in logical pixels.
    pub size: f32,
    /// Font weight, 100 (thin) to 900 (black).
    pub weight: u16,
    /// Font family; `None` uses the paywall's default font.
    pub family: Option<&'static str>,
}

impl Font {
    /// 34 pt bold.
    pub const LARGE_TITLE: Font = Font::new(34.0, 700);
    /// 28 pt bold.
    pub const TITLE: Font = Font::new(28.0, 700);
    /// 22 pt bold.
    pub const TITLE2: Font = Font::new(22.0, 700);
    /// 20 pt semibold.
    pub const TITLE3: Font = Font::new(20.0, 600);
    /// 17 pt semibold.
    pub const HEADLINE: Font = Font::new(17.0, 600);
    /// 17 pt regular.
    pub const BODY: Font = Font::new(17.0, 400);
    /// 16 pt regular.
    pub const CALLOUT: Font = Font::new(16.0, 400);
    /// 15 pt regular.
    pub const SUBHEADLINE: Font = Font::new(15.0, 400);
    /// 13 pt regular.
    pub const FOOTNOTE: Font = Font::new(13.0, 400);
    /// 12 pt regular.
    pub const CAPTION: Font = Font::new(12.0, 400);

    /// A font of the default family.
    pub const fn new(size: f32, weight: u16) -> Font {
        Font {
            size,
            weight,
            family: None,
        }
    }

    /// A regular-weight font of the given size.
    pub const fn size(size: f32) -> Font {
        Font::new(size, 400)
    }

    /// This font with another weight.
    pub const fn weight(self, weight: u16) -> Font {
        Font { weight, ..self }
    }

    /// This font in bold (700).
    pub const fn bold(self) -> Font {
        self.weight(700)
    }

    /// This font in semibold (600).
    pub const fn semibold(self) -> Font {
        self.weight(600)
    }

    /// This font from another family.
    pub const fn family(self, family: &'static str) -> Font {
        Font {
            family: Some(family),
            ..self
        }
    }
}

/// Cross-axis alignment of a stack's children (`alignItems`).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Align {
    /// Leading edge.
    Start,
    /// Centre.
    Center,
    /// Trailing edge.
    End,
    /// Fill the cross axis.
    Stretch,
    /// Align text baselines.
    Baseline,
}

impl Align {
    pub(crate) fn keyword(self) -> &'static str {
        match self {
            Align::Start => "flex-start",
            Align::Center => "center",
            Align::End => "flex-end",
            Align::Stretch => "stretch",
            Align::Baseline => "baseline",
        }
    }
}

/// Main-axis distribution of a stack's children (`justifyContent`).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Justify {
    /// Pack at the start.
    Start,
    /// Pack in the centre.
    Center,
    /// Pack at the end.
    End,
    /// Equal space between children.
    SpaceBetween,
    /// Equal space around children.
    SpaceAround,
    /// Equal space between and around children.
    SpaceEvenly,
}

impl Justify {
    pub(crate) fn keyword(self) -> &'static str {
        match self {
            Justify::Start => "flex-start",
            Justify::Center => "center",
            Justify::End => "flex-end",
            Justify::SpaceBetween => "space-between",
            Justify::SpaceAround => "space-around",
            Justify::SpaceEvenly => "space-evenly",
        }
    }
}

/// Horizontal alignment of text lines.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TextAlign {
    /// Left-aligned.
    Left,
    /// Centred.
    Center,
    /// Right-aligned.
    Right,
}

impl TextAlign {
    pub(crate) fn keyword(self) -> &'static str {
        match self {
            TextAlign::Left => "left",
            TextAlign::Center => "center",
            TextAlign::Right => "right",
        }
    }
}

/// How an image fills its frame.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ResizeMode {
    /// Fill the frame, cropping the image.
    Cover,
    /// Fit inside the frame, letterboxing the image.
    Contain,
    /// Stretch to the frame.
    Stretch,
    /// Centre without scaling.
    Center,
}

impl ResizeMode {
    pub(crate) fn keyword(self) -> &'static str {
        match self {
            ResizeMode::Cover => "cover",
            ResizeMode::Contain => "contain",
            ResizeMode::Stretch => "stretch",
            ResizeMode::Center => "center",
        }
    }
}

/// Timing curve of a [`Transition`].
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Curve {
    /// Constant speed.
    Linear,
    /// Fast start, gentle stop.
    EaseOut,
    /// Physically based spring.
    Spring,
}

/// Animates an element's style changes natively when it re-renders.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Transition {
    /// Duration in seconds.
    pub duration: f64,
    /// Timing curve.
    pub curve: Curve,
}

impl Transition {
    /// A responsive spring (0.35 s).
    pub const fn spring() -> Transition {
        Transition {
            duration: 0.35,
            curve: Curve::Spring,
        }
    }

    /// An ease-out curve over `duration` seconds.
    pub const fn ease_out(duration: f64) -> Transition {
        Transition {
            duration,
            curve: Curve::EaseOut,
        }
    }

    /// A linear curve over `duration` seconds.
    pub const fn linear(duration: f64) -> Transition {
        Transition {
            duration,
            curve: Curve::Linear,
        }
    }

    pub(crate) fn to_value(self) -> Value {
        let mut map = Map::new();
        map.insert("duration", self.duration);
        map.insert(
            "curve",
            match self.curve {
                Curve::Linear => "linear",
                Curve::EaseOut => "easeOut",
                Curve::Spring => "spring",
            },
        );
        Value::Object(map)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_hex_colours() {
        assert_eq!(Color::parse("#7c3aed"), Some(Color::rgb(0x7c, 0x3a, 0xed)));
        assert_eq!(Color::parse("#fff"), Some(Color::WHITE));
        assert_eq!(Color::parse("#00000080"), Some(Color::rgba(0, 0, 0, 0x80)));
        assert_eq!(Color::parse("#12345"), None);
        assert_eq!(Color::parse("red"), None);
    }

    #[test]
    fn formats_hex_and_packed_colours() {
        assert_eq!(Color::rgb(0x7c, 0x3a, 0xed).to_hex(), "#7c3aed");
        assert_eq!(Color::rgba(255, 0, 0, 0x80).to_hex(), "#ff000080");
        assert_eq!(Color::rgba(1, 2, 3, 4).to_u32(), 0x0102_0304);
        assert_eq!(Color::WHITE.opacity(0.5).a, 128);
    }
}

/// Which keyboard a [`text_input`](crate::view::text_input) asks the device
/// for.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum Keyboard {
    /// Letters, for prose.
    #[default]
    Text,
    /// An email address.
    Email,
    /// Whole numbers.
    Number,
    /// Numbers with a decimal separator.
    Decimal,
    /// A phone number.
    Phone,
    /// A web address.
    Url,
}

impl Keyboard {
    pub(crate) fn keyword(self) -> &'static str {
        match self {
            Keyboard::Text => "text",
            Keyboard::Email => "email",
            Keyboard::Number => "number",
            Keyboard::Decimal => "decimal",
            Keyboard::Phone => "phone",
            Keyboard::Url => "url",
        }
    }
}

/// What a [`text_input`](crate::view::text_input) capitalizes as the end
/// user types.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Capitalization {
    /// Nothing.
    None,
    /// The first letter of each sentence.
    Sentences,
    /// The first letter of each word.
    Words,
    /// Every letter.
    Characters,
}

impl Capitalization {
    pub(crate) fn keyword(self) -> &'static str {
        match self {
            Capitalization::None => "none",
            Capitalization::Sentences => "sentences",
            Capitalization::Words => "words",
            Capitalization::Characters => "characters",
        }
    }
}

/// The label of a [`text_input`](crate::view::text_input)'s return key,
/// which also says what the key does: `Next` moves to the next input of the
/// screen, `Default` breaks the line in a multiline input, and every other
/// one gives the keyboard up.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum ReturnKey {
    /// The platform's own return key.
    #[default]
    Default,
    /// Moves to the next input.
    Next,
    /// Done.
    Done,
    /// Go.
    Go,
    /// Search.
    Search,
    /// Send.
    Send,
}

impl ReturnKey {
    pub(crate) fn keyword(self) -> &'static str {
        match self {
            ReturnKey::Default => "default",
            ReturnKey::Next => "next",
            ReturnKey::Done => "done",
            ReturnKey::Go => "go",
            ReturnKey::Search => "search",
            ReturnKey::Send => "send",
        }
    }
}

/// What a [`text_input`](crate::view::text_input) holds, so the device can
/// offer to fill it in.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Autofill {
    /// A full name.
    Name,
    /// A given name.
    GivenName,
    /// A family name.
    FamilyName,
    /// An email address.
    Email,
    /// A phone number.
    Phone,
    /// A user name.
    Username,
    /// A password being chosen.
    NewPassword,
    /// An existing password.
    Password,
    /// A code sent by message, which the device offers from the message.
    OneTimeCode,
    /// A postal code.
    PostalCode,
    /// A country.
    Country,
    /// An organization.
    Organization,
}

impl Autofill {
    pub(crate) fn keyword(self) -> &'static str {
        match self {
            Autofill::Name => "name",
            Autofill::GivenName => "givenName",
            Autofill::FamilyName => "familyName",
            Autofill::Email => "email",
            Autofill::Phone => "phone",
            Autofill::Username => "username",
            Autofill::NewPassword => "newPassword",
            Autofill::Password => "password",
            Autofill::OneTimeCode => "oneTimeCode",
            Autofill::PostalCode => "postalCode",
            Autofill::Country => "country",
            Autofill::Organization => "organization",
        }
    }
}
