//! What the host tells a panel about the selection, read through
//! [`PanelCx`](crate::panel::PanelCx).
//!
//! The host sends a new context whenever something the panel can see
//! changes. Everything is limited to the panel's scope: the selected nodes
//! the panel applies to, the props of its definition and the style keys it
//! declared.

use crate::value::Value;

static NULL: Value = Value::Null;

/// One value of the selection: a prop or a style key, across every selected
/// node the panel applies to.
#[derive(Clone, Copy, Debug)]
pub struct Field<'a> {
    value: &'a Value,
}

impl<'a> Field<'a> {
    pub(crate) fn new(value: Option<&'a Value>) -> Field<'a> {
        Field {
            value: value.unwrap_or(&NULL),
        }
    }

    /// The first selected node's value (null when unknown).
    pub fn value(&self) -> &'a Value {
        self.value.get("value").unwrap_or(&NULL)
    }

    /// Whether the selected nodes disagree.
    pub fn mixed(&self) -> bool {
        self.flag("mixed")
    }

    /// Whether every selected node holds the default.
    pub fn is_default(&self) -> bool {
        self.flag("isDefault")
    }

    /// Whether the edited state overrides this style key.
    pub fn overridden(&self) -> bool {
        self.flag("overridden")
    }

    /// The variable the first selected component instance binds this prop
    /// to, or `None` when it holds a value.
    pub fn binding(&self) -> Option<&'a str> {
        self.value.get("binding").and_then(Value::as_str)
    }

    /// Whether the first selected component instance holds a value of this
    /// prop for the translated locale being edited.
    pub fn translated(&self) -> bool {
        self.flag("translated")
    }

    /// The value as a boolean.
    pub fn as_bool(&self) -> Option<bool> {
        self.value().as_bool()
    }

    /// The value as a number.
    pub fn as_f64(&self) -> Option<f64> {
        self.value().as_f64()
    }

    /// The value as a string.
    pub fn as_str(&self) -> Option<&'a str> {
        self.value().as_str()
    }

    fn flag(&self, key: &str) -> bool {
        self.value
            .get(key)
            .and_then(Value::as_bool)
            .unwrap_or(false)
    }
}

/// One selected node the panel applies to.
#[derive(Clone, Copy, Debug)]
pub struct SelectedNode<'a> {
    value: &'a Value,
}

impl<'a> SelectedNode<'a> {
    /// The node's id, which intents may name.
    pub fn id(&self) -> &'a str {
        self.string("id")
    }

    /// The document node type, such as `scrollView`.
    pub fn node_type(&self) -> &'a str {
        self.string("type")
    }

    /// The node's definition, such as `core/scrollView`.
    pub fn definition(&self) -> &'a str {
        self.string("definition")
    }

    /// This node's value of a prop of the panel's definition.
    pub fn prop(&self, name: &str) -> &'a Value {
        self.value
            .get("props")
            .and_then(|props| props.get(name))
            .unwrap_or(&NULL)
    }

    /// This node's value of a style key the panel declared.
    pub fn style(&self, key: &str) -> &'a Value {
        self.value
            .get("style")
            .and_then(|style| style.get(key))
            .unwrap_or(&NULL)
    }

    /// Whether this node's style has `key`, a style key the panel declared.
    /// Nodes of different types carry different keys, so a key every node
    /// of one type has can be missing on another.
    pub fn has_style(&self, key: &str) -> bool {
        self.value
            .get("style")
            .and_then(|style| style.get(key))
            .is_some()
    }

    fn string(&self, key: &str) -> &'a str {
        self.value.get(key).and_then(Value::as_str).unwrap_or("")
    }
}

/// The state whose overrides are being edited.
#[derive(Clone, Copy, Debug)]
pub struct StateOverride<'a> {
    value: &'a Value,
}

impl<'a> StateOverride<'a> {
    /// The state's id.
    pub fn id(&self) -> &'a str {
        self.value.get("id").and_then(Value::as_str).unwrap_or("")
    }

    /// The state's name.
    pub fn name(&self) -> &'a str {
        self.value.get("name").and_then(Value::as_str).unwrap_or("")
    }
}

/// The locale the document is edited in.
#[derive(Clone, Copy, Debug)]
pub struct Locale<'a> {
    value: &'a Value,
}

impl<'a> Locale<'a> {
    /// The document's default locale tag.
    pub fn default_locale(&self) -> &'a str {
        self.value
            .get("default")
            .and_then(Value::as_str)
            .unwrap_or("")
    }

    /// The additional locale being edited, or `None` while editing the
    /// default locale.
    pub fn active(&self) -> Option<&'a str> {
        self.value.get("active").and_then(Value::as_str)
    }

    /// The additional locales the document is translated into.
    pub fn locales(&self) -> impl Iterator<Item = &'a str> {
        self.value
            .get("locales")
            .map(Value::items)
            .unwrap_or(&[])
            .iter()
            .filter_map(Value::as_str)
    }
}

/// A rectangle in canvas coordinates.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Rect {
    /// The left edge.
    pub x: f64,
    /// The top edge.
    pub y: f64,
    /// The width.
    pub width: f64,
    /// The height.
    pub height: f64,
}

impl Rect {
    fn read(value: &Value) -> Option<Rect> {
        let number = |key: &str| value.get(key).and_then(Value::as_f64);
        Some(Rect {
            x: number("x")?,
            y: number("y")?,
            width: number("width")?,
            height: number("height")?,
        })
    }
}

/// Where the selected nodes sit on the canvas, for panels that declared
/// `context("layout")`. Boxes are measured from the canvas, so they are
/// missing until it has drawn the node.
#[derive(Clone, Copy, Debug)]
pub struct Layout<'a> {
    value: &'a Value,
}

impl<'a> Layout<'a> {
    /// The layout of the selected node with `id`.
    pub fn node(&self, id: &str) -> Option<NodeLayout<'a>> {
        self.value
            .get("nodes")
            .map(Value::items)
            .unwrap_or(&[])
            .iter()
            .find(|node| node.get("id").and_then(Value::as_str) == Some(id))
            .map(|value| NodeLayout { value })
    }

    /// Whether the designer can align the selection: several layers with
    /// each other, or one layer within its parent.
    pub fn can_align(&self) -> bool {
        self.flag("canAlign")
    }

    /// Whether the designer can distribute the selection (three or more
    /// layers that move freely).
    pub fn can_distribute(&self) -> bool {
        self.flag("canDistribute")
    }

    fn flag(&self, key: &str) -> bool {
        self.value
            .get(key)
            .and_then(Value::as_bool)
            .unwrap_or(false)
    }
}

/// Where one selected node sits.
#[derive(Clone, Copy, Debug)]
pub struct NodeLayout<'a> {
    value: &'a Value,
}

impl<'a> NodeLayout<'a> {
    /// The node's measured box.
    pub fn bounds(&self) -> Option<Rect> {
        self.value.get("box").and_then(Rect::read)
    }

    /// The node's parent, when it has one.
    pub fn parent(&self) -> Option<ParentLayout<'a>> {
        self.value
            .get("parent")
            .filter(|value| !value.is_null())
            .map(|value| ParentLayout { value })
    }

    /// How the node's `width` or `height` is sized: `fill`, `hug` or
    /// `fixed` (empty for another axis name).
    pub fn sizing(&self, axis: &str) -> &'a str {
        self.value
            .get("sizing")
            .and_then(|sizing| sizing.get(axis))
            .and_then(Value::as_str)
            .unwrap_or("")
    }

    /// The node's offset from its parent's top left corner, when both are
    /// measured.
    pub fn offset(&self) -> Option<(f64, f64)> {
        let own = self.bounds()?;
        let parent = self.parent()?.bounds()?;
        Some((own.x - parent.x, own.y - parent.y))
    }
}

/// A selected node's parent, as its children are laid out by it.
#[derive(Clone, Copy, Debug)]
pub struct ParentLayout<'a> {
    value: &'a Value,
}

impl<'a> ParentLayout<'a> {
    /// The parent's id.
    pub fn id(&self) -> &'a str {
        self.value.get("id").and_then(Value::as_str).unwrap_or("")
    }

    /// The parent's measured box.
    pub fn bounds(&self) -> Option<Rect> {
        self.value.get("box").and_then(Rect::read)
    }

    /// The direction the parent lays its children out in: `row` or
    /// `column`. A parent that does not lay out with flex reports `row`.
    pub fn flex_direction(&self) -> &'a str {
        self.value
            .get("flexDirection")
            .and_then(Value::as_str)
            .unwrap_or("row")
    }

    /// The parent's cross-axis alignment of its children; `stretch` for a
    /// parent that does not lay out with flex.
    pub fn align_items(&self) -> &'a str {
        self.value
            .get("alignItems")
            .and_then(Value::as_str)
            .unwrap_or("stretch")
    }
}

/// Typed reads of a context value.
#[derive(Clone, Copy, Debug)]
pub(crate) struct Context<'a> {
    pub(crate) value: &'a Value,
}

impl<'a> Context<'a> {
    pub(crate) fn selection(&self) -> impl Iterator<Item = SelectedNode<'a>> {
        self.value
            .get("selection")
            .map(Value::items)
            .unwrap_or(&[])
            .iter()
            .map(|value| SelectedNode { value })
    }

    pub(crate) fn prop(&self, name: &str) -> Field<'a> {
        Field::new(self.value.get("props").and_then(|props| props.get(name)))
    }

    pub(crate) fn style(&self, key: &str) -> Field<'a> {
        Field::new(self.value.get("style").and_then(|style| style.get(key)))
    }

    pub(crate) fn state_override(&self) -> Option<StateOverride<'a>> {
        self.value
            .get("state")
            .and_then(|state| state.get("override"))
            .filter(|value| !value.is_null())
            .map(|value| StateOverride { value })
    }

    pub(crate) fn layout(&self) -> Layout<'a> {
        Layout {
            value: self.value.get("layout").unwrap_or(&NULL),
        }
    }

    pub(crate) fn locale(&self) -> Locale<'a> {
        Locale {
            value: self.value.get("locale").unwrap_or(&NULL),
        }
    }

    pub(crate) fn get(&self, key: &str) -> &'a Value {
        self.value.get(key).unwrap_or(&NULL)
    }
}
