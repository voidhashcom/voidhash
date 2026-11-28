//! Test panels with `cargo test` on the build machine.
//!
//! The [`Harness`] mounts a panel like the designer does, from a context
//! written as JSON, renders its tree and fires its handlers. Assert on the
//! tree with [`find`] and on the intents a handler records.
//!
//! ```
//! use voidhash_ui::panel::standalone::prelude::*;
//! use voidhash_ui::panel::testing::{Harness, find, json};
//!
//! #[panel(for = "core/scrollView")]
//! fn axis(_cx: &mut PanelCx) -> Panel {
//!     panel().child(
//!         button("Make horizontal").on_click(|cx, ()| {
//!             cx.set_prop("horizontal", true);
//!         }),
//!     )
//! }
//!
//! let mut harness = Harness::mount(&AXIS, r#"{ "selection": [] }"#);
//! let tree = harness.render();
//! let button = find(&tree, |node| node.get("type") == Some(&"button".into())).unwrap();
//! let intents = harness.fire(button, "onClick", "[]");
//! assert_eq!(intents, json(r#"[{ "type": "setProp", "prop": "horizontal", "value": true }]"#));
//! ```

use alloc::string::String;
use alloc::vec::Vec;

use crate::panel::runtime::{self, PanelDefinition};
use crate::value::{Map, Value};

/// A mounted panel instance.
pub struct Harness {
    instance: i32,
}

impl Harness {
    /// Mounts `panel` with a context written as JSON.
    pub fn mount(panel: &'static PanelDefinition, context: &str) -> Harness {
        Harness::mount_value(panel, json(context))
    }

    /// Mounts `panel` with a context value.
    pub fn mount_value(panel: &'static PanelDefinition, context: Value) -> Harness {
        let instance = runtime::mount(&[panel], 0, &context.to_bytes());
        assert!(instance >= 0, "the panel refused its context");
        Harness { instance }
    }

    /// Replaces the context, as the host does when the selection changes.
    pub fn update(&mut self, context: &str) {
        runtime::update(self.instance, &json(context).to_bytes());
    }

    /// Renders the panel and returns its tree as the host receives it.
    pub fn render(&mut self) -> Value {
        runtime::render_value(self.instance)
    }

    /// Fires `event` on `node` of the last tree with arguments written as a
    /// JSON array, and returns the intents its handler recorded.
    pub fn fire(&mut self, node: &Value, event: &str, args: &str) -> Value {
        let handler = node
            .get("on")
            .and_then(|on| on.get(event))
            .and_then(Value::as_f64)
            .unwrap_or_else(|| panic!("the node has no {event} handler"));
        let args = json(args);
        runtime::event_value(self.instance, handler as i32, args.items())
    }
}

impl Drop for Harness {
    fn drop(&mut self) {
        runtime::unmount(self.instance);
    }
}

/// The first node of `tree`, in pre-order, that `matches`.
pub fn find(tree: &Value, matches: impl Fn(&Value) -> bool + Copy) -> Option<&Value> {
    if matches(tree) {
        return Some(tree);
    }
    tree.get("children")
        .map(Value::items)
        .unwrap_or(&[])
        .iter()
        .find_map(|child| find(child, matches))
}

/// Whether `node` is of `kind` and has prop `key` equal to `value`.
pub fn is(node: &Value, kind: &str, key: &str, value: &str) -> bool {
    node.get("type").and_then(Value::as_str) == Some(kind)
        && node
            .get("props")
            .and_then(|props| props.get(key))
            .and_then(Value::as_str)
            == Some(value)
}

/// The `vhp.panels` section `panels` produce, parsed.
pub fn manifest(panels: &[&PanelDefinition]) -> Value {
    json(&runtime::section_json(panels))
}

/// Parses JSON into a value. Panics on invalid JSON: it is test input.
pub fn json(text: &str) -> Value {
    let mut parser = Parser {
        bytes: text.as_bytes(),
        at: 0,
    };
    let value = parser.value();
    parser.whitespace();
    assert_eq!(parser.at, parser.bytes.len(), "trailing characters in JSON");
    value
}

/// Writes a value as compact JSON, with keys in insertion order.
pub fn to_json(value: &Value) -> String {
    let mut out = String::new();
    write_json(value, &mut out);
    out
}

fn write_json(value: &Value, out: &mut String) {
    match value {
        Value::Null => out.push_str("null"),
        Value::Bool(value) => out.push_str(if *value { "true" } else { "false" }),
        Value::Number(number) => out.push_str(&std::format!("{number}")),
        Value::String(text) => write_string(text, out),
        Value::Array(items) => {
            out.push('[');
            for (index, item) in items.iter().enumerate() {
                if index > 0 {
                    out.push(',');
                }
                write_json(item, out);
            }
            out.push(']');
        }
        Value::Object(map) => {
            out.push('{');
            for (index, (key, item)) in map.iter().enumerate() {
                if index > 0 {
                    out.push(',');
                }
                write_string(key, out);
                out.push(':');
                write_json(item, out);
            }
            out.push('}');
        }
    }
}

fn write_string(text: &str, out: &mut String) {
    out.push('"');
    for character in text.chars() {
        match character {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\t' => out.push_str("\\t"),
            character if (character as u32) < 0x20 => {
                out.push_str(&std::format!("\\u{:04x}", character as u32));
            }
            character => out.push(character),
        }
    }
    out.push('"');
}

struct Parser<'a> {
    bytes: &'a [u8],
    at: usize,
}

impl Parser<'_> {
    fn whitespace(&mut self) {
        while self
            .bytes
            .get(self.at)
            .is_some_and(|byte| byte.is_ascii_whitespace())
        {
            self.at += 1;
        }
    }

    fn expect(&mut self, literal: &str) {
        assert!(
            self.bytes[self.at..].starts_with(literal.as_bytes()),
            "expected {literal} at {}",
            self.at
        );
        self.at += literal.len();
    }

    fn value(&mut self) -> Value {
        self.whitespace();
        match self.bytes.get(self.at) {
            Some(b'n') => {
                self.expect("null");
                Value::Null
            }
            Some(b't') => {
                self.expect("true");
                Value::Bool(true)
            }
            Some(b'f') => {
                self.expect("false");
                Value::Bool(false)
            }
            Some(b'"') => Value::String(self.string()),
            Some(b'[') => {
                self.at += 1;
                let mut items = Vec::new();
                self.whitespace();
                if self.bytes.get(self.at) == Some(&b']') {
                    self.at += 1;
                    return Value::Array(items);
                }
                loop {
                    items.push(self.value());
                    self.whitespace();
                    match self.bytes.get(self.at) {
                        Some(b',') => self.at += 1,
                        Some(b']') => {
                            self.at += 1;
                            return Value::Array(items);
                        }
                        _ => panic!("expected , or ] at {}", self.at),
                    }
                }
            }
            Some(b'{') => {
                self.at += 1;
                let mut map = Map::new();
                self.whitespace();
                if self.bytes.get(self.at) == Some(&b'}') {
                    self.at += 1;
                    return Value::Object(map);
                }
                loop {
                    self.whitespace();
                    let key = self.string();
                    self.whitespace();
                    self.expect(":");
                    let value = self.value();
                    map.insert(key, value);
                    self.whitespace();
                    match self.bytes.get(self.at) {
                        Some(b',') => self.at += 1,
                        Some(b'}') => {
                            self.at += 1;
                            return Value::Object(map);
                        }
                        _ => panic!("expected , or }} at {}", self.at),
                    }
                }
            }
            _ => self.number(),
        }
    }

    fn string(&mut self) -> String {
        self.expect("\"");
        let mut out = String::new();
        loop {
            let rest = core::str::from_utf8(&self.bytes[self.at..]).expect("JSON is UTF-8");
            let character = rest.chars().next().expect("unterminated JSON string");
            self.at += character.len_utf8();
            match character {
                '"' => return out,
                '\\' => {
                    let escape = self.bytes[self.at];
                    self.at += 1;
                    match escape {
                        b'n' => out.push('\n'),
                        b't' => out.push('\t'),
                        b'u' => {
                            let hex = core::str::from_utf8(&self.bytes[self.at..self.at + 4])
                                .expect("JSON is UTF-8");
                            self.at += 4;
                            let code = u32::from_str_radix(hex, 16).expect("a \\u escape");
                            out.push(char::from_u32(code).expect("a scalar value"));
                        }
                        other => out.push(other as char),
                    }
                }
                character => out.push(character),
            }
        }
    }

    fn number(&mut self) -> Value {
        let start = self.at;
        while self
            .bytes
            .get(self.at)
            .is_some_and(|byte| matches!(byte, b'-' | b'+' | b'.' | b'e' | b'E' | b'0'..=b'9'))
        {
            self.at += 1;
        }
        let text = core::str::from_utf8(&self.bytes[start..self.at]).expect("JSON is UTF-8");
        Value::Number(
            text.parse()
                .unwrap_or_else(|_| panic!("invalid JSON at {start}")),
        )
    }
}
