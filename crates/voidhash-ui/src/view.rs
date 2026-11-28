//! Views and their modifiers.
//!
//! A component returns a [`View`] tree built with the constructors in this
//! module ([`vstack`], [`text`], [`button`], …) and chained modifiers
//! (`.padding(16)`, `.background(color)`, `.on_tap(…)`). The runtime encodes
//! it into the element tree the host renders natively.

use alloc::boxed::Box;
use alloc::string::String;
use alloc::vec::Vec;

use crate::canvas::Frame;
use crate::particles::Particles;
use crate::runtime::EventCx;
use crate::style::{
    Align, Autofill, Capitalization, Color, Font, Justify, Keyboard, ResizeMode, ReturnKey,
    TextAlign, Transition,
};
use crate::value::write::{
    write_array_header, write_bool, write_key, write_number, write_object_header, write_string,
};
use crate::value::{Map, Value};

pub(crate) type Painter = Box<dyn FnMut(&mut Frame<'_>)>;
type Action = Box<dyn FnMut(&mut EventCx<'_>)>;
type PointerAction = Box<dyn FnMut(&mut EventCx<'_>, PointerEvent)>;
type NativeAction = Box<dyn FnMut(&mut EventCx<'_>, &str, &Value)>;
type TextAction = Box<dyn FnMut(&mut EventCx<'_>, TextChange)>;

/// An event handler of the rendered tree, by what it handles.
pub(crate) enum Handler {
    Press(Action),
    Pointer(PointerAction),
    /// Accessibility actions, by name.
    Actions(Vec<(String, Action)>),
    /// Events a native element emits: their name and payload.
    Native(NativeAction),
    /// What the end user did to the text of a text input.
    Text(TextAction),
}

impl Handler {
    pub(crate) fn handle(&mut self, cx: &mut EventCx<'_>) {
        match self {
            Handler::Press(action) => action(cx),
            Handler::Pointer(action) => {
                if let Some(pointer) = PointerEvent::read(cx.event()) {
                    action(cx, pointer);
                }
            }
            Handler::Actions(actions) => {
                let name = cx
                    .event()
                    .get("action")
                    .and_then(Value::as_str)
                    .map(String::from);
                if let Some((_, action)) = actions
                    .iter_mut()
                    .find(|(candidate, _)| Some(candidate) == name.as_ref())
                {
                    action(cx);
                }
            }
            Handler::Text(action) => {
                let change = TextChange::read(cx.event());
                action(cx, change);
            }
            Handler::Native(action) => {
                let event = cx.event().clone();
                let name = event
                    .get("name")
                    .and_then(Value::as_str)
                    .unwrap_or_default();
                let payload = event.get("payload").cloned().unwrap_or_default();
                action(cx, name, &payload);
            }
        }
    }
}

/// What a pointer did over an element taking pointer events.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PointerPhase {
    /// It touched down on the element.
    Down,
    /// It moved while down.
    Move,
    /// It lifted over the element: the user's gesture, which may purchase.
    Up,
    /// The system took it away, for example for a scroll.
    Cancel,
}

/// A pointer event delivered by [`View::on_pointer`], in the element's
/// logical pixels.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct PointerEvent {
    /// Stable id while the pointer stays in contact.
    pub id: i64,
    /// Horizontal position.
    pub x: f32,
    /// Vertical position.
    pub y: f32,
    /// What the pointer did.
    pub phase: PointerPhase,
}

impl PointerEvent {
    fn read(event: &Value) -> Option<PointerEvent> {
        let number = |key| event.get(key).and_then(Value::as_f64).unwrap_or(0.0);
        let phase = match event.get("phase").and_then(Value::as_str)? {
            "down" => PointerPhase::Down,
            "move" => PointerPhase::Move,
            "up" => PointerPhase::Up,
            _ => PointerPhase::Cancel,
        };
        Some(PointerEvent {
            id: number("id") as i64,
            x: number("x") as f32,
            y: number("y") as f32,
            phase,
        })
    }
}

/// What a [`text_input`] holds after the end user typed, pasted, deleted or
/// moved the caret, delivered by [`View::on_change`].
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TextChange {
    /// The field's whole text.
    pub text: String,
    /// Where the selection starts, in UTF-16 code units of `text`.
    pub selection_base: usize,
    /// Where the selection ends; the caret when it equals the base.
    pub selection_extent: usize,
}

impl TextChange {
    fn read(event: &Value) -> TextChange {
        let offset = |key| event.get(key).and_then(Value::as_f64).unwrap_or(0.0) as usize;
        TextChange {
            text: event
                .get("text")
                .and_then(Value::as_str)
                .map(String::from)
                .unwrap_or_default(),
            selection_base: offset("selectionBase"),
            selection_extent: offset("selectionExtent"),
        }
    }
}

/// The settings and handlers of a [`text_input`].
#[derive(Default)]
struct TextField {
    placeholder: Option<String>,
    multiline: bool,
    keyboard: Option<Keyboard>,
    secure: bool,
    max_length: Option<u32>,
    capitalization: Option<Capitalization>,
    autocorrect: Option<bool>,
    return_key: Option<ReturnKey>,
    autofill: Option<Autofill>,
    on_change: Option<Handler>,
    on_submit: Option<Action>,
    on_focus: Option<Action>,
    on_blur: Option<Action>,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Kind {
    View,
    Pressable,
    Scroll,
    Text,
    Image,
    Canvas,
    Emitter,
    Slot,
    Native,
    TextInput,
    Component,
}

impl Kind {
    fn name(self) -> &'static str {
        match self {
            Kind::View => "view",
            Kind::Pressable => "pressable",
            Kind::Scroll => "scroll",
            Kind::Text => "text",
            Kind::Image => "image",
            Kind::Canvas => "canvas",
            Kind::Emitter => "emitter",
            Kind::Slot => "slot",
            Kind::Native => "native",
            Kind::TextInput => "textInput",
            Kind::Component => "component",
        }
    }

    fn is_container(self) -> bool {
        matches!(self, Kind::View | Kind::Pressable | Kind::Scroll)
    }
}

enum StyleValue {
    Number(f64),
    Keyword(&'static str),
    Text(String),
    Value(Value),
}

/// An element of a component's tree, built with constructors such as
/// [`vstack`] and [`text`] and configured with chained modifiers.
#[must_use = "a view does nothing until it is returned or added as a child"]
pub struct View {
    kind: Kind,
    style: Vec<(&'static str, StyleValue)>,
    transform: Vec<(&'static str, f64)>,
    children: Vec<View>,
    key: Option<String>,
    text: Option<String>,
    src: Option<String>,
    resize_mode: Option<ResizeMode>,
    label: Option<String>,
    role: Option<String>,
    accessibility_value: Option<Value>,
    hint: Option<String>,
    accessibility_actions: Vec<(String, String, Action)>,
    on_press: Option<Action>,
    on_pointer: Option<Handler>,
    on_event: Option<Handler>,
    /// `slot` elements: the slot's name; `component` elements: the
    /// component prop's.
    slot: Option<String>,
    /// `slot` elements of a content prop: the values of its params.
    params: Option<Value>,
    /// `native` elements: the definition id and its props; `component`
    /// elements: the contract props.
    component: Option<String>,
    props: Map,
    painter: Option<Painter>,
    images: Vec<String>,
    active: Option<bool>,
    emitter: Option<Particles>,
    transition: Option<Transition>,
    /// `zstack`: children after the first fill the stack as overlays.
    overlay: bool,
    /// `button`: text modifiers style the label child.
    styles_label: bool,
    /// `text_input`: its settings and handlers.
    field: Option<Box<TextField>>,
    /// Left out of what a screen reader reads, with its children.
    decorative: bool,
    /// Whether a switch or check box is on, for screen readers.
    checked: Option<bool>,
    /// Whether the element is the chosen one of a group, for screen readers.
    selected: Option<bool>,
}

impl View {
    fn new(kind: Kind) -> View {
        View {
            kind,
            style: Vec::new(),
            transform: Vec::new(),
            children: Vec::new(),
            key: None,
            text: None,
            src: None,
            resize_mode: None,
            label: None,
            role: None,
            accessibility_value: None,
            hint: None,
            accessibility_actions: Vec::new(),
            on_press: None,
            on_pointer: None,
            on_event: None,
            slot: None,
            params: None,
            component: None,
            props: Map::new(),
            painter: None,
            images: Vec::new(),
            active: None,
            emitter: None,
            transition: None,
            overlay: false,
            styles_label: false,
            field: None,
            decorative: false,
            checked: None,
            selected: None,
        }
    }

    /// The settings of a [`text_input`]; other elements have none.
    fn field(&mut self) -> &mut TextField {
        assert!(
            self.kind == Kind::TextInput,
            "only text inputs take text input settings"
        );
        self.field.get_or_insert_with(Box::default)
    }

    fn set(&mut self, key: &'static str, value: StyleValue) {
        match self.style.iter_mut().find(|(existing, _)| *existing == key) {
            Some(entry) => entry.1 = value,
            None => self.style.push((key, value)),
        }
    }

    fn has_style(&self, key: &str) -> bool {
        self.style.iter().any(|(existing, _)| *existing == key)
    }

    fn number(mut self, key: &'static str, value: impl Into<f64>) -> View {
        self.set(key, StyleValue::Number(value.into()));
        self
    }

    fn keyword(mut self, key: &'static str, value: &'static str) -> View {
        self.set(key, StyleValue::Keyword(value));
        self
    }

    fn set_text_style(&mut self, key: &'static str, value: StyleValue) {
        match self.children.first_mut() {
            Some(label) if self.styles_label => label.set(key, value),
            _ => self.set(key, value),
        }
    }

    // Children ---------------------------------------------------------------

    /// Appends a child. Only stacks, views, pressables and scroll views take
    /// children.
    pub fn child(mut self, child: View) -> View {
        assert!(self.kind.is_container(), "only containers take children");
        self.children.push(child);
        self
    }

    /// Appends several children.
    pub fn children(mut self, children: impl IntoIterator<Item = View>) -> View {
        assert!(self.kind.is_container(), "only containers take children");
        self.children.extend(children);
        self
    }

    /// Keeps this element's identity across renders among its siblings, so
    /// reordering a list animates and keeps state in the right rows.
    pub fn key(mut self, key: impl Into<String>) -> View {
        self.key = Some(key.into());
        self
    }

    // Spacing ------------------------------------------------------------------

    /// Equal padding on all four edges.
    pub fn padding(self, value: impl Into<f64>) -> View {
        let value = value.into();
        self.padding_edges(value, value, value, value)
    }

    /// Padding on the left and right edges.
    pub fn padding_x(self, value: impl Into<f64>) -> View {
        let value = value.into();
        self.number("paddingLeft", value)
            .number("paddingRight", value)
    }

    /// Padding on the top and bottom edges.
    pub fn padding_y(self, value: impl Into<f64>) -> View {
        let value = value.into();
        self.number("paddingTop", value)
            .number("paddingBottom", value)
    }

    /// Padding per edge: top, right, bottom, left.
    pub fn padding_edges(
        self,
        top: impl Into<f64>,
        right: impl Into<f64>,
        bottom: impl Into<f64>,
        left: impl Into<f64>,
    ) -> View {
        self.number("paddingTop", top)
            .number("paddingRight", right)
            .number("paddingBottom", bottom)
            .number("paddingLeft", left)
    }

    /// Padding on the top edge.
    pub fn padding_top(self, value: impl Into<f64>) -> View {
        self.number("paddingTop", value)
    }

    /// Padding on the bottom edge.
    pub fn padding_bottom(self, value: impl Into<f64>) -> View {
        self.number("paddingBottom", value)
    }

    /// Equal margin on all four edges.
    pub fn margin(self, value: impl Into<f64>) -> View {
        let value = value.into();
        self.number("marginTop", value)
            .number("marginRight", value)
            .number("marginBottom", value)
            .number("marginLeft", value)
    }

    /// Margin on the left and right edges.
    pub fn margin_x(self, value: impl Into<f64>) -> View {
        let value = value.into();
        self.number("marginLeft", value)
            .number("marginRight", value)
    }

    /// Margin on the top and bottom edges.
    pub fn margin_y(self, value: impl Into<f64>) -> View {
        let value = value.into();
        self.number("marginTop", value)
            .number("marginBottom", value)
    }

    /// Margin on the top edge.
    pub fn margin_top(self, value: impl Into<f64>) -> View {
        self.number("marginTop", value)
    }

    /// Margin on the bottom edge.
    pub fn margin_bottom(self, value: impl Into<f64>) -> View {
        self.number("marginBottom", value)
    }

    /// Space between a stack's children (`gap`).
    pub fn spacing(self, value: impl Into<f64>) -> View {
        self.number("gap", value)
    }

    // Size -----------------------------------------------------------------------

    /// A fixed width and height.
    pub fn frame(self, width: impl Into<f64>, height: impl Into<f64>) -> View {
        self.number("width", width).number("height", height)
    }

    /// A fixed width.
    pub fn width(self, value: impl Into<f64>) -> View {
        self.number("width", value)
    }

    /// A fixed height.
    pub fn height(self, value: impl Into<f64>) -> View {
        self.number("height", value)
    }

    /// The full width of the parent.
    pub fn fill_width(self) -> View {
        self.keyword("width", "100%")
    }

    /// The full height of the parent.
    pub fn fill_height(self) -> View {
        self.keyword("height", "100%")
    }

    /// A minimum width.
    pub fn min_width(self, value: impl Into<f64>) -> View {
        self.number("minWidth", value)
    }

    /// A maximum width.
    pub fn max_width(self, value: impl Into<f64>) -> View {
        self.number("maxWidth", value)
    }

    /// A minimum height.
    pub fn min_height(self, value: impl Into<f64>) -> View {
        self.number("minHeight", value)
    }

    /// A maximum height.
    pub fn max_height(self, value: impl Into<f64>) -> View {
        self.number("maxHeight", value)
    }

    /// Width divided by height.
    pub fn aspect_ratio(self, value: impl Into<f64>) -> View {
        self.number("aspectRatio", value)
    }

    /// Grows (and shrinks) along the parent's main axis with this weight.
    pub fn flex(self, value: impl Into<f64>) -> View {
        self.number("flex", value)
    }

    /// Whether this element may shrink below its content size (default yes).
    pub fn shrink(self, value: impl Into<f64>) -> View {
        self.number("flexShrink", value)
    }

    // Layout ---------------------------------------------------------------------

    /// Cross-axis alignment of the children.
    pub fn align(self, align: Align) -> View {
        self.keyword("alignItems", align.keyword())
    }

    /// Main-axis distribution of the children.
    pub fn justify(self, justify: Justify) -> View {
        self.keyword("justifyContent", justify.keyword())
    }

    /// Overrides the parent's cross-axis alignment for this element.
    pub fn align_self(self, align: Align) -> View {
        self.keyword("alignSelf", align.keyword())
    }

    /// Wraps children onto more lines when they do not fit.
    pub fn wrap(self) -> View {
        self.keyword("flexWrap", "wrap")
    }

    /// Lays a scroll view's content out horizontally.
    pub fn horizontal(self) -> View {
        self.keyword("flexDirection", "row")
    }

    /// Positions this element relative to its parent instead of in the flow.
    /// Combine with [`top`](View::top), [`left`](View::left), … or
    /// [`inset`](View::inset).
    pub fn absolute(self) -> View {
        self.keyword("position", "absolute")
    }

    /// Distance from the parent's top edge (absolute elements).
    pub fn top(self, value: impl Into<f64>) -> View {
        self.number("top", value)
    }

    /// Distance from the parent's left edge (absolute elements).
    pub fn left(self, value: impl Into<f64>) -> View {
        self.number("left", value)
    }

    /// Distance from the parent's right edge (absolute elements).
    pub fn right(self, value: impl Into<f64>) -> View {
        self.number("right", value)
    }

    /// Distance from the parent's bottom edge (absolute elements).
    pub fn bottom(self, value: impl Into<f64>) -> View {
        self.number("bottom", value)
    }

    /// The same distance from all four edges of the parent.
    pub fn inset(self, value: impl Into<f64>) -> View {
        let value = value.into();
        self.top(value).right(value).bottom(value).left(value)
    }

    /// Paint order among siblings; higher draws on top.
    pub fn z_index(self, value: impl Into<f64>) -> View {
        self.number("zIndex", value)
    }

    /// Clips children to this element's bounds and corner radius.
    pub fn clip(self) -> View {
        self.keyword("overflow", "hidden")
    }

    /// Hides the element, removing it from layout, when `visible` is false.
    pub fn visible(self, visible: bool) -> View {
        if visible {
            self
        } else {
            self.keyword("display", "none")
        }
    }

    // Appearance -----------------------------------------------------------------

    /// Background colour.
    pub fn background(mut self, color: Color) -> View {
        self.set("backgroundColor", StyleValue::Text(color.to_hex()));
        self
    }

    /// A border of `width` on every edge.
    pub fn border(mut self, width: impl Into<f64>, color: Color) -> View {
        let width = width.into();
        for key in [
            "borderTopWidth",
            "borderRightWidth",
            "borderBottomWidth",
            "borderLeftWidth",
        ] {
            self.set(key, StyleValue::Number(width));
        }
        self.set("borderColor", StyleValue::Text(color.to_hex()));
        self
    }

    /// Rounds all four corners.
    pub fn corner_radius(self, radius: impl Into<f64>) -> View {
        let radius = radius.into();
        self.corner_radii(radius, radius, radius, radius)
    }

    /// Rounds each corner: top left, top right, bottom right, bottom left.
    pub fn corner_radii(
        self,
        top_left: impl Into<f64>,
        top_right: impl Into<f64>,
        bottom_right: impl Into<f64>,
        bottom_left: impl Into<f64>,
    ) -> View {
        self.number("borderTopLeftRadius", top_left)
            .number("borderTopRightRadius", top_right)
            .number("borderBottomRightRadius", bottom_right)
            .number("borderBottomLeftRadius", bottom_left)
    }

    /// Opacity from 0 (invisible) to 1.
    pub fn opacity(self, value: impl Into<f64>) -> View {
        self.number("opacity", value)
    }

    /// A drop shadow.
    pub fn shadow(mut self, color: Color, radius: impl Into<f64>, x: f64, y: f64) -> View {
        let mut offset = crate::value::Map::new();
        offset.insert("width", x);
        offset.insert("height", y);
        self.set("shadowColor", StyleValue::Text(color.to_hex()));
        self.set("shadowRadius", StyleValue::Number(radius.into()));
        self.set("shadowOffset", StyleValue::Value(Value::Object(offset)));
        self
    }

    /// Moves the element by `x`, `y` without affecting layout.
    pub fn offset(mut self, x: impl Into<f64>, y: impl Into<f64>) -> View {
        self.set_transform("translateX", x.into());
        self.set_transform("translateY", y.into());
        self
    }

    /// Scales the element around its centre without affecting layout.
    pub fn scale(mut self, value: impl Into<f64>) -> View {
        self.set_transform("scale", value.into());
        self
    }

    /// Rotates the element by `degrees` around its centre.
    pub fn rotate(mut self, degrees: impl Into<f64>) -> View {
        self.set_transform("rotate", degrees.into());
        self
    }

    fn set_transform(&mut self, key: &'static str, value: f64) {
        match self
            .transform
            .iter_mut()
            .find(|(existing, _)| *existing == key)
        {
            Some(entry) => entry.1 = value,
            None => self.transform.push((key, value)),
        }
    }

    /// Animates this element's style changes natively.
    pub fn transition(mut self, transition: Transition) -> View {
        self.transition = Some(transition);
        self
    }

    /// Sets any style key: the engine's (React Native vocabulary, longhand
    /// keys) or the paywall document's (`fills`, `shadows`, …).
    pub fn style(mut self, key: &'static str, value: impl Into<Value>) -> View {
        self.set(key, StyleValue::Value(value.into()));
        self
    }

    /// Blurs the element with everything inside it (Gaussian sigma).
    pub fn layer_blur(self, sigma: impl Into<f64>) -> View {
        self.number("layerBlur", sigma)
    }

    /// Blurs what shows behind the element (Gaussian sigma).
    pub fn backdrop_blur(self, sigma: impl Into<f64>) -> View {
        self.number("backdropBlur", sigma)
    }

    /// Blends the element with what is behind it (CSS `mix-blend-mode`
    /// keywords, such as `"multiply"` or `"screen"`).
    pub fn blend_mode(self, mode: &'static str) -> View {
        self.keyword("blendMode", mode)
    }

    /// An outline outside the border box, `offset` away from it.
    pub fn outline(mut self, width: impl Into<f64>, color: Color, offset: impl Into<f64>) -> View {
        self.set("outlineEnabled", StyleValue::Value(Value::Bool(true)));
        self.set("outlineWidth", StyleValue::Number(width.into()));
        self.set("outlineOffset", StyleValue::Number(offset.into()));
        self.set("outlineColor", StyleValue::Text(color.to_hex()));
        self
    }

    // Text -----------------------------------------------------------------------

    /// Text font. On a [`button`] this styles the label.
    pub fn font(mut self, font: Font) -> View {
        self.set_text_style("fontSize", StyleValue::Number(f64::from(font.size)));
        self.set_text_style(
            "fontWeight",
            StyleValue::Keyword(weight_keyword(font.weight)),
        );
        if let Some(family) = font.family {
            self.set_text_style("fontFamily", StyleValue::Keyword(family));
        }
        self
    }

    /// Text colour. On a [`button`] this styles the label.
    pub fn color(mut self, color: Color) -> View {
        self.set_text_style("color", StyleValue::Text(color.to_hex()));
        self
    }

    /// Horizontal alignment of text lines.
    pub fn text_align(mut self, align: TextAlign) -> View {
        self.set_text_style("textAlign", StyleValue::Keyword(align.keyword()));
        self
    }

    /// Line height in logical pixels.
    pub fn line_height(mut self, value: impl Into<f64>) -> View {
        self.set_text_style("lineHeight", StyleValue::Number(value.into()));
        self
    }

    /// Extra space between letters in logical pixels.
    pub fn letter_spacing(mut self, value: impl Into<f64>) -> View {
        self.set_text_style("letterSpacing", StyleValue::Number(value.into()));
        self
    }

    /// Strikes the text through, for example a crossed-out original price.
    pub fn strikethrough(mut self) -> View {
        self.set_text_style("textDecorationLine", StyleValue::Keyword("line-through"));
        self
    }

    // Interaction and accessibility --------------------------------------------

    /// Calls `action` when the element is pressed.
    ///
    /// A stack or view becomes pressable; other elements are wrapped in a
    /// pressable. Purchases and other user-initiated actions are only
    /// available here, on the [`EventCx`].
    pub fn on_tap<F, R>(self, mut action: F) -> View
    where
        F: FnMut(&mut EventCx<'_>) -> R + 'static,
    {
        let mut target = match self.kind {
            Kind::View | Kind::Pressable => View {
                kind: Kind::Pressable,
                ..self
            },
            _ => pressable(self),
        };
        target.on_press = Some(Box::new(move |cx| {
            action(cx);
        }));
        target
    }

    /// Leaves the element and its children out of what a screen reader
    /// reads (ABI 3): for what only repeats, to the eye, something another
    /// element already says, as the boxes drawn over a text input do.
    pub fn decorative(mut self) -> View {
        self.decorative = true;
        self
    }

    /// Whether a switch or check box is on, as screen readers announce it
    /// (ABI 3, so for a component with a value). Pair it with
    /// `.role("switch")` or `.role("checkbox")`.
    pub fn checked(mut self, checked: bool) -> View {
        self.checked = Some(checked);
        self
    }

    /// Whether the element is the chosen one of a group, such as a segment
    /// or a chip, as screen readers announce it (ABI 3, so for a component
    /// with a value).
    pub fn selected(mut self, selected: bool) -> View {
        self.selected = Some(selected);
        self
    }

    /// The accessibility label read by screen readers.
    pub fn label(mut self, label: impl Into<String>) -> View {
        self.label = Some(label.into());
        self
    }

    /// The accessibility role, such as `"header"`, `"link"` or
    /// `"adjustable"`, when it is not the element's own.
    pub fn role(mut self, role: impl Into<String>) -> View {
        self.role = Some(role.into());
        self
    }

    /// The value screen readers announce: text, or a number in a range
    /// (`object([("now", 3.into()), ("min", 0.into()), ("max", 10.into())])`).
    pub fn accessibility_value(mut self, value: impl Into<Value>) -> View {
        self.accessibility_value = Some(value.into());
        self
    }

    /// What happens when the element is activated, for screen readers.
    pub fn hint(mut self, hint: impl Into<String>) -> View {
        self.hint = Some(hint.into());
        self
    }

    /// Offers an action to assistive technologies: a standard one
    /// (`"increment"`, `"decrement"`, `"longpress"`, `"escape"`) or a custom
    /// one, shown by `label`. Like a tap, it is the user's gesture.
    pub fn accessibility_action<F, R>(
        mut self,
        name: impl Into<String>,
        label: impl Into<String>,
        mut action: F,
    ) -> View
    where
        F: FnMut(&mut EventCx<'_>) -> R + 'static,
    {
        self.accessibility_actions.push((
            name.into(),
            label.into(),
            Box::new(move |cx| {
                action(cx);
            }),
        ));
        self
    }

    /// Receives the pointer going down, moving, lifting and being taken
    /// away. A view becomes pressable. Lifting over the element is the
    /// user's gesture, so it may purchase; the other phases may not.
    pub fn on_pointer<F, R>(self, mut action: F) -> View
    where
        F: FnMut(&mut EventCx<'_>, PointerEvent) -> R + 'static,
    {
        let mut target = match self.kind {
            Kind::View | Kind::Pressable => View {
                kind: Kind::Pressable,
                ..self
            },
            Kind::Canvas => self,
            _ => pressable(self),
        };
        target.on_pointer = Some(Handler::Pointer(Box::new(move |cx, pointer| {
            action(cx, pointer);
        })));
        target
    }

    /// Receives the events a [`native`] element's component emits, or those
    /// of the contract of the component a
    /// [`ComponentProp::show`](crate::ComponentProp::show) element creates
    /// (name and payload).
    pub fn on_event<F, R>(mut self, mut action: F) -> View
    where
        F: FnMut(&mut EventCx<'_>, &str, &Value) -> R + 'static,
    {
        self.on_event = Some(Handler::Native(Box::new(move |cx, name, payload| {
            action(cx, name, payload);
        })));
        self
    }

    /// Sets a prop of a [`native`] element.
    pub fn prop(mut self, key: impl Into<String>, value: impl Into<Value>) -> View {
        assert!(self.kind == Kind::Native, "only native elements take props");
        self.props.insert(key, value);
        self
    }

    /// Fills a [`button`] with the accent colour, for the primary action.
    pub fn prominent(self) -> View {
        self.background(Color::ACCENT).color(Color::WHITE)
    }

    // Text inputs -----------------------------------------------------------------

    /// Sets the text a [`text_input`] holds. Render the text the component
    /// keeps (from [`View::on_change`], or its [`Input`](crate::Input)) and
    /// the field follows it; render another text to replace what the end
    /// user typed, as a field that only takes digits does. Without it the
    /// field keeps its own text.
    pub fn value(mut self, text: impl Into<String>) -> View {
        self.field();
        self.text = Some(text.into());
        self
    }

    /// The text shown while a [`text_input`] is empty. It also names the
    /// field to a screen reader unless [`View::label`] does.
    pub fn placeholder(mut self, text: impl Into<String>) -> View {
        self.field().placeholder = Some(text.into());
        self
    }

    /// Lets a [`text_input`] hold more than one line.
    pub fn multiline(mut self, multiline: bool) -> View {
        self.field().multiline = multiline;
        self
    }

    /// Which keyboard a [`text_input`] asks for. A keyboard for something
    /// other than prose turns capitalization and autocorrect off unless
    /// they are set.
    pub fn keyboard(mut self, keyboard: Keyboard) -> View {
        self.field().keyboard = Some(keyboard);
        self
    }

    /// Masks the text of a [`text_input`]; a screen reader is not told it.
    pub fn secure(mut self, secure: bool) -> View {
        self.field().secure = secure;
        self
    }

    /// The most characters a [`text_input`] takes, as an end user counts
    /// them.
    pub fn max_length(mut self, characters: u32) -> View {
        self.field().max_length = Some(characters);
        self
    }

    /// What a [`text_input`] capitalizes as the end user types.
    pub fn capitalization(mut self, capitalization: Capitalization) -> View {
        self.field().capitalization = Some(capitalization);
        self
    }

    /// Whether a [`text_input`] corrects what the end user types.
    pub fn autocorrect(mut self, autocorrect: bool) -> View {
        self.field().autocorrect = Some(autocorrect);
        self
    }

    /// The return key of a [`text_input`].
    pub fn return_key(mut self, key: ReturnKey) -> View {
        self.field().return_key = Some(key);
        self
    }

    /// What a [`text_input`] holds, so the device can offer to fill it in.
    pub fn autofill(mut self, autofill: Autofill) -> View {
        self.field().autofill = Some(autofill);
        self
    }

    /// The colour of a [`text_input`]'s placeholder.
    pub fn placeholder_color(mut self, color: Color) -> View {
        self.field();
        self.set("placeholderColor", StyleValue::Text(color.to_hex()));
        self
    }

    /// The colour of a [`text_input`]'s caret.
    pub fn caret_color(mut self, color: Color) -> View {
        self.field();
        self.set("caretColor", StyleValue::Text(color.to_hex()));
        self
    }

    /// The colour behind the selected text of a [`text_input`].
    pub fn selection_color(mut self, color: Color) -> View {
        self.field();
        self.set("selectionColor", StyleValue::Text(color.to_hex()));
        self
    }

    /// Runs when the end user changed the text of a [`text_input`] or
    /// moved its caret. Typing is the end user's doing, so the handler may
    /// set the component's value; it may not purchase.
    pub fn on_change<F, R>(mut self, mut action: F) -> View
    where
        F: FnMut(&mut EventCx<'_>, TextChange) -> R + 'static,
    {
        self.field().on_change = Some(Handler::Text(Box::new(move |cx, change| {
            action(cx, change);
        })));
        self
    }

    /// Runs when the end user pressed the return key of a [`text_input`].
    /// The host then moves the keyboard as the key says, unless the handler
    /// moved it.
    pub fn on_submit<F, R>(mut self, mut action: F) -> View
    where
        F: FnMut(&mut EventCx<'_>) -> R + 'static,
    {
        self.field().on_submit = Some(Box::new(move |cx| {
            action(cx);
        }));
        self
    }

    /// Runs when a [`text_input`] took the keyboard.
    pub fn on_focus<F, R>(mut self, mut action: F) -> View
    where
        F: FnMut(&mut EventCx<'_>) -> R + 'static,
    {
        self.field().on_focus = Some(Box::new(move |cx| {
            action(cx);
        }));
        self
    }

    /// Runs when a [`text_input`] gave the keyboard up.
    pub fn on_blur<F, R>(mut self, mut action: F) -> View
    where
        F: FnMut(&mut EventCx<'_>) -> R + 'static,
    {
        self.field().on_blur = Some(Box::new(move |cx| {
            action(cx);
        }));
        self
    }

    // Element-specific -----------------------------------------------------------

    /// How an [`image`] fills its frame.
    pub fn resize_mode(mut self, mode: ResizeMode) -> View {
        self.resize_mode = Some(mode);
        self
    }

    /// Image URLs a [`canvas`] draws by index.
    pub fn images<S: Into<String>>(mut self, urls: impl IntoIterator<Item = S>) -> View {
        self.images = urls.into_iter().map(Into::into).collect();
        self
    }

    /// Whether a [`canvas`] or [`emitter`] animates (default true).
    pub fn active(mut self, active: bool) -> View {
        self.active = Some(active);
        self
    }

    // Encoding ---------------------------------------------------------------------

    pub(crate) fn encode(
        mut self,
        out: &mut Vec<u8>,
        handlers: &mut Vec<Option<Handler>>,
        painters: &mut Vec<Option<Painter>>,
        overlay: bool,
    ) {
        if overlay && !self.has_style("position") {
            self = self.absolute();
            for edge in ["top", "right", "bottom", "left"] {
                if !self.has_style(edge) {
                    self.set(edge, StyleValue::Number(0.0));
                }
            }
        }
        let has_style = !self.style.is_empty() || !self.transform.is_empty();
        let has_children = self.kind.is_container() && !self.children.is_empty();
        let has_actions = !self.accessibility_actions.is_empty();
        let count = 1
            + usize::from(self.key.is_some())
            + usize::from(has_style)
            + usize::from(self.text.is_some())
            + usize::from(self.src.is_some())
            + usize::from(self.resize_mode.is_some())
            + usize::from(self.label.is_some())
            + usize::from(self.role.is_some())
            + usize::from(self.accessibility_value.is_some())
            + usize::from(self.hint.is_some())
            + 2 * usize::from(has_actions)
            + usize::from(self.on_press.is_some())
            + usize::from(self.on_pointer.is_some())
            + usize::from(self.on_event.is_some())
            + usize::from(self.slot.is_some())
            + usize::from(self.params.is_some())
            + 2 * usize::from(self.kind == Kind::Native)
            + usize::from(self.kind == Kind::Component)
            + usize::from(self.painter.is_some())
            + usize::from(!self.images.is_empty())
            + usize::from(self.active.is_some())
            + usize::from(self.kind == Kind::Emitter)
            + usize::from(self.transition.is_some())
            + usize::from(has_children)
            + usize::from(self.decorative)
            + usize::from(self.checked.is_some())
            + usize::from(self.selected.is_some())
            + self.field.as_ref().map_or(0, |field| {
                usize::from(field.placeholder.is_some())
                    + usize::from(field.multiline)
                    + usize::from(field.keyboard.is_some())
                    + usize::from(field.secure)
                    + usize::from(field.max_length.is_some())
                    + usize::from(field.capitalization.is_some())
                    + usize::from(field.autocorrect.is_some())
                    + usize::from(field.return_key.is_some())
                    + usize::from(field.autofill.is_some())
                    + usize::from(field.on_change.is_some())
                    + usize::from(field.on_submit.is_some())
                    + usize::from(field.on_focus.is_some())
                    + usize::from(field.on_blur.is_some())
            });
        write_object_header(out, count);
        write_key(out, "type");
        write_string(out, self.kind.name());
        if let Some(key) = &self.key {
            write_key(out, "key");
            write_string(out, key);
        }
        if has_style {
            write_key(out, "style");
            self.encode_style(out);
        }
        if let Some(text) = &self.text {
            write_key(out, "text");
            write_string(out, text);
        }
        if let Some(src) = &self.src {
            write_key(out, "src");
            write_string(out, src);
        }
        if let Some(mode) = self.resize_mode {
            write_key(out, "resizeMode");
            write_string(out, mode.keyword());
        }
        if self.decorative {
            write_key(out, "decorative");
            write_bool(out, true);
        }
        if let Some(checked) = self.checked {
            write_key(out, "checked");
            write_bool(out, checked);
        }
        if let Some(selected) = self.selected {
            write_key(out, "selected");
            write_bool(out, selected);
        }
        if let Some(label) = &self.label {
            write_key(out, "label");
            write_string(out, label);
        }
        if let Some(role) = &self.role {
            write_key(out, "role");
            write_string(out, role);
        }
        if let Some(value) = &self.accessibility_value {
            write_key(out, "value");
            value.encode(out);
        }
        if let Some(hint) = &self.hint {
            write_key(out, "hint");
            write_string(out, hint);
        }
        if has_actions {
            write_key(out, "actions");
            write_array_header(out, self.accessibility_actions.len());
            let mut actions = Vec::new();
            for (name, label, action) in self.accessibility_actions.drain(..) {
                write_object_header(out, 2);
                write_key(out, "name");
                write_string(out, &name);
                write_key(out, "label");
                write_string(out, &label);
                actions.push((name, action));
            }
            write_key(out, "onAction");
            write_number(out, handlers.len() as f64);
            handlers.push(Some(Handler::Actions(actions)));
        }
        if let Some(handler) = self.on_press.take() {
            write_key(out, "onPress");
            write_number(out, handlers.len() as f64);
            handlers.push(Some(Handler::Press(handler)));
        }
        for (key, handler) in [
            ("onPointer", self.on_pointer.take()),
            ("onEvent", self.on_event.take()),
        ] {
            if let Some(handler) = handler {
                write_key(out, key);
                write_number(out, handlers.len() as f64);
                handlers.push(Some(handler));
            }
        }
        if let Some(slot) = &self.slot {
            write_key(
                out,
                if self.kind == Kind::Component {
                    "prop"
                } else {
                    "name"
                },
            );
            write_string(out, slot);
        }
        if let Some(params) = self.params.take() {
            write_key(out, "params");
            params.encode(out);
        }
        if self.kind == Kind::Component {
            write_key(out, "props");
            Value::Object(core::mem::take(&mut self.props)).encode(out);
        }
        if let Some(field) = self.field.take() {
            let field = *field;
            if let Some(placeholder) = &field.placeholder {
                write_key(out, "placeholder");
                write_string(out, placeholder);
            }
            for (key, on) in [("multiline", field.multiline), ("secure", field.secure)] {
                if on {
                    write_key(out, key);
                    write_bool(out, true);
                }
            }
            if let Some(length) = field.max_length {
                write_key(out, "maxLength");
                write_number(out, f64::from(length));
            }
            if let Some(autocorrect) = field.autocorrect {
                write_key(out, "autocorrect");
                write_bool(out, autocorrect);
            }
            for (key, keyword) in [
                ("keyboard", field.keyboard.map(Keyboard::keyword)),
                (
                    "capitalization",
                    field.capitalization.map(Capitalization::keyword),
                ),
                ("returnKey", field.return_key.map(ReturnKey::keyword)),
                ("autofill", field.autofill.map(Autofill::keyword)),
            ] {
                if let Some(keyword) = keyword {
                    write_key(out, key);
                    write_string(out, keyword);
                }
            }
            for (key, handler) in [
                ("onChange", field.on_change),
                ("onSubmit", field.on_submit.map(Handler::Press)),
                ("onFocus", field.on_focus.map(Handler::Press)),
                ("onBlur", field.on_blur.map(Handler::Press)),
            ] {
                if let Some(handler) = handler {
                    write_key(out, key);
                    write_number(out, handlers.len() as f64);
                    handlers.push(Some(handler));
                }
            }
        }
        if self.kind == Kind::Native {
            write_key(out, "component");
            write_string(out, self.component.as_deref().unwrap_or_default());
            write_key(out, "props");
            Value::Object(core::mem::take(&mut self.props)).encode(out);
        }
        if let Some(painter) = self.painter.take() {
            write_key(out, "canvas");
            write_number(out, painters.len() as f64);
            painters.push(Some(painter));
        }
        if !self.images.is_empty() {
            write_key(out, "images");
            write_array_header(out, self.images.len());
            for url in &self.images {
                write_string(out, url);
            }
        }
        if let Some(active) = self.active {
            write_key(out, "active");
            write_bool(out, active);
        }
        if self.kind == Kind::Emitter {
            write_key(out, "emitter");
            self.emitter.take().unwrap_or_default().encode(out);
        }
        if let Some(transition) = self.transition {
            write_key(out, "transition");
            transition.to_value().encode(out);
        }
        if has_children {
            write_key(out, "children");
            write_array_header(out, self.children.len());
            let overlay = self.overlay;
            for (index, child) in self.children.into_iter().enumerate() {
                child.encode(out, handlers, painters, overlay && index > 0);
            }
        }
    }

    fn encode_style(&self, out: &mut Vec<u8>) {
        let count = self.style.len() + usize::from(!self.transform.is_empty());
        write_object_header(out, count);
        for (key, value) in &self.style {
            write_key(out, key);
            match value {
                StyleValue::Number(number) => write_number(out, *number),
                StyleValue::Keyword(keyword) => write_string(out, keyword),
                StyleValue::Text(text) => write_string(out, text),
                StyleValue::Value(value) => value.encode(out),
            }
        }
        if !self.transform.is_empty() {
            write_key(out, "transform");
            write_array_header(out, self.transform.len());
            for (key, value) in &self.transform {
                write_object_header(out, 1);
                write_key(out, key);
                if *key == "rotate" {
                    let mut degrees = String::new();
                    crate::numbers::push_fixed(&mut degrees, *value, 3);
                    degrees.push_str("deg");
                    write_string(out, &degrees);
                } else {
                    write_number(out, *value);
                }
            }
        }
    }
}

fn weight_keyword(weight: u16) -> &'static str {
    match weight {
        0..=149 => "100",
        150..=249 => "200",
        250..=349 => "300",
        350..=449 => "400",
        450..=549 => "500",
        550..=649 => "600",
        650..=749 => "700",
        750..=849 => "800",
        _ => "900",
    }
}

/// A plain container. Children stack vertically.
pub fn view() -> View {
    View::new(Kind::View)
}

/// Stacks children vertically, stretched to the stack's width.
pub fn vstack() -> View {
    View::new(Kind::View).keyword("flexDirection", "column")
}

/// Stacks children horizontally, centred vertically.
pub fn hstack() -> View {
    View::new(Kind::View)
        .keyword("flexDirection", "row")
        .keyword("alignItems", "center")
}

/// Layers children on top of each other. The first child sizes the stack;
/// later children fill it as overlays unless they position themselves.
pub fn zstack() -> View {
    let mut stack = View::new(Kind::View);
    stack.overlay = true;
    stack
}

/// Fills the free space along the parent stack's axis.
pub fn spacer() -> View {
    View::new(Kind::View).number("flex", 1)
}

/// A one-pixel separator line.
pub fn divider() -> View {
    View::new(Kind::View)
        .number("height", 1)
        .background(Color::SEPARATOR)
}

/// A vertically scrolling container. Use [`View::horizontal`] to scroll
/// sideways.
pub fn scroll() -> View {
    View::new(Kind::Scroll)
}

/// Text in the paywall's default font. Set `.font` and `.color` to style it.
pub fn text(text: impl Into<String>) -> View {
    let mut view = View::new(Kind::Text);
    view.text = Some(text.into());
    view
}

/// An image loaded from `url`.
pub fn image(url: impl Into<String>) -> View {
    let mut view = View::new(Kind::Image);
    view.src = Some(url.into());
    view
}

/// Makes `child` pressable. Add the action with [`View::on_tap`].
pub fn pressable(child: View) -> View {
    View::new(Kind::Pressable).child(child)
}

/// A pressable with a text label. Text modifiers such as `.font` and
/// `.color` style the label; [`View::prominent`] makes it the primary action.
pub fn button(label: impl Into<String>) -> View {
    let label = text(label)
        .font(Font::HEADLINE)
        .color(Color::PRIMARY)
        .text_align(TextAlign::Center);
    let mut button = View::new(Kind::Pressable)
        .keyword("alignItems", "center")
        .keyword("justifyContent", "center")
        .padding_y(16)
        .padding_x(20)
        .corner_radius(14)
        .background(Color::SURFACE)
        .child(label);
    button.styles_label = true;
    button
}

/// Where the component's children from the paywall document render: those
/// in the default slot.
pub fn slot() -> View {
    View::new(Kind::Slot)
}

/// Where the document children placed in the slot `name` render; declare
/// the component's slots with `#[component(slots("default", "footer"))]`
/// or let the attribute find the `slot_named` calls.
pub fn slot_named(name: impl Into<String>) -> View {
    let mut view = View::new(Kind::Slot);
    let name = name.into();
    if name != "default" {
        view.slot = Some(name);
    }
    view
}

/// Where a content prop's content shows once per `key` (guest ABI 4), with
/// its params' values; see [`Content::show`](crate::Content::show).
pub(crate) fn content_slot(name: &str, key: String, params: Value) -> View {
    let mut view = slot_named(name);
    view.slot = Some(String::from(name));
    view.key = Some(key);
    view.params = Some(params);
    view
}

/// Where the component chosen for a component prop shows (guest ABI 4);
/// see [`ComponentProp::show`](crate::ComponentProp::show).
pub(crate) fn chosen_component(prop: &str, key: String, props: Value) -> View {
    let mut view = View::new(Kind::Component);
    view.slot = Some(String::from(prop));
    view.key = Some(key);
    if let Value::Object(props) = props {
        view.props = props;
    }
    view
}

/// An engine native component by its definition id, such as
/// `"vh/emitter"`, with props set by [`View::prop`]. A runtime that does not
/// provide it shows an empty box.
pub fn native(component: impl Into<String>) -> View {
    let mut view = View::new(Kind::Native);
    view.component = Some(component.into());
    view
}

/// The engine's text field: one editable text with the keyboard, the
/// selection, the caret and input methods handled for the component (ABI
/// 3). Style it like [`text`], and draw whatever belongs around or over it;
/// a field with a transparent [`View::color`] lets the component draw the
/// characters itself, as a row of code boxes does.
///
/// It takes its place in the screen's order of inputs, so a return key
/// labelled [`ReturnKey::Next`] moves to and from it like any text input.
/// A component gets no key events: [`View::on_change`] says what the field
/// holds after every edit.
///
/// A component that calls this from a function other than its own body
/// declares guest ABI 3 itself: `#[component(abi = 3)]`.
pub fn text_input() -> View {
    View::new(Kind::TextInput)
}

/// A surface the component draws every frame. `draw` runs once per frame
/// while the canvas is active; see [`Frame`].
pub fn canvas(draw: impl FnMut(&mut Frame<'_>) + 'static) -> View {
    let mut view = View::new(Kind::Canvas);
    view.painter = Some(Box::new(draw));
    view
}

/// A native particle effect. Particles animate without running component
/// code; toggle it with [`View::active`].
pub fn emitter(particles: Particles) -> View {
    let mut view = View::new(Kind::Emitter);
    view.emitter = Some(particles);
    view
}

// Text size. Kept at the end of the file: a component's module records
// where in this file its panics are, so code added above would change the
// bytes of every component built with it.
impl View {
    /// The most this text grows with the end user's text size, as a multiple
    /// of its size, in a component whose text follows it
    /// (`follows_text_size`): its box can then be sized for at most that
    /// much. Below 1, no limit.
    pub fn max_font_scale(mut self, scale: impl Into<f64>) -> View {
        self.set_text_style("maxFontScale", StyleValue::Number(scale.into()));
        self
    }

    /// Keeps this text at its size whatever the end user's text size, in a
    /// component whose text follows it (`follows_text_size`): for a glyph
    /// standing for an icon, or text sized from `cx.font_scale()` itself.
    pub fn fixed_font_size(mut self) -> View {
        self.set_text_style("fixedFontSize", StyleValue::Value(Value::Bool(true)));
        self
    }
}
