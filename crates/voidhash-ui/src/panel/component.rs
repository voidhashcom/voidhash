//! What ties a component crate's own editor panel to its component: reading
//! prop types from the panel's context, and the checks `export_panels!`
//! makes.

use alloc::vec::Vec;

use super::{Field, Opt, tree};
use crate::props::{Prop, PropEnum};

/// Reads a field of the panel's context as the Rust type of the
/// component's prop, so a panel and its component share prop types.
///
/// ```ignore
/// let layout: Layout = cx.prop("layout").read();
/// if layout == Layout::Grid {
///     // show the column count
/// }
/// ```
pub trait PropField {
    /// The first selected instance's value as `T`; `T`'s default when the
    /// value is missing or of another type.
    fn read<T: Prop>(&self) -> T;
}

impl PropField for Field<'_> {
    fn read<T: Prop>(&self) -> T {
        T::from_value(self.value()).unwrap_or_default()
    }
}

/// The options of an enum prop, in declaration order: each variant's value
/// and title, for a toggle group or select bound to the prop.
pub fn enum_options<T: PropEnum>() -> Vec<Opt> {
    T::VARIANTS
        .iter()
        .map(|(value, title)| tree::opt(*value, *title))
        .collect()
}

/// What `#[component]` reads for a component whose crate exports no panel:
/// `export_panels!` shadows it with an inherent constant.
#[doc(hidden)]
pub trait NoPanel {
    /// Whether the component ships an editor panel.
    const HAS_PANEL: bool = false;
}

/// Whether a panel's `vhp.panels` entry applies to exactly the definition
/// `id`, as `#[panel(for = id)]` writes it.
#[doc(hidden)]
pub const fn panel_targets(manifest: &str, id: &str) -> bool {
    const PREFIX: &[u8] = br#""appliesTo":[{"definition":""#;
    const SUFFIX: &[u8] = br#""}],"#;
    let manifest = manifest.as_bytes();
    let id = id.as_bytes();
    let length = PREFIX.len() + id.len() + SUFFIX.len();
    if manifest.len() < length {
        return false;
    }
    let mut start = 0;
    while start + length <= manifest.len() {
        if matches_at(manifest, start, PREFIX)
            && matches_at(manifest, start + PREFIX.len(), id)
            && matches_at(manifest, start + PREFIX.len() + id.len(), SUFFIX)
        {
            return true;
        }
        start += 1;
    }
    false
}

const fn matches_at(haystack: &[u8], at: usize, needle: &[u8]) -> bool {
    let mut index = 0;
    while index < needle.len() {
        if haystack[at + index] != needle[index] {
            return false;
        }
        index += 1;
    }
    true
}

#[cfg(test)]
mod tests {
    use super::panel_targets;

    #[test]
    fn matches_the_definition_a_panel_applies_to() {
        let manifest = r#"{"id":"settings","title":"Plans","tab":"design","appliesTo":[{"definition":"acme/plan-picker"}],"order":100}"#;
        assert!(panel_targets(manifest, "acme/plan-picker"));
        assert!(!panel_targets(manifest, "acme/plan"));
        assert!(!panel_targets(manifest, "acme/plan-picker-pro"));
        assert!(!panel_targets(manifest, "other/plan-picker"));
    }
}
