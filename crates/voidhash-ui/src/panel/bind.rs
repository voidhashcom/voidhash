//! Bound fields: controls the host edits on the panel's behalf.
//!
//! A field built with `.bind(bind::prop("horizontal"))` carries no value and
//! no handlers of its own. The host shows the selection's value of the
//! bound prop or style key (Mixed when the selected nodes disagree) and
//! writes every change itself: live drafts while the user scrubs, types or
//! drags, one undo step per gesture, and the panel is not called while it
//! happens. Bind every field that edits one value directly, and use handlers
//! for fields that compute what they write.
//!
//! ```
//! use voidhash_ui::panel::standalone::prelude::*;
//!
//! let opacity = number_field()
//!     .icon("percent")
//!     .bind(bind::style("opacity").scale(100.0).range(0.0, 100.0).decimals(0).fallback(1.0));
//! # let _ = opacity;
//! ```

use alloc::string::String;

use crate::value::{Map, Value};

/// What a field is bound to, and how its value is shown.
#[must_use]
#[derive(Clone, Debug, PartialEq)]
pub struct Bind {
    map: Map,
}

/// Binds a field to a prop of the panel's definition.
pub fn prop(name: impl Into<String>) -> Bind {
    let mut map = Map::new();
    map.insert("prop", name.into());
    Bind { map }
}

/// Binds a field to a style key the panel declared in its `style` list.
pub fn style(key: impl Into<String>) -> Bind {
    let mut map = Map::new();
    map.insert("style", key.into());
    Bind { map }
}

impl Bind {
    /// Shows the stored number multiplied by `factor` (`100` shows a 0–1
    /// opacity as a percentage) and divides typed numbers by it.
    pub fn scale(mut self, factor: f64) -> Self {
        self.map.insert("scale", factor);
        self
    }

    /// Binds one field of an object prop instead of the whole prop: the
    /// field shows that field of the prop's value and writes only it.
    pub fn field(mut self, name: impl Into<String>) -> Self {
        self.map.insert("field", name.into());
        self
    }

    /// Clamps typed numbers to `min..=max`, in shown units.
    pub fn range(self, min: f64, max: f64) -> Self {
        self.min(min).max(max)
    }

    /// Clamps typed numbers to at least `min`, in shown units.
    pub fn min(mut self, min: f64) -> Self {
        self.map.insert("min", min);
        self
    }

    /// Clamps typed numbers to at most `max`, in shown units.
    pub fn max(mut self, max: f64) -> Self {
        self.map.insert("max", max);
        self
    }

    /// Rounds the shown number to `digits` decimals.
    pub fn decimals(mut self, digits: u32) -> Self {
        self.map.insert("decimals", digits);
        self
    }

    /// The stored value assumed when the node has none.
    pub fn fallback(mut self, value: impl Into<Value>) -> Self {
        self.map.insert("fallback", value);
        self
    }

    /// Names the undo step of the field's changes: a direct write, or the
    /// gesture a typed, scrubbed or dragged change commits.
    pub fn label(mut self, label: impl Into<String>) -> Self {
        self.map.insert("label", label.into());
        self
    }

    pub(crate) fn encode(self) -> Value {
        Value::Object(self.map)
    }
}
