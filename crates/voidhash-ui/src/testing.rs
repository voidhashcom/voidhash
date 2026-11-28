//! Unit-testing components on the build machine, without a wasm host.
//!
//! [`Harness`] mounts a component the way the host does, renders its element
//! tree as a [`Value`] and delivers presses, pointers, accessibility
//! actions, timers, layout, canvas frames and typing. A stand-in host
//! records the actions the component requests and, like the real host,
//! refuses purchases, restores and links outside user input, and a value
//! set while the end user is doing nothing.
//!
//! ```ignore
//! use voidhash_ui::testing::{Harness, take_actions};
//! use voidhash_ui::value::object;
//!
//! let mut picker = Harness::mount(&PLAN_PICKER, object([]));
//! assert!(picker.press_text("Continue"));
//! assert_eq!(take_actions()[0].action.get("type").and_then(|t| t.as_str()), Some("purchase"));
//! ```

use alloc::string::String;
use alloc::vec::Vec;

use crate::runtime::{self, Component, InputValue, Phase, RenderFn};
use crate::value::{Map, Value, object};

/// An action the component requested.
#[derive(Clone, Debug, PartialEq)]
pub struct RecordedAction {
    /// The action object, for example `{"type": "purchase", "productId": …}`.
    pub action: Value,
    /// What the module was doing when it asked.
    pub phase: Phase,
    /// Whether the stand-in host accepted it.
    pub accepted: bool,
}

pub(crate) mod stub {
    use super::RecordedAction;
    use crate::runtime::{Phase, phase};
    use crate::value::Value;
    use alloc::string::String;
    use alloc::vec::Vec;
    use core::cell::RefCell;

    #[derive(Default)]
    pub(super) struct Host {
        pub actions: Vec<RecordedAction>,
        pub invalidations: Vec<i32>,
        pub logs: Vec<(i32, String)>,
        pub now: f64,
        pub seed: u64,
        /// Pending timers: id, instance and when they are due.
        pub timers: Vec<(i32, i32, f64)>,
        pub next_timer: i32,
        /// Whether the event being delivered is the user's gesture.
        pub user_input: bool,
        /// Whether the event being delivered is the end user acting,
        /// finished press or not (a drag, typing).
        pub acting: bool,
        /// The value the component set and the harness has not fed back yet.
        pub pending_value: Option<Value>,
        /// Whether the component said the end user is changing its value.
        pub editing: bool,
        /// How many times the component said the end user confirmed it.
        pub submits: u32,
        /// Whether the component said its value is not valid.
        pub invalid: bool,
        /// The keys of the text inputs the component asked the keyboard
        /// for (`None`: its first).
        pub focus_requests: Vec<Option<String>>,
    }

    std::thread_local! {
        pub(super) static HOST: RefCell<Host> = RefCell::new(Host {
            seed: 0x9e37_79b9_7f4a_7c15,
            ..Host::default()
        });
    }

    pub(crate) fn action(encoded: &[u8]) -> bool {
        let action = Value::decode(encoded).unwrap_or(Value::Null);
        let phase = phase();
        let kind = action.get("type").and_then(Value::as_str).map(String::from);
        let needs_gesture = matches!(kind.as_deref(), Some("purchase" | "restore" | "openUrl"));
        // A value, like the keyboard, follows what the end user does.
        let needs_acting = matches!(
            kind.as_deref(),
            Some("value" | "editing" | "submit" | "focusText")
        );
        HOST.with(|host| {
            let mut host = host.borrow_mut();
            let accepted = (!needs_gesture || (phase == Phase::Event && host.user_input))
                && (!needs_acting || (phase == Phase::Event && host.acting));
            if accepted {
                match kind.as_deref() {
                    Some("value") => host.pending_value = action.get("value").cloned(),
                    Some("editing") => {
                        host.editing = action.get("active").and_then(Value::as_bool) == Some(true);
                    }
                    Some("submit") => host.submits += 1,
                    Some("validity") => {
                        host.invalid = action.get("valid").and_then(Value::as_bool) == Some(false);
                    }
                    Some("focusText") => {
                        let key = action.get("key").and_then(Value::as_str).map(String::from);
                        host.focus_requests.push(key);
                    }
                    _ => {}
                }
            }
            host.actions.push(RecordedAction {
                action,
                phase,
                accepted,
            });
            accepted
        })
    }

    pub(crate) fn schedule(instance: i32, seconds: f64) -> i32 {
        HOST.with(|host| {
            let mut host = host.borrow_mut();
            if !seconds.is_finite() || seconds < 0.0 {
                return -1;
            }
            host.next_timer += 1;
            let id = host.next_timer;
            let due = host.now + seconds;
            host.timers.push((id, instance, due));
            id
        })
    }

    pub(crate) fn cancel(timer: i32) {
        HOST.with(|host| host.borrow_mut().timers.retain(|(id, ..)| *id != timer));
    }

    pub(crate) fn invalidate(instance: i32) {
        HOST.with(|host| host.borrow_mut().invalidations.push(instance));
    }

    pub(crate) fn now() -> f64 {
        HOST.with(|host| host.borrow().now)
    }

    pub(crate) fn random() -> f64 {
        HOST.with(|host| {
            let mut host = host.borrow_mut();
            // xorshift64*: deterministic across runs.
            let mut x = host.seed;
            x ^= x >> 12;
            x ^= x << 25;
            x ^= x >> 27;
            host.seed = x;
            (x.wrapping_mul(0x2545_f491_4f6c_dd1d) >> 11) as f64 / (1u64 << 53) as f64
        })
    }

    pub(crate) fn log(level: i32, text: &str) {
        HOST.with(|host| host.borrow_mut().logs.push((level, String::from(text))));
    }
}

/// Drains the actions requested since the last call.
pub fn take_actions() -> Vec<RecordedAction> {
    stub::HOST.with(|host| core::mem::take(&mut host.borrow_mut().actions))
}

/// Drains the instance ids that asked to render again since the last call.
pub fn take_invalidations() -> Vec<i32> {
    stub::HOST.with(|host| core::mem::take(&mut host.borrow_mut().invalidations))
}

/// Drains the log lines (level, text) written since the last call.
pub fn take_logs() -> Vec<(i32, String)> {
    stub::HOST.with(|host| core::mem::take(&mut host.borrow_mut().logs))
}

/// Sets the seconds since mount that `now()` returns.
pub fn set_now(seconds: f64) {
    stub::HOST.with(|host| host.borrow_mut().now = seconds);
}

fn now() -> f64 {
    stub::HOST.with(|host| host.borrow().now)
}

/// Who caused an event, which decides what the host lets its handler do.
#[derive(Clone, Copy, PartialEq, Eq)]
enum Cause {
    /// No one: a timer.
    Host,
    /// The end user acting without having finished a press: a drag, typing.
    /// The handler may set the component's value.
    Acting,
    /// A finished press: the handler may also purchase.
    Press,
}

/// Delivers an event the way the host does.
fn deliver(instance: i32, handler: i32, event: &Value, cause: Cause) -> bool {
    stub::HOST.with(|host| {
        let mut host = host.borrow_mut();
        host.user_input = cause == Cause::Press;
        host.acting = cause != Cause::Host;
    });
    let changed = runtime::event(instance, handler, &event.to_bytes()) & 1 == 1;
    stub::HOST.with(|host| {
        let mut host = host.borrow_mut();
        host.user_input = false;
        host.acting = false;
    });
    changed
}

/// A pointer in a [`Harness::frame`] input.
#[derive(Clone, Copy, Debug)]
pub struct TestPointer {
    /// Pointer id.
    pub id: i64,
    /// Horizontal position in the canvas.
    pub x: f32,
    /// Vertical position in the canvas.
    pub y: f32,
    /// Whether it is pressed.
    pub down: bool,
}

/// A mounted component instance driven like the host drives it.
pub struct Harness {
    instance: i32,
    render: RenderFn,
    tree: Value,
    /// The props the instance has, the reserved ones included.
    props: Map,
}

impl Harness {
    /// Mounts `component` with `props` (an object) and renders it.
    pub fn mount(component: &Component, props: Value) -> Harness {
        let instance = runtime::mount(&props.to_bytes());
        assert!(instance >= 0, "props must be an object");
        // A test starts with what the last one left taken.
        stub::HOST.with(|host| {
            let mut host = host.borrow_mut();
            host.pending_value = None;
            host.editing = false;
            host.submits = 0;
            host.invalid = false;
            host.focus_requests.clear();
        });
        let mut harness = Harness {
            instance,
            render: component.render,
            tree: Value::Null,
            props: match props {
                Value::Object(props) => props,
                _ => Map::new(),
            },
        };
        harness.render();
        harness
    }

    /// Mounts `component` with `props` and `value` as its value, as a flow
    /// whose variable already holds one does.
    pub fn mount_with_value<T: InputValue>(
        component: &Component,
        props: Value,
        value: T,
    ) -> Harness {
        let mut props = match props {
            Value::Object(props) => props,
            _ => Map::new(),
        };
        props.insert("$value", value.into_value());
        Harness::mount(component, Value::Object(props))
    }

    /// Renders the tree again and returns it.
    pub fn render(&mut self) -> &Value {
        let (pointer, len) = runtime::render(self.instance, self.render);
        // SAFETY: the runtime's output buffer stays valid until the next call.
        let bytes = unsafe { core::slice::from_raw_parts(pointer, len) };
        self.tree = Value::decode(bytes).expect("render produced an invalid value");
        &self.tree
    }

    /// The last rendered tree.
    pub fn tree(&self) -> &Value {
        &self.tree
    }

    /// Replaces the props and renders again. The value and the disabled
    /// state the instance had stay as they were.
    pub fn update(&mut self, props: Value) -> &Value {
        let mut next = match props {
            Value::Object(props) => props,
            _ => Map::new(),
        };
        for reserved in ["$value", "$disabled"] {
            if let (None, Some(kept)) = (next.get(reserved), self.props.get(reserved)) {
                next.insert(reserved, kept.clone());
            }
        }
        self.props = next;
        self.send_props()
    }

    fn send_props(&mut self) -> &Value {
        runtime::update(self.instance, &Value::Object(self.props.clone()).to_bytes());
        self.render()
    }

    /// The component's value: the one it set last, or was given. `None`
    /// before either, and for a value of another type.
    pub fn value<T: InputValue>(&self) -> Option<T> {
        self.props.get("$value").and_then(T::from_value)
    }

    /// Changes the component's value from outside, as an action of the
    /// flow or the app does: the component renders with it, and no `change`
    /// runs.
    pub fn set_value<T: InputValue>(&mut self, value: T) -> &Value {
        self.props.insert("$value", value.into_value());
        self.send_props()
    }

    /// Disables or enables the component, as the flow's condition does.
    /// Like the host, the harness delivers a disabled component no presses,
    /// pointers, accessibility actions or typing.
    pub fn set_disabled(&mut self, disabled: bool) -> &Value {
        self.props.insert("$disabled", disabled);
        self.send_props()
    }

    fn disabled(&self) -> bool {
        self.props.get("$disabled").and_then(Value::as_bool) == Some(true)
    }

    /// Whether the component said the end user is changing its value
    /// ([`EventCx::begin_editing`](crate::EventCx::begin_editing)).
    pub fn is_editing(&self) -> bool {
        stub::HOST.with(|host| host.borrow().editing)
    }

    /// How many times the component said the end user confirmed its value
    /// ([`EventCx::submit`](crate::EventCx::submit)).
    pub fn submit_count(&self) -> u32 {
        stub::HOST.with(|host| host.borrow().submits)
    }

    /// Whether the component's value is valid: it is until the component
    /// says otherwise.
    pub fn is_valid(&self) -> bool {
        stub::HOST.with(|host| !host.borrow().invalid)
    }

    /// The text inputs the component asked the keyboard for since the last
    /// call, by key (`None`: its first).
    pub fn take_focus_requests(&mut self) -> Vec<Option<String>> {
        stub::HOST.with(|host| core::mem::take(&mut host.borrow_mut().focus_requests))
    }

    /// Delivers an event and what follows from it: the value the component
    /// set comes back as its `$value`, as the host passes it, and the tree
    /// renders again when anything changed.
    fn dispatch(&mut self, handler: u32, event: &Value, cause: Cause) -> bool {
        if cause != Cause::Host && self.disabled() {
            return false;
        }
        let changed = deliver(self.instance, handler as i32, event, cause);
        let set = stub::HOST.with(|host| host.borrow_mut().pending_value.take());
        match set {
            Some(value) => {
                self.props.insert("$value", value);
                take_invalidations();
                self.send_props();
                changed
            }
            None => self.render_if(changed),
        }
    }

    /// Presses handler `handler` of the last tree. Renders again and returns
    /// true when the component's state changed. A handler that only emits an
    /// action or starts a purchase changes no state and returns false; check
    /// those with [`take_actions`].
    pub fn press(&mut self, handler: u32) -> bool {
        let event = object([("type", "press".into())]);
        self.dispatch(handler, &event, Cause::Press)
    }

    fn render_if(&mut self, changed: bool) -> bool {
        let invalidated = take_invalidations().contains(&self.instance);
        if changed || invalidated {
            self.render();
        }
        changed
    }

    /// Delivers a pointer event (`"down"`, `"move"`, `"up"` or `"cancel"`)
    /// to an `onPointer` handler. Lifting is the user's finished press; the
    /// other phases are the end user acting, which may set the value.
    pub fn pointer(&mut self, handler: u32, phase: &str, x: f32, y: f32) -> bool {
        let event = object([
            ("type", "pointer".into()),
            ("phase", phase.into()),
            ("id", 1.into()),
            ("x", x.into()),
            ("y", y.into()),
        ]);
        let cause = if phase == "up" {
            Cause::Press
        } else {
            Cause::Acting
        };
        self.dispatch(handler, &event, cause)
    }

    /// Delivers an event of the component a
    /// [`ComponentProp::show`](crate::ComponentProp::show) element created
    /// to the element's `onEvent` handler (guest ABI 4): `pressed` when the
    /// end user's finished press raised it, else the end user acting.
    pub fn component_event(
        &mut self,
        handler: u32,
        name: &str,
        payload: Value,
        pressed: bool,
    ) -> bool {
        let event = object([
            ("type", "component".into()),
            ("name", name.into()),
            ("payload", payload),
        ]);
        let cause = if pressed { Cause::Press } else { Cause::Acting };
        self.dispatch(handler, &event, cause)
    }

    /// Performs an accessibility action on an `onAction` handler, as a
    /// screen reader does for the user.
    pub fn accessibility_action(&mut self, handler: u32, action: &str) -> bool {
        let event = object([("type", "accessibility".into()), ("action", action.into())]);
        self.dispatch(handler, &event, Cause::Press)
    }

    /// The first [`text_input`](crate::view::text_input) of the last tree,
    /// or the one with `key`.
    pub fn text_input(&self, key: Option<&str>) -> Option<&Value> {
        find_text_input(&self.tree, key)
    }

    fn text_handler(&self, key: Option<&str>, handler: &str) -> Option<u32> {
        self.text_input(key)?
            .get(handler)
            .and_then(Value::as_f64)
            .map(|id| id as u32)
    }

    /// Makes a text input hold `text` with the caret at its end, as the end
    /// user typing or pasting does, and delivers the `change`. The first
    /// text input, or the one with `key`. Returns whether the component's
    /// state changed; like the host, a field cut short by its own
    /// `maxLength` reports the cut text.
    pub fn type_text(&mut self, key: Option<&str>, text: &str) -> bool {
        let limit = self
            .text_input(key)
            .and_then(|field| field.get("maxLength"))
            .and_then(Value::as_f64);
        let text: String = match limit {
            Some(limit) => text.chars().take(limit as usize).collect(),
            None => String::from(text),
        };
        let Some(handler) = self.text_handler(key, "onChange") else {
            return false;
        };
        let end = text.encode_utf16().count();
        let event = object([
            ("type", "change".into()),
            ("text", text.into()),
            ("selectionBase", end.into()),
            ("selectionExtent", end.into()),
        ]);
        self.dispatch(handler, &event, Cause::Acting)
    }

    /// Presses the return key of a text input (`action` as the host names
    /// it: `"done"`, `"next"`, `"go"`, `"search"`, `"send"` or `"newline"`).
    pub fn submit_text(&mut self, key: Option<&str>, action: &str) -> bool {
        let Some(handler) = self.text_handler(key, "onSubmit") else {
            return false;
        };
        let event = object([("type", "submit".into()), ("action", action.into())]);
        self.dispatch(handler, &event, Cause::Acting)
    }

    /// Gives a text input the keyboard (`focused`) or takes it away.
    pub fn focus_text(&mut self, key: Option<&str>, focused: bool) -> bool {
        let (handler, kind) = if focused {
            ("onFocus", "focus")
        } else {
            ("onBlur", "blur")
        };
        let Some(handler) = self.text_handler(key, handler) else {
            return false;
        };
        let event = object([("type", kind.into())]);
        self.dispatch(handler, &event, Cause::Acting)
    }

    /// Advances the clock by `seconds`, firing the timers that come due on
    /// the way, and renders again when they changed something.
    pub fn advance(&mut self, seconds: f64) {
        let end = now() + seconds;
        loop {
            let due = stub::HOST.with(|host| {
                let host = host.borrow();
                host.timers
                    .iter()
                    .filter(|(_, instance, due)| *instance == self.instance && *due <= end)
                    .min_by(|a, b| a.2.total_cmp(&b.2))
                    .copied()
            });
            let Some((timer, _, due)) = due else {
                break;
            };
            stub::HOST.with(|host| {
                let mut host = host.borrow_mut();
                host.timers.retain(|(id, ..)| *id != timer);
                host.now = host.now.max(due);
            });
            let event = object([("type", "timer".into()), ("id", timer.into())]);
            let changed = deliver(self.instance, -1, &event, Cause::Host);
            self.render_if(changed);
        }
        set_now(end);
    }

    /// Reports the instance's laid-out size, as the host does after layout.
    pub fn layout(&mut self, width: f64, height: f64) {
        runtime::layout(self.instance, width, height);
        self.render_if(false);
    }

    /// Presses the first pressable whose subtree shows `text`. Panics when
    /// there is none. Returns what [`Harness::press`] returns: whether state
    /// changed, not whether a handler ran.
    pub fn press_text(&mut self, text: &str) -> bool {
        let handler = find_press(&self.tree, text, None).expect("no pressable shows this text");
        self.press(handler)
    }

    /// Whether the last tree shows `text` in a visible text element.
    pub fn shows_text(&self, text: &str) -> bool {
        shows(&self.tree, text)
    }

    /// Runs one frame of canvas `canvas` and returns its draw list. Renders
    /// again when the frame asked for it.
    pub fn frame(
        &mut self,
        canvas: u32,
        dt: f64,
        size: (f32, f32),
        pointers: &[TestPointer],
    ) -> Vec<u8> {
        let pointers = pointers
            .iter()
            .map(|pointer| {
                object([
                    ("id", Value::Number(pointer.id as f64)),
                    ("x", pointer.x.into()),
                    ("y", pointer.y.into()),
                    ("down", pointer.down.into()),
                ])
            })
            .collect::<Vec<_>>();
        let input = object([
            ("width", size.0.into()),
            ("height", size.1.into()),
            ("pointers", pointers.into()),
        ]);
        let (pointer, len) = runtime::frame(self.instance, canvas as i32, dt, &input.to_bytes());
        // SAFETY: the runtime's output buffer stays valid until the next call.
        let draw_list = unsafe { core::slice::from_raw_parts(pointer, len) }.to_vec();
        let invalidated = take_invalidations();
        if invalidated.contains(&self.instance) {
            self.render();
        }
        draw_list
    }
}

impl Drop for Harness {
    fn drop(&mut self) {
        runtime::unmount(self.instance);
    }
}

fn hidden(element: &Value) -> bool {
    element
        .get("style")
        .and_then(|style| style.get("display"))
        .and_then(Value::as_str)
        == Some("none")
}

fn children(element: &Value) -> &[Value] {
    element
        .get("children")
        .and_then(Value::as_array)
        .unwrap_or(&[])
}

fn shows(element: &Value, text: &str) -> bool {
    if hidden(element) {
        return false;
    }
    element.get("text").and_then(Value::as_str) == Some(text)
        || children(element).iter().any(|child| shows(child, text))
}

fn find_text_input<'a>(element: &'a Value, key: Option<&str>) -> Option<&'a Value> {
    if hidden(element) {
        return None;
    }
    let is_field = element.get("type").and_then(Value::as_str) == Some("textInput");
    if is_field && (key.is_none() || element.get("key").and_then(Value::as_str) == key) {
        return Some(element);
    }
    children(element)
        .iter()
        .find_map(|child| find_text_input(child, key))
}

fn find_press(element: &Value, text: &str, handler: Option<u32>) -> Option<u32> {
    if hidden(element) {
        return None;
    }
    let handler = element
        .get("onPress")
        .and_then(Value::as_f64)
        .map(|id| id as u32)
        .or(handler);
    if element.get("text").and_then(Value::as_str) == Some(text) {
        return handler;
    }
    children(element)
        .iter()
        .find_map(|child| find_press(child, text, handler))
}

/// An empty props object.
pub fn no_props() -> Value {
    Value::Object(Map::new())
}
