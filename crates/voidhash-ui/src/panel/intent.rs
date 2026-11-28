//! Intents: the changes a panel asks the host to make.
//!
//! A panel never writes the document. Its event handlers record intents,
//! and the host validates them against the panel's scope and applies them
//! after the handler returns. Every write of one event is one undo step;
//! [`Intents::transaction`] names it. Edits that preview while the user
//! drags go through a draft, which lands as one undo step when committed.

use alloc::vec::Vec;

use crate::value::{Map, Value};

/// The intents an event handler records. [`EventCx`](crate::panel::EventCx)
/// dereferences to it.
#[derive(Debug, Default)]
pub struct Intents {
    list: Vec<Value>,
}

fn intent(kind: &str) -> Map {
    let mut map = Map::new();
    map.insert("type", kind);
    map
}

impl Intents {
    pub(crate) fn into_value(self) -> Value {
        Value::Array(self.list)
    }

    /// Whether nothing was recorded.
    pub fn is_empty(&self) -> bool {
        self.list.is_empty()
    }

    /// Appends intents recorded elsewhere, such as by a helper shared by
    /// several handlers.
    pub fn append(&mut self, other: Intents) -> &mut Self {
        self.list.extend(other.list);
        self
    }

    fn push(&mut self, intent: Map) -> &mut Self {
        self.list.push(Value::Object(intent));
        self
    }

    /// Sets a prop of the panel's definition on every selected node. While a
    /// translated locale is edited, a localizable prop of a component
    /// instance takes the value in that locale only.
    pub fn set_prop(&mut self, prop: &str, value: impl Into<Value>) -> &mut Self {
        let mut intent = intent("setProp");
        intent.insert("prop", prop);
        intent.insert("value", value);
        self.push(intent)
    }

    /// Sets a prop on the selected nodes with these ids only.
    pub fn set_prop_on(
        &mut self,
        nodes: &[&str],
        prop: &str,
        value: impl Into<Value>,
    ) -> &mut Self {
        let mut intent = intent("setProp");
        intent.insert("prop", prop);
        intent.insert("value", value);
        intent.insert("nodes", ids(nodes));
        self.push(intent)
    }

    /// Binds a prop of the selected component instances to a variable in
    /// scope of each of them (one of the context's `bindableVariables`).
    pub fn bind_prop(&mut self, prop: &str, variable: &str) -> &mut Self {
        let mut intent = intent("bindProp");
        intent.insert("prop", prop);
        intent.insert("variable", variable);
        self.push(intent)
    }

    /// Restores a prop's default on every selected node. While a translated
    /// locale is edited, a localizable prop of a component instance drops
    /// that locale's value instead.
    pub fn reset_prop(&mut self, prop: &str) -> &mut Self {
        let mut intent = intent("resetProp");
        intent.insert("prop", prop);
        self.push(intent)
    }

    /// Sets a style key on every selected node, in the state being edited.
    pub fn set_style(&mut self, key: &str, value: impl Into<Value>) -> &mut Self {
        let mut style = Map::new();
        style.insert(key, value);
        self.set_styles(style)
    }

    /// Sets several style keys at once.
    pub fn set_styles(&mut self, style: Map) -> &mut Self {
        let mut intent = intent("setStyle");
        intent.insert("style", Value::Object(style));
        self.push(intent)
    }

    /// Sets several style keys on the selected nodes with these ids only,
    /// for keys some selected nodes do not have.
    pub fn set_styles_on(&mut self, nodes: &[&str], style: Map) -> &mut Self {
        let mut intent = intent("setStyle");
        intent.insert("style", Value::Object(style));
        intent.insert("nodes", ids(nodes));
        self.push(intent)
    }

    /// Sets style keys in the base style of the nodes with these ids, even
    /// while a state is edited: for values states do not override, such as
    /// a shape's size.
    pub fn set_base_styles_on(&mut self, nodes: &[&str], style: Map) -> &mut Self {
        let mut intent = intent("setStyle");
        intent.insert("style", Value::Object(style));
        intent.insert("nodes", ids(nodes));
        intent.insert("base", true);
        self.push(intent)
    }

    /// Removes the edited state's overrides of these style keys, so they
    /// show the base style again.
    pub fn reset_style(&mut self, keys: &[&str]) -> &mut Self {
        let mut intent = intent("resetStyle");
        intent.insert("keys", ids(keys));
        self.push(intent)
    }

    /// Sets document data of a core node outside its props and style, such
    /// as its `name` or `sharedElementId` (document scope).
    pub fn set_node_data(&mut self, key: &str, value: impl Into<Value>) -> &mut Self {
        let mut data = Map::new();
        data.insert(key, value);
        let mut intent = intent("setNodeData");
        intent.insert("data", Value::Object(data));
        self.push(intent)
    }

    /// Groups writes into one undo step named `label`.
    pub fn transaction(&mut self, label: &str, record: impl FnOnce(&mut Intents)) -> &mut Self {
        let mut inner = Intents::default();
        record(&mut inner);
        let mut intent = intent("transaction");
        intent.insert("label", label);
        intent.insert("intents", inner.into_value());
        self.push(intent)
    }

    /// Opens a draft: until it is committed or cancelled, writes preview
    /// live and stay out of the undo history.
    pub fn begin_draft(&mut self) -> &mut Self {
        self.draft_phase("begin", None)
    }

    /// Records writes into the open draft, opening it if needed.
    pub fn in_draft(&mut self, record: impl FnOnce(&mut Intents)) -> &mut Self {
        let mut inner = Intents::default();
        record(&mut inner);
        self.draft_phase("update", Some(inner))
    }

    /// Applies the draft's net change as one undo step.
    pub fn commit_draft(&mut self) -> &mut Self {
        self.draft_phase("commit", None)
    }

    /// Applies the draft's net change as one undo step named `label`.
    pub fn commit_draft_as(&mut self, label: &str) -> &mut Self {
        let mut intent = intent("draft");
        intent.insert("phase", "commit");
        intent.insert("label", label);
        self.push(intent)
    }

    /// Drops the draft's changes.
    pub fn cancel_draft(&mut self) -> &mut Self {
        self.draft_phase("cancel", None)
    }

    fn draft_phase(&mut self, phase: &str, intents: Option<Intents>) -> &mut Self {
        let mut intent = intent("draft");
        intent.insert("phase", phase);
        if let Some(intents) = intents {
            intent.insert("intents", intents.into_value());
        }
        self.push(intent)
    }

    /// Stores a value the host keeps for this panel across remounts and
    /// passes back as the context's `ui`.
    pub fn set_ui(&mut self, value: impl Into<Value>) -> &mut Self {
        let mut intent = intent("setUiState");
        intent.insert("value", value);
        self.push(intent)
    }

    /// Opens the State Manager for a selected node (document scope).
    pub fn open_state_manager(&mut self, node: &str) -> &mut Self {
        let mut intent = service("openStateManager");
        intent.insert("node", node);
        self.push(intent)
    }

    /// Opens the State Manager for a selected node (document scope) on a
    /// new state, its name ready to be typed.
    pub fn add_state(&mut self, node: &str) -> &mut Self {
        let mut intent = service("openStateManager");
        intent.insert("node", node);
        intent.insert("adding", true);
        self.push(intent)
    }

    /// Shows an error toast.
    pub fn toast_error(&mut self, message: &str) -> &mut Self {
        let mut intent = service("toastError");
        intent.insert("message", message);
        self.push(intent)
    }

    /// Runs a host command by name with its params (document scope).
    pub fn command(&mut self, name: &str, params: impl Into<Value>) -> &mut Self {
        let mut intent = intent("command");
        intent.insert("name", name);
        intent.insert("params", params);
        self.push(intent)
    }
}

fn service(name: &str) -> Map {
    let mut map = intent("service");
    map.insert("name", name);
    map
}

fn ids(values: &[&str]) -> Value {
    Value::Array(values.iter().map(|value| Value::from(*value)).collect())
}
