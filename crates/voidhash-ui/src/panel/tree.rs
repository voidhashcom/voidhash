//! The panel tree a panel renders: the host's closed node vocabulary as typed
//! builders.
//!
//! Every builder mirrors one node type of the panel ABI's tree vocabulary:
//! its constructor, a setter per prop and a
//! method per event. Containers take children with [`child`](Section::child)
//! and [`children`](Section::children); `children` takes any iterator,
//! including an `Option`, so `children(open.then(|| …))` adds a child only
//! when `open` is true.
//!
//! The host draws every node with its own controls, so a panel describes
//! what to show, never how it looks.

use alloc::boxed::Box;
use alloc::string::String;
use alloc::vec::Vec;

use crate::panel::bind::Bind;
use crate::panel::runtime::EventCx;
use crate::value::{Map, Value};

/// A boxed event handler: receives the event's arguments.
pub(crate) type Handler = Box<dyn Fn(&mut EventCx, &[Value])>;

/// One node of the panel tree, of any type. Typed builders convert into it.
#[must_use]
pub struct Node {
    pub(crate) kind: &'static str,
    pub(crate) props: Map,
    pub(crate) handlers: Vec<(&'static str, Handler)>,
    pub(crate) bind: Option<Bind>,
    pub(crate) key: Option<String>,
    pub(crate) children: Vec<Node>,
}

impl Node {
    fn new(kind: &'static str) -> Node {
        Node {
            kind,
            props: Map::new(),
            handlers: Vec::new(),
            bind: None,
            key: None,
            children: Vec::new(),
        }
    }

    /// The node's type in the panel tree vocabulary, such as `"section"`.
    pub fn kind(&self) -> &'static str {
        self.kind
    }

    /// Encodes the node and its subtree, moving its handlers into `handlers`
    /// so their position becomes their id.
    pub(crate) fn encode(self, handlers: &mut Vec<Option<Handler>>) -> Value {
        let mut out = Map::new();
        out.insert("type", self.kind);
        if !self.props.is_empty() {
            out.insert("props", Value::Object(self.props));
        }
        if !self.handlers.is_empty() {
            let mut on = Map::new();
            for (name, handler) in self.handlers {
                on.insert(name, handlers.len());
                handlers.push(Some(handler));
            }
            out.insert("on", Value::Object(on));
        }
        if let Some(bind) = self.bind {
            out.insert("bind", bind.encode());
        }
        if let Some(key) = self.key {
            out.insert("key", key);
        }
        if !self.children.is_empty() {
            let children: Vec<Value> = self
                .children
                .into_iter()
                .map(|child| child.encode(handlers))
                .collect();
            out.insert("children", children);
        }
        Value::Object(out)
    }
}

/// An event's arguments as a handler receives them.
pub trait FromArgs: Sized {
    /// Reads the arguments, or `None` when they do not have this shape (the
    /// handler then does not run).
    fn from_args(args: &[Value]) -> Option<Self>;
}

impl FromArgs for () {
    fn from_args(_: &[Value]) -> Option<Self> {
        Some(())
    }
}

impl FromArgs for bool {
    fn from_args(args: &[Value]) -> Option<Self> {
        args.first().and_then(Value::as_bool)
    }
}

impl FromArgs for f64 {
    fn from_args(args: &[Value]) -> Option<Self> {
        args.first().and_then(Value::as_f64)
    }
}

impl FromArgs for String {
    fn from_args(args: &[Value]) -> Option<Self> {
        args.first().and_then(Value::as_str).map(String::from)
    }
}

impl FromArgs for Value {
    fn from_args(args: &[Value]) -> Option<Self> {
        Some(args.first().cloned().unwrap_or_default())
    }
}

/// All of an event's arguments, for events that pass several (a gradient
/// stop's id and position).
#[derive(Clone, Debug, PartialEq)]
pub struct Args(pub Vec<Value>);

impl FromArgs for Args {
    fn from_args(args: &[Value]) -> Option<Self> {
        Some(Args(args.to_vec()))
    }
}

/// One option of a select, toggle group or menu.
#[must_use]
#[derive(Clone, Debug, PartialEq)]
pub struct Opt {
    map: Map,
}

/// An option with `value` and its visible `label`.
pub fn opt(value: impl Into<String>, label: impl Into<String>) -> Opt {
    let mut map = Map::new();
    map.insert("value", value.into());
    map.insert("label", label.into());
    Opt { map }
}

/// An option shown as an icon only, as in toggle groups.
pub fn icon_opt(value: impl Into<String>, icon: &'static str) -> Opt {
    let mut map = Map::new();
    map.insert("value", value.into());
    map.insert("icon", icon);
    Opt { map }
}

impl Opt {
    /// Shows `icon` with the option: an icon token, which a component's
    /// definition may name at run time.
    pub fn icon(mut self, icon: impl Into<String>) -> Self {
        self.map.insert("icon", icon.into());
        self
    }

    /// Greys the option out.
    pub fn disabled(mut self, disabled: bool) -> Self {
        self.map.insert("disabled", disabled);
        self
    }

    /// Says where the option comes from (a variable's owner: "Flow", a
    /// layer's name). The host shows it muted after the label, cuts it short
    /// first, and reads the two as "label from origin".
    pub fn origin(mut self, origin: impl Into<String>) -> Self {
        self.map.insert("origin", origin.into());
        self
    }

    /// A menu entry's second line, muted: why a disabled entry can't be
    /// chosen.
    pub fn description(mut self, description: impl Into<String>) -> Self {
        self.map.insert("description", description.into());
        self
    }

    /// Puts a menu entry under the heading `group`: a menu shows each run
    /// of entries with one group under its heading, set apart from the
    /// entries before it.
    pub fn group(mut self, group: impl Into<String>) -> Self {
        self.map.insert("group", group.into());
        self
    }
}

impl From<Opt> for Value {
    fn from(option: Opt) -> Self {
        Value::Object(option.map)
    }
}

fn options(options: impl IntoIterator<Item = Opt>) -> Value {
    Value::Array(options.into_iter().map(Value::from).collect())
}

// Builder generation --------------------------------------------------------------

macro_rules! node_type {
    ($(#[$doc:meta])* $name:ident = $wire:literal) => {
        $(#[$doc])*
        #[must_use]
        pub struct $name(Node);

        impl From<$name> for Node {
            fn from(node: $name) -> Node {
                node.0
            }
        }

        impl $name {
            fn empty() -> Self {
                $name(Node::new($wire))
            }

            /// Keeps this node's identity across renders among its siblings,
            /// for rows of a list.
            pub fn key(mut self, key: impl Into<String>) -> Self {
                self.0.key = Some(key.into());
                self
            }

            /// Sets a prop by its wire name. Prefer the typed setters; this
            /// reaches props added to the vocabulary after this crate.
            pub fn prop(mut self, key: &'static str, value: impl Into<Value>) -> Self {
                self.0.props.insert(key, value);
                self
            }

            /// Handles an event by its wire name. Prefer the typed methods.
            pub fn on<T: FromArgs>(
                mut self,
                event: &'static str,
                handler: impl Fn(&mut EventCx, T) + 'static,
            ) -> Self {
                self.0.handlers.push((
                    event,
                    Box::new(move |cx: &mut EventCx, args: &[Value]| {
                        if let Some(args) = T::from_args(args) {
                            handler(cx, args);
                        }
                    }),
                ));
                self
            }
        }
    };
}

macro_rules! container {
    ($name:ident) => {
        impl $name {
            /// Appends a child.
            pub fn child(mut self, child: impl Into<Node>) -> Self {
                self.0.children.push(child.into());
                self
            }

            /// Appends children. An `Option` adds its child only when it is
            /// `Some`.
            pub fn children<C: Into<Node>>(
                mut self,
                children: impl IntoIterator<Item = C>,
            ) -> Self {
                self.0.children.extend(children.into_iter().map(Into::into));
                self
            }
        }
    };
}

macro_rules! props {
    ($name:ident { $($(#[$doc:meta])* $method:ident: $ty:tt => $key:literal),* $(,)? }) => {
        impl $name {
            $(props!(@setter $(#[$doc])* $method: $ty => $key);)*
        }
    };
    (@setter $(#[$doc:meta])* $method:ident: str => $key:literal) => {
        $(#[$doc])*
        pub fn $method(mut self, value: impl Into<String>) -> Self {
            self.0.props.insert($key, value.into());
            self
        }
    };
    (@setter $(#[$doc:meta])* $method:ident: token => $key:literal) => {
        $(#[$doc])*
        pub fn $method(mut self, value: &'static str) -> Self {
            self.0.props.insert($key, value);
            self
        }
    };
    (@setter $(#[$doc:meta])* $method:ident: bool => $key:literal) => {
        $(#[$doc])*
        pub fn $method(mut self, value: bool) -> Self {
            self.0.props.insert($key, value);
            self
        }
    };
    (@setter $(#[$doc:meta])* $method:ident: num => $key:literal) => {
        $(#[$doc])*
        pub fn $method(mut self, value: impl Into<f64>) -> Self {
            self.0.props.insert($key, value.into());
            self
        }
    };
    (@setter $(#[$doc:meta])* $method:ident: value => $key:literal) => {
        $(#[$doc])*
        pub fn $method(mut self, value: impl Into<Value>) -> Self {
            self.0.props.insert($key, value);
            self
        }
    };
    (@setter $(#[$doc:meta])* $method:ident: options => $key:literal) => {
        $(#[$doc])*
        pub fn $method(mut self, value: impl IntoIterator<Item = Opt>) -> Self {
            self.0.props.insert($key, options(value));
            self
        }
    };
}

macro_rules! events {
    ($name:ident { $($(#[$doc:meta])* $method:ident($ty:ty) => $key:literal),* $(,)? }) => {
        impl $name {
            $(
                $(#[$doc])*
                pub fn $method(self, handler: impl Fn(&mut EventCx, $ty) + 'static) -> Self {
                    self.on($key, handler)
                }
            )*
        }
    };
}

macro_rules! bindable {
    ($name:ident) => {
        impl $name {
            /// Lets the host own the field: it shows the bound prop's or
            /// style key's value and Mixed state and writes changes itself,
            /// as one undo step per gesture. See [`crate::panel::bind`].
            pub fn bind(mut self, bind: Bind) -> Self {
                self.0.bind = Some(bind);
                self
            }
        }
    };
}

// Chrome and layout -----------------------------------------------------------------

node_type!(
    /// The root of a panel. Its children are usually [`Section`]s.
    Panel = "panel"
);
container!(Panel);

/// The root of a panel.
pub fn panel() -> Panel {
    Panel::empty()
}

node_type!(
    /// A titled section of the right panel.
    Section = "section"
);
container!(Section);
props!(Section {
    /// The heading.
    title: str => "title",
    /// Whether the header toggles the body.
    collapsible: bool => "collapsible",
    /// Whether a collapsible section starts collapsed.
    default_collapsed: bool => "defaultCollapsed",
});
events!(Section {
    /// The header's toggle was pressed; receives whether the section should collapse.
    on_toggle(bool) => "onToggle",
});

impl Section {
    /// Adds buttons to the section header, such as the add and remove
    /// buttons of a fill.
    pub fn actions(self, actions: SectionActions) -> Self {
        self.child(actions)
    }
}

/// A section titled `title`.
pub fn section(title: impl Into<String>) -> Section {
    Section::empty().title(title)
}

/// A section without a heading, which continues the section above it: the
/// two read as one, with no line between them.
pub fn untitled_section() -> Section {
    Section::empty()
}

node_type!(
    /// The buttons in a section header. Children are [`Button`]s and [`Menu`]s.
    SectionActions = "sectionActions"
);
container!(SectionActions);

/// A section's header buttons.
pub fn section_actions() -> SectionActions {
    SectionActions::empty()
}

node_type!(
    /// A titled group inside a section.
    Subsection = "subsection"
);
container!(Subsection);
props!(Subsection {
    /// The group's heading.
    title: str => "title",
});

/// A group titled `title`.
pub fn subsection(title: impl Into<String>) -> Subsection {
    Subsection::empty().title(title)
}

/// A group without a heading, spaced like a titled one.
pub fn untitled_subsection() -> Subsection {
    Subsection::empty()
}

node_type!(
    /// Children side by side.
    Row = "row"
);
container!(Row);
props!(Row {
    /// Space between children: `none`, `xs`, `sm`, `md` or `lg`.
    gap: token => "gap",
    /// `auto`, `full` or `half`.
    width: token => "width",
    /// Cross-axis alignment: `start`, `center`, `end` or `stretch`.
    align: token => "align",
    /// Main-axis distribution: `start`, `center`, `end` or `between`.
    justify: token => "justify",
});

/// A row.
pub fn row() -> Row {
    Row::empty()
}

node_type!(
    /// Buttons joined in one bar.
    ButtonGroup = "buttonGroup"
);
container!(ButtonGroup);

/// A button group.
pub fn button_group() -> ButtonGroup {
    ButtonGroup::empty()
}

node_type!(
    /// Children stacked vertically.
    Column = "column"
);
container!(Column);
props!(Column {
    /// Space between children: `none`, `xs`, `sm`, `md` or `lg`.
    gap: token => "gap",
    /// `auto`, `full` or `half`.
    width: token => "width",
    /// Cross-axis alignment: `start`, `center`, `end` or `stretch`.
    align: token => "align",
});

/// A column.
pub fn column() -> Column {
    Column::empty()
}

node_type!(
    /// A labelled row of controls.
    Field = "field"
);
container!(Field);
props!(Field {
    /// The label.
    label: str => "label",
    /// A leading icon token.
    icon: token => "icon",
    /// A short note on the row, shown when the label is hovered or focused:
    /// something the row's control does not say, such as who writes it.
    note: str => "note",
});

/// A field labelled `label`.
pub fn field(label: impl Into<String>) -> Field {
    Field::empty().label(label)
}

node_type!(
    /// Static text.
    Text = "text"
);
props!(Text {
    /// The text.
    content: str => "content",
    /// `label`, `body`, `caption` or `heading`.
    variant: token => "variant",
    /// `default`, `muted`, `info`, `warning` or `error`.
    tone: token => "tone",
});

/// Static text.
pub fn text(content: impl Into<String>) -> Text {
    Text::empty().content(content)
}

node_type!(
    /// A message banner.
    Callout = "callout"
);
props!(Callout {
    /// The message.
    message: str => "message",
    /// `default`, `muted`, `info`, `warning` or `error`.
    tone: token => "tone",
});

/// A banner showing `message`.
pub fn callout(message: impl Into<String>) -> Callout {
    Callout::empty().message(message)
}

node_type!(
    /// A popover: a [`PopoverTrigger`] and a [`PopoverContent`].
    Popover = "popover"
);
container!(Popover);
props!(Popover {
    /// Whether it is open; the host keeps its own state when unset.
    open: bool => "open",
    /// Shows it this many milliseconds after `open` turns true, so a popover
    /// opened from a menu item waits for the menu to close.
    open_delay: num => "openDelay",
});
events!(Popover {
    /// It opened or closed.
    on_open_change(bool) => "onOpenChange",
});

/// A popover.
pub fn popover() -> Popover {
    Popover::empty()
}

node_type!(
    /// What opens a popover.
    PopoverTrigger = "popoverTrigger"
);
container!(PopoverTrigger);

/// A popover's trigger.
pub fn popover_trigger() -> PopoverTrigger {
    PopoverTrigger::empty()
}

node_type!(
    /// The body of a popover.
    PopoverContent = "popoverContent"
);
container!(PopoverContent);
props!(PopoverContent {
    /// `start`, `center` or `end`.
    align: token => "align",
    /// `top`, `right`, `bottom` or `left`.
    side: token => "side",
    /// A header title; pair it with [`on_close`](Self::on_close) for its close button.
    title: str => "title",
});
events!(PopoverContent {
    /// The header's close button was pressed.
    on_close(()) => "onClose",
});

/// A popover's body.
pub fn popover_content() -> PopoverContent {
    PopoverContent::empty()
}

node_type!(
    /// A dropdown menu button.
    Menu = "menu"
);
props!(Menu {
    /// The entries.
    items: options => "items",
    /// The checked entry.
    value: str => "value",
    /// `start`, `center` or `end`.
    align: token => "align",
    /// The trigger's icon token.
    icon: token => "icon",
    /// The trigger's label (its accessible name when it shows an icon).
    label: str => "label",
    /// `default`, `outline`, `ghost` or `destructive`.
    variant: token => "variant",
    /// `sm`, `icon-sm` or `default`.
    size: token => "size",
    /// A designer action whose shortcut the trigger's tooltip shows.
    shortcut_action: str => "shortcutAction",
});
events!(Menu {
    /// An entry was chosen; receives its value.
    on_select(String) => "onSelect",
});

/// A menu.
pub fn menu() -> Menu {
    Menu::empty()
}

// Controls ------------------------------------------------------------------------

node_type!(
    /// A text or number input.
    TextField = "textField"
);
bindable!(TextField);
props!(TextField {
    /// `text` or `number`.
    kind: token => "kind",
    /// The shown text.
    value: str => "value",
    /// Shows the Mixed placeholder.
    mixed: bool => "mixed",
    /// The placeholder and accessible name.
    placeholder: str => "placeholder",
    /// The smallest number.
    min: num => "min",
    /// The largest number.
    max: num => "max",
    /// The scrub and arrow-key step.
    step: num => "step",
    /// A leading icon token; dragging it scrubs a number.
    icon: token => "icon",
    /// Greys the field out.
    disabled: bool => "disabled",
    /// A trailing menu: `{ items, value }`.
    trailing_menu: value => "trailingMenu",
    /// The most characters the field takes.
    max_length: num => "maxLength",
    /// Entries of a menu beside the field whose `value` is text to insert:
    /// choosing one puts it at the caret, replacing the selection (at the
    /// end in a field never focused), and commits the result as `onCommit`.
    insert_items: options => "insertItems",
    /// The insert menu's accessible name.
    insert_label: str => "insertLabel",
});
events!(TextField {
    /// The text changed while typing or scrubbing.
    on_change(String) => "onChange",
    /// Editing ended (blur or Enter); receives the final text.
    on_commit(String) => "onCommit",
    /// A trailing menu entry was chosen.
    on_trailing_select(String) => "onTrailingSelect",
});

/// A text input.
pub fn text_field() -> TextField {
    TextField::empty().kind("text")
}

/// A number input.
pub fn number_field() -> TextField {
    TextField::empty().kind("number")
}

node_type!(
    /// A dropdown of options.
    SelectField = "selectField"
);
bindable!(SelectField);
props!(SelectField {
    /// The selected value.
    value: str => "value",
    /// The options.
    options: options => "options",
    /// The placeholder and accessible name.
    placeholder: str => "placeholder",
    /// Shows the Mixed state.
    mixed: bool => "mixed",
    /// Greys the field out.
    disabled: bool => "disabled",
    /// A leading icon token.
    icon: token => "icon",
});
events!(SelectField {
    /// An option was chosen; receives its value.
    on_change(String) => "onChange",
});

/// A select.
pub fn select_field() -> SelectField {
    SelectField::empty()
}

node_type!(
    /// A segmented control.
    ToggleGroup = "toggleGroup"
);
bindable!(ToggleGroup);
props!(ToggleGroup {
    /// The selected value.
    value: str => "value",
    /// The segments.
    options: options => "options",
    /// Selects no segment.
    mixed: bool => "mixed",
    /// Greys the control out.
    disabled: bool => "disabled",
    /// `full` stretches it across its container.
    width: token => "width",
    /// The group's accessible name, for a group no field names.
    label: str => "label",
});
events!(ToggleGroup {
    /// A segment was chosen; receives its value.
    on_change(String) => "onChange",
});

/// A segmented control.
pub fn toggle_group() -> ToggleGroup {
    ToggleGroup::empty()
}

node_type!(
    /// An on/off switch.
    SwitchField = "switchField"
);
bindable!(SwitchField);
props!(SwitchField {
    /// Whether it is on.
    checked: bool => "checked",
    /// The selection disagrees.
    mixed: bool => "mixed",
    /// A label.
    label: str => "label",
    /// Greys the switch out.
    disabled: bool => "disabled",
});
events!(SwitchField {
    /// It was toggled; receives the new state.
    on_change(bool) => "onChange",
});

/// A switch.
pub fn switch_field() -> SwitchField {
    SwitchField::empty()
}

node_type!(
    /// A labelled checkbox.
    CheckboxField = "checkboxField"
);
bindable!(CheckboxField);
props!(CheckboxField {
    /// Whether it is checked.
    checked: bool => "checked",
    /// Draws the indeterminate state.
    mixed: bool => "mixed",
    /// The label.
    label: str => "label",
    /// Greys the checkbox out.
    disabled: bool => "disabled",
});
events!(CheckboxField {
    /// It was toggled; receives the new state.
    on_change(bool) => "onChange",
});

/// A checkbox labelled `label`.
pub fn checkbox_field(label: impl Into<String>) -> CheckboxField {
    CheckboxField::empty().label(label)
}

node_type!(
    /// A button.
    Button = "button"
);
props!(Button {
    /// The label (the accessible name of an icon button).
    label: str => "label",
    /// Muted text after the label.
    hint: str => "hint",
    /// An icon token.
    icon: token => "icon",
    /// `default`, `outline`, `ghost` or `destructive`.
    variant: token => "variant",
    /// `sm`, `icon-sm` or `default`.
    size: token => "size",
    /// `full` stretches it across its container.
    width: token => "width",
    /// Greys the button out.
    disabled: bool => "disabled",
    /// A designer action whose shortcut an icon button's tooltip shows.
    shortcut_action: str => "shortcutAction",
});
events!(Button {
    /// It was pressed.
    on_click(()) => "onClick",
});

/// A button labelled `label`.
pub fn button(label: impl Into<String>) -> Button {
    Button::empty().label(label)
}

node_type!(
    /// A range slider.
    SliderField = "sliderField"
);
bindable!(SliderField);
props!(SliderField {
    /// The value.
    value: num => "value",
    /// The smallest value.
    min: num => "min",
    /// The largest value.
    max: num => "max",
    /// The step.
    step: num => "step",
    /// The selection disagrees.
    mixed: bool => "mixed",
    /// Greys the slider out.
    disabled: bool => "disabled",
});
events!(SliderField {
    /// The thumb moved.
    on_change(f64) => "onChange",
    /// The thumb was released.
    on_commit(f64) => "onCommit",
});

/// A slider.
pub fn slider_field() -> SliderField {
    SliderField::empty()
}

node_type!(
    /// Shows a reset dot over its children, for values a state overrides.
    ResetAffordance = "resetAffordance"
);
container!(ResetAffordance);
props!(ResetAffordance {
    /// Whether the dot shows.
    show: bool => "show",
    /// What is reset, for the dot's tooltip.
    label: str => "label",
});
events!(ResetAffordance {
    /// The dot was pressed.
    on_reset(()) => "onReset",
});

/// A reset affordance for `label`.
pub fn reset_affordance(label: impl Into<String>) -> ResetAffordance {
    ResetAffordance::empty().label(label)
}

node_type!(
    /// A labelled list: an add button in its header, and each child as one
    /// item with a remove button.
    ListEditor = "listEditor"
);
container!(ListEditor);
props!(ListEditor {
    /// The heading.
    label: str => "label",
    /// The add button's tooltip.
    add_label: str => "addLabel",
    /// Whether the add button is enabled, such as below a maximum length.
    can_add: bool => "canAdd",
    /// The selection holds different lists: shows Mixed instead of items.
    mixed: bool => "mixed",
});
events!(ListEditor {
    /// The add button was pressed.
    on_add(()) => "onAdd",
    /// An item's remove button was pressed; receives the item's index.
    on_remove(f64) => "onRemove",
});

/// A list editor labelled `label`; its children are its items.
pub fn list_editor(label: impl Into<String>) -> ListEditor {
    ListEditor::empty().label(label)
}

// Composites ----------------------------------------------------------------------

node_type!(
    /// A colour input with its picker.
    ColorField = "colorField"
);
bindable!(ColorField);
props!(ColorField {
    /// The colour (`rgba(…)`).
    value: str => "value",
    /// The selection disagrees.
    mixed: bool => "mixed",
    /// What Mixed reads as.
    mixed_label: str => "mixedLabel",
    /// Greys the field out.
    disabled: bool => "disabled",
    /// `rgba` (the default) or `hex`: whether the value and the events'
    /// colours are `rgba(…)` strings or `#RRGGBB`/`#RRGGBBAA` hex.
    format: token => "format",
});
events!(ColorField {
    /// The colour changed (live while dragging).
    on_change(String) => "onChange",
    /// A drag in the picker started.
    on_drag_start(()) => "onDragStart",
    /// The change was committed.
    on_commit(String) => "onCommit",
    /// The change was abandoned.
    on_discard(()) => "onDiscard",
});

/// A colour field.
pub fn color_field() -> ColorField {
    ColorField::empty()
}

node_type!(
    /// An inline colour picker.
    ColorPicker = "colorPicker"
);
props!(ColorPicker {
    /// The colour (`#rrggbb`).
    color: str => "color",
    /// The opacity, 0–100.
    opacity: num => "opacity",
});
events!(ColorPicker {
    /// The colour changed.
    on_color_change(String) => "onColorChange",
    /// The opacity changed.
    on_opacity_change(f64) => "onOpacityChange",
    /// A drag started.
    on_drag_start(()) => "onDragStart",
    /// A drag ended.
    on_drag_end(()) => "onDragEnd",
    /// The drag was abandoned.
    on_discard(()) => "onDiscard",
});

/// A colour picker.
pub fn color_picker() -> ColorPicker {
    ColorPicker::empty()
}

node_type!(
    /// A gradient's stop bar.
    GradientStops = "gradientStops"
);
props!(GradientStops {
    /// The stops: `[{ id, position, color }]`.
    stops: value => "stops",
    /// The selected stop's id.
    selected_stop_id: num => "selectedStopId",
});
events!(GradientStops {
    /// A stop was selected; receives its id.
    on_select(Value) => "onSelect",
    /// A stop was added; receives its position.
    on_add_stop(Value) => "onAddStop",
    /// A stop moved; receives its id and position.
    on_move_stop(Args) => "onMoveStop",
    /// A stop was removed; receives its id.
    on_remove_stop(Value) => "onRemoveStop",
    /// A drag started.
    on_drag_start(()) => "onDragStart",
    /// A drag ended.
    on_drag_end(()) => "onDragEnd",
    /// The drag was abandoned.
    on_discard(()) => "onDiscard",
});

/// A gradient stop bar.
pub fn gradient_stops() -> GradientStops {
    GradientStops::empty()
}

node_type!(
    /// A small colour or image chip.
    Swatch = "swatch"
);
props!(Swatch {
    /// The colour.
    color: str => "color",
    /// An image URL.
    image_url: str => "imageUrl",
});

/// A swatch.
pub fn swatch() -> Swatch {
    Swatch::empty()
}

node_type!(
    /// An image picker; the host owns the asset library.
    ImageField = "imageField"
);
props!(ImageField {
    /// The image URL.
    url: str => "url",
    /// `cover`, `contain` or `stretch`.
    resize_mode: token => "resizeMode",
});
events!(ImageField {
    /// An image was picked; receives its URL.
    on_pick(String) => "onPick",
    /// The resize mode changed.
    on_resize_mode_change(String) => "onResizeModeChange",
    /// The image was removed.
    on_clear(()) => "onClear",
});

/// An image field.
pub fn image_field() -> ImageField {
    ImageField::empty()
}

node_type!(
    /// The 3×3 flex alignment grid.
    AlignmentGrid = "alignmentGrid"
);
props!(AlignmentGrid {
    /// `row` or `column`.
    flex_direction: token => "flexDirection",
    /// The cross-axis alignment.
    align_items: token => "alignItems",
    /// The main-axis distribution.
    justify_content: token => "justifyContent",
    /// The selection disagrees.
    mixed: bool => "mixed",
});
events!(AlignmentGrid {
    /// A cell was chosen; receives `{ alignItems, justifyContent }`.
    on_change(Value) => "onChange",
});

/// An alignment grid.
pub fn alignment_grid() -> AlignmentGrid {
    AlignmentGrid::empty()
}

node_type!(
    /// A width or height input with its Fixed/Hug/Fill menu.
    DimensionField = "dimensionField"
);
props!(DimensionField {
    /// `width` or `height`.
    axis: token => "axis",
    /// `fixed`, `hug`, `fill` or `custom`.
    mode: token => "mode",
    /// The size.
    value: num => "value",
    /// `percent` when the size is a percentage of the parent's; absent, points.
    unit: token => "unit",
    /// The label.
    label: str => "label",
    /// The selection disagrees.
    mixed: bool => "mixed",
    /// Greys the field out.
    disabled: bool => "disabled",
    /// The measured size, shown when it is not fixed.
    computed: num => "computed",
});
events!(DimensionField {
    /// The size changed while typing or scrubbing: a number, or text ending
    /// in `%` for a percentage of the parent's size.
    on_change(Value) => "onChange",
    /// Editing ended.
    on_commit(Value) => "onCommit",
    /// The sizing mode changed: `custom`, `hug`, `fill`, or `percent` for a
    /// percentage of the parent's size.
    on_mode_change(String) => "onModeChange",
});

/// A dimension field for `axis` (`width` or `height`).
pub fn dimension_field(axis: &'static str) -> DimensionField {
    DimensionField::empty().axis(axis)
}

node_type!(
    /// A fill row with its editor popover (solid, gradient and image).
    FillField = "fillField"
);
props!(FillField {
    /// The label.
    label: str => "label",
    /// `solid`, `gradient` or `image`.
    background_type: token => "backgroundType",
    /// The selection disagrees on the type.
    is_type_mixed: bool => "isTypeMixed",
    /// The solid colour.
    background_color: str => "backgroundColor",
    /// The gradient.
    gradient: value => "gradient",
    /// The selected gradient stop.
    selected_stop_index: num => "selectedStopIndex",
    /// The image.
    image: value => "image",
    /// Whether the editor is open.
    open: bool => "open",
});
events!(FillField {
    /// The fill type changed.
    on_type_change(String) => "onTypeChange",
    /// The solid colour changed.
    on_color_change(String) => "onColorChange",
    /// The gradient changed.
    on_gradient_change(Value) => "onGradientChange",
    /// A stop's colour changed.
    on_stop_color_change(Args) => "onStopColorChange",
    /// A stop moved.
    on_stop_position_change(Args) => "onStopPositionChange",
    /// A stop was added.
    on_add_stop(Args) => "onAddStop",
    /// A stop was added at a position.
    on_add_stop_at(Args) => "onAddStopAt",
    /// A stop was removed.
    on_remove_stop(Args) => "onRemoveStop",
    /// A stop was selected.
    on_select_stop(Args) => "onSelectStop",
    /// The image URL changed.
    on_image_url_change(String) => "onImageUrlChange",
    /// The image resize mode changed.
    on_image_resize_mode_change(String) => "onImageResizeModeChange",
    /// A drag started.
    on_gesture_start(()) => "onGestureStart",
    /// The edit was committed.
    on_commit(()) => "onCommit",
    /// The edit was abandoned.
    on_discard(()) => "onDiscard",
    /// The editor opened or closed.
    on_open_change(bool) => "onOpenChange",
});

/// A fill field.
pub fn fill_field() -> FillField {
    FillField::empty()
}

node_type!(
    /// A variable binding picker.
    VariableField = "variableField"
);
props!(VariableField {
    /// The bound variable's id.
    variable_id: str => "variableId",
    /// The bound variable's name.
    variable_name: str => "variableName",
    /// The bound variable's type.
    variable_type: value => "variableType",
    /// The variable kinds offered.
    allowed_kinds: value => "allowedKinds",
    /// The label.
    label: str => "label",
});
events!(VariableField {
    /// A variable was bound; receives `{ type, value }`.
    on_bind(Value) => "onBind",
    /// The binding was removed.
    on_unbind(()) => "onUnbind",
    /// A new variable was requested.
    on_create(Value) => "onCreate",
});

/// A variable field.
pub fn variable_field() -> VariableField {
    VariableField::empty()
}

node_type!(
    /// An action editor.
    ActionEditorField = "actionEditorField"
);
props!(ActionEditorField {
    /// The action.
    value: value => "value",
    /// The variables it can set.
    variables: value => "variables",
    /// The product variables it can purchase.
    product_variables: value => "productVariables",
    /// The flow's screens: `[{ id, name }]`.
    screens: value => "screens",
    /// Fields of the triggering component action's payload.
    payload_fields: value => "payloadFields",
});
events!(ActionEditorField {
    /// The action changed.
    on_change(Value) => "onChange",
});

/// An action editor.
pub fn action_editor_field() -> ActionEditorField {
    ActionEditorField::empty()
}

node_type!(
    /// A product picker.
    ProductField = "productField"
);
props!(ProductField {
    /// The picked product's id.
    product_id: str => "productId",
    /// The placeholder.
    placeholder: str => "placeholder",
    /// Greys the field out.
    disabled: bool => "disabled",
    /// The label.
    label: str => "label",
});
events!(ProductField {
    /// A product was picked; receives its id (`""` when cleared).
    on_change(String) => "onChange",
});

/// A product field.
pub fn product_field() -> ProductField {
    ProductField::empty()
}

node_type!(
    /// A font picker over the fonts uploaded to the organization's asset
    /// library, with the default font first; the host lists and uploads them.
    FontField = "fontField"
);
props!(FontField {
    /// The picked font's asset id; `""` is the default font.
    font_id: str => "fontId",
    /// The selection holds different fonts.
    mixed: bool => "mixed",
    /// Greys the field out.
    disabled: bool => "disabled",
});
events!(FontField {
    /// A font was picked; receives its asset id (`""` for the default font).
    on_change(String) => "onChange",
});

/// A font field.
pub fn font_field() -> FontField {
    FontField::empty()
}
