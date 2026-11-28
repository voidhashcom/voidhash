//! The structured values Voidhash components and editor panels exchange with
//! their host: props, events and actions of components (guest ABI), and the
//! contexts, trees and intents of panels (panel ABI). Both ABIs use this one
//! encoding.
//!
//! ```
//! use voidhash_ui::value::{object, Value};
//! let payload = object([("productId", Value::from("pro-annual"))]);
//! assert_eq!(payload.get("productId").and_then(Value::as_str), Some("pro-annual"));
//! ```
//!
//! The binary encoding is little-endian. Each value starts with a tag byte:
//! `0` null, `1` false, `2` true, `3` number (`f64`), `4` string (`u32` byte
//! length and UTF-8 bytes), `5` array (`u32` count and values) and `6` object
//! (`u32` count and key/value pairs with unique string keys).

use alloc::string::String;
use alloc::vec::Vec;

use write::{write_array_header, write_key, write_number, write_object_header, write_string};

/// Values may nest at most this many levels deep.
pub const MAX_DEPTH: usize = 64;

const TAG_NULL: u8 = 0;
const TAG_FALSE: u8 = 1;
const TAG_TRUE: u8 = 2;
const TAG_NUMBER: u8 = 3;
const TAG_STRING: u8 = 4;
const TAG_ARRAY: u8 = 5;
const TAG_OBJECT: u8 = 6;

/// A structured value: the data model of props, events and actions.
#[derive(Clone, Debug, PartialEq, Default)]
pub enum Value {
    /// No value.
    #[default]
    Null,
    /// A boolean.
    Bool(bool),
    /// A number. Every number is an `f64`.
    Number(f64),
    /// A UTF-8 string.
    String(String),
    /// An ordered list of values.
    Array(Vec<Value>),
    /// String keys mapped to values.
    Object(Map),
}

/// An object's entries in insertion order. Keys are unique: inserting an
/// existing key replaces its value.
#[derive(Clone, Debug, PartialEq, Default)]
pub struct Map(Vec<(String, Value)>);

impl Map {
    /// An empty object.
    pub const fn new() -> Self {
        Self(Vec::new())
    }

    /// Sets `key` to `value`, replacing an existing entry.
    pub fn insert(&mut self, key: impl Into<String>, value: impl Into<Value>) {
        let key = key.into();
        let value = value.into();
        match self.0.iter_mut().find(|(existing, _)| *existing == key) {
            Some(entry) => entry.1 = value,
            None => self.0.push((key, value)),
        }
    }

    /// The value stored under `key`.
    pub fn get(&self, key: &str) -> Option<&Value> {
        self.0
            .iter()
            .find(|(existing, _)| existing == key)
            .map(|(_, value)| value)
    }

    /// The entries in insertion order.
    pub fn iter(&self) -> impl Iterator<Item = (&str, &Value)> {
        self.0.iter().map(|(key, value)| (key.as_str(), value))
    }

    /// The number of entries.
    pub fn len(&self) -> usize {
        self.0.len()
    }

    /// Whether the object has no entries.
    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }
}

/// Builds an object value from key/value pairs. Later pairs replace earlier
/// pairs with the same key.
///
/// ```
/// use voidhash_ui::value::{object, Value};
/// let payload = object([("productId", Value::from("pro-annual"))]);
/// assert_eq!(payload.get("productId").and_then(Value::as_str), Some("pro-annual"));
/// ```
pub fn object<const N: usize>(entries: [(&str, Value); N]) -> Value {
    let mut map = Map::new();
    for (key, value) in entries {
        map.insert(key, value);
    }
    Value::Object(map)
}

impl Value {
    /// The value under `key` when this is an object.
    pub fn get(&self, key: &str) -> Option<&Value> {
        match self {
            Value::Object(map) => map.get(key),
            _ => None,
        }
    }

    /// The string when this is a string.
    pub fn as_str(&self) -> Option<&str> {
        match self {
            Value::String(value) => Some(value),
            _ => None,
        }
    }

    /// The number when this is a number.
    pub fn as_f64(&self) -> Option<f64> {
        match self {
            Value::Number(value) => Some(*value),
            _ => None,
        }
    }

    /// The boolean when this is a boolean.
    pub fn as_bool(&self) -> Option<bool> {
        match self {
            Value::Bool(value) => Some(*value),
            _ => None,
        }
    }

    /// The items when this is an array.
    pub fn as_array(&self) -> Option<&[Value]> {
        match self {
            Value::Array(items) => Some(items),
            _ => None,
        }
    }

    /// The entries when this is an object.
    pub fn as_object(&self) -> Option<&Map> {
        match self {
            Value::Object(map) => Some(map),
            _ => None,
        }
    }

    /// The items when this is an array, or no items otherwise.
    pub fn items(&self) -> &[Value] {
        self.as_array().unwrap_or(&[])
    }

    /// Whether this is null.
    pub fn is_null(&self) -> bool {
        matches!(self, Value::Null)
    }

    /// Appends the binary encoding of this value to `out`.
    pub fn encode(&self, out: &mut Vec<u8>) {
        match self {
            Value::Null => out.push(TAG_NULL),
            Value::Bool(false) => out.push(TAG_FALSE),
            Value::Bool(true) => out.push(TAG_TRUE),
            Value::Number(number) => write_number(out, *number),
            Value::String(text) => write_string(out, text),
            Value::Array(items) => {
                write_array_header(out, items.len());
                for item in items {
                    item.encode(out);
                }
            }
            Value::Object(map) => {
                write_object_header(out, map.len());
                for (key, value) in map.iter() {
                    write_key(out, key);
                    value.encode(out);
                }
            }
        }
    }

    /// The binary encoding of this value.
    pub fn to_bytes(&self) -> Vec<u8> {
        let mut out = Vec::new();
        self.encode(&mut out);
        out
    }

    /// Decodes exactly one value from `bytes`.
    pub fn decode(bytes: &[u8]) -> Result<Value, DecodeError> {
        let mut reader = Reader { bytes, at: 0 };
        let value = reader.value(0)?;
        if reader.at != bytes.len() {
            return Err(DecodeError::TrailingBytes);
        }
        Ok(value)
    }
}

/// Why bytes are not a valid value.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DecodeError {
    /// The bytes end inside a value.
    Truncated,
    /// A tag byte is not one of the known tags.
    UnknownTag(u8),
    /// A string is not valid UTF-8.
    InvalidUtf8,
    /// An object repeats a key.
    DuplicateKey,
    /// Values nest deeper than [`MAX_DEPTH`].
    TooDeep,
    /// Bytes follow the value.
    TrailingBytes,
}

impl DecodeError {
    /// A short description of the error.
    pub fn message(self) -> &'static str {
        match self {
            DecodeError::Truncated => "value is truncated",
            DecodeError::UnknownTag(_) => "unknown value tag",
            DecodeError::InvalidUtf8 => "string is not valid UTF-8",
            DecodeError::DuplicateKey => "object has a duplicate key",
            DecodeError::TooDeep => "value nests too deeply",
            DecodeError::TrailingBytes => "bytes follow the value",
        }
    }
}

struct Reader<'a> {
    bytes: &'a [u8],
    at: usize,
}

impl<'a> Reader<'a> {
    fn take(&mut self, count: usize) -> Result<&'a [u8], DecodeError> {
        let end = self.at.checked_add(count).ok_or(DecodeError::Truncated)?;
        let slice = self.bytes.get(self.at..end).ok_or(DecodeError::Truncated)?;
        self.at = end;
        Ok(slice)
    }

    fn u32(&mut self) -> Result<usize, DecodeError> {
        let bytes = self.take(4)?;
        Ok(u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]) as usize)
    }

    fn string(&mut self) -> Result<String, DecodeError> {
        let length = self.u32()?;
        let bytes = self.take(length)?;
        core::str::from_utf8(bytes)
            .map(String::from)
            .map_err(|_| DecodeError::InvalidUtf8)
    }

    /// A capacity hint that a hostile count cannot inflate: every item needs
    /// at least one more byte.
    fn capacity(&self, count: usize) -> usize {
        count.min(self.bytes.len() - self.at)
    }

    fn value(&mut self, depth: usize) -> Result<Value, DecodeError> {
        if depth >= MAX_DEPTH {
            return Err(DecodeError::TooDeep);
        }
        let tag = self.take(1)?[0];
        Ok(match tag {
            TAG_NULL => Value::Null,
            TAG_FALSE => Value::Bool(false),
            TAG_TRUE => Value::Bool(true),
            TAG_NUMBER => {
                let bytes = self.take(8)?;
                let mut raw = [0; 8];
                raw.copy_from_slice(bytes);
                Value::Number(f64::from_le_bytes(raw))
            }
            TAG_STRING => Value::String(self.string()?),
            TAG_ARRAY => {
                let count = self.u32()?;
                let mut items = Vec::with_capacity(self.capacity(count));
                for _ in 0..count {
                    items.push(self.value(depth + 1)?);
                }
                Value::Array(items)
            }
            TAG_OBJECT => {
                let count = self.u32()?;
                let mut entries: Vec<(String, Value)> = Vec::with_capacity(self.capacity(count));
                for _ in 0..count {
                    let key = self.string()?;
                    if entries.iter().any(|(existing, _)| *existing == key) {
                        return Err(DecodeError::DuplicateKey);
                    }
                    let value = self.value(depth + 1)?;
                    entries.push((key, value));
                }
                Value::Object(Map(entries))
            }
            other => return Err(DecodeError::UnknownTag(other)),
        })
    }
}

/// Streaming encoders: write a value's encoding piece by piece, without
/// building a [`Value`] first. A header announces how many items or entries
/// follow; the caller writes exactly that many.
pub mod write {
    use alloc::vec::Vec;

    use super::{TAG_ARRAY, TAG_FALSE, TAG_NUMBER, TAG_OBJECT, TAG_STRING, TAG_TRUE};

    /// A `u32` length or count, little-endian.
    pub fn write_u32(out: &mut Vec<u8>, value: usize) {
        out.extend_from_slice(&(value as u32).to_le_bytes());
    }

    /// A number.
    pub fn write_number(out: &mut Vec<u8>, value: f64) {
        out.push(TAG_NUMBER);
        out.extend_from_slice(&value.to_le_bytes());
    }

    /// A boolean.
    pub fn write_bool(out: &mut Vec<u8>, value: bool) {
        out.push(if value { TAG_TRUE } else { TAG_FALSE });
    }

    /// A string.
    pub fn write_string(out: &mut Vec<u8>, value: &str) {
        out.push(TAG_STRING);
        write_key(out, value);
    }

    /// An object key: a string without the tag byte.
    pub fn write_key(out: &mut Vec<u8>, key: &str) {
        write_u32(out, key.len());
        out.extend_from_slice(key.as_bytes());
    }

    /// The start of an array of `count` items.
    pub fn write_array_header(out: &mut Vec<u8>, count: usize) {
        out.push(TAG_ARRAY);
        write_u32(out, count);
    }

    /// The start of an object of `count` entries, each a [`write_key`] and a value.
    pub fn write_object_header(out: &mut Vec<u8>, count: usize) {
        out.push(TAG_OBJECT);
        write_u32(out, count);
    }
}

impl From<bool> for Value {
    fn from(value: bool) -> Self {
        Value::Bool(value)
    }
}

impl From<f64> for Value {
    fn from(value: f64) -> Self {
        Value::Number(value)
    }
}

impl From<f32> for Value {
    fn from(value: f32) -> Self {
        Value::Number(f64::from(value))
    }
}

impl From<i32> for Value {
    fn from(value: i32) -> Self {
        Value::Number(f64::from(value))
    }
}

impl From<u32> for Value {
    fn from(value: u32) -> Self {
        Value::Number(f64::from(value))
    }
}

impl From<usize> for Value {
    fn from(value: usize) -> Self {
        Value::Number(value as f64)
    }
}

impl From<&str> for Value {
    fn from(value: &str) -> Self {
        Value::String(String::from(value))
    }
}

impl From<String> for Value {
    fn from(value: String) -> Self {
        Value::String(value)
    }
}

impl From<&String> for Value {
    fn from(value: &String) -> Self {
        Value::String(value.clone())
    }
}

impl From<Vec<Value>> for Value {
    fn from(value: Vec<Value>) -> Self {
        Value::Array(value)
    }
}

impl From<Vec<String>> for Value {
    fn from(values: Vec<String>) -> Self {
        Value::Array(values.into_iter().map(Value::String).collect())
    }
}

impl From<Map> for Value {
    fn from(value: Map) -> Self {
        Value::Object(value)
    }
}

impl<T: Into<Value>> From<Option<T>> for Value {
    fn from(value: Option<T>) -> Self {
        value.map_or(Value::Null, Into::into)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use alloc::vec;

    fn sample() -> Value {
        let mut inner = Map::new();
        inner.insert("id", "pro-annual");
        inner.insert("price", Value::Null);
        object([
            ("null", Value::Null),
            ("yes", true.into()),
            ("no", false.into()),
            ("number", (-12.5).into()),
            ("text", "héllo".into()),
            ("list", vec![Value::from(1), Value::from("two")].into()),
            ("nested", inner.into()),
        ])
    }

    #[test]
    fn round_trips() {
        let value = sample();
        assert_eq!(Value::decode(&value.to_bytes()), Ok(value));
    }

    #[test]
    fn encodes_the_documented_layout() {
        let bytes = object([("a", Value::from(true))]).to_bytes();
        assert_eq!(bytes, [6, 1, 0, 0, 0, 1, 0, 0, 0, b'a', 2]);
        let bytes = Value::from(1.0).to_bytes();
        assert_eq!(bytes[0], 3);
        assert_eq!(&bytes[1..], &1.0f64.to_le_bytes());
        assert_eq!(Value::from("é").to_bytes(), [4, 2, 0, 0, 0, 0xc3, 0xa9]);
    }

    #[test]
    fn rejects_invalid_input() {
        assert_eq!(Value::decode(&[]), Err(DecodeError::Truncated));
        assert_eq!(Value::decode(&[9]), Err(DecodeError::UnknownTag(9)));
        assert_eq!(Value::decode(&[0, 0]), Err(DecodeError::TrailingBytes));
        assert_eq!(
            Value::decode(&[4, 1, 0, 0, 0, 0xff]),
            Err(DecodeError::InvalidUtf8)
        );
        assert_eq!(
            Value::decode(&[6, 2, 0, 0, 0, 1, 0, 0, 0, b'a', 0, 1, 0, 0, 0, b'a', 0]),
            Err(DecodeError::DuplicateKey)
        );
        assert_eq!(
            Value::decode(&[5, 255, 255, 255, 255]),
            Err(DecodeError::Truncated)
        );
    }

    #[test]
    fn limits_nesting() {
        let mut deep = Value::Null;
        for _ in 0..MAX_DEPTH - 1 {
            deep = Value::Array(vec![deep]);
        }
        assert!(Value::decode(&deep.to_bytes()).is_ok());
        let too_deep = Value::Array(vec![deep]);
        assert_eq!(
            Value::decode(&too_deep.to_bytes()),
            Err(DecodeError::TooDeep)
        );
    }

    #[test]
    fn streaming_writes_match_the_value_encoding() {
        let mut out = Vec::new();
        write::write_object_header(&mut out, 3);
        write::write_key(&mut out, "on");
        write::write_bool(&mut out, true);
        write::write_key(&mut out, "size");
        write::write_number(&mut out, 2.5);
        write::write_key(&mut out, "tags");
        write::write_array_header(&mut out, 1);
        write::write_string(&mut out, "a");
        let value = object([
            ("on", true.into()),
            ("size", 2.5.into()),
            ("tags", vec![Value::from("a")].into()),
        ]);
        assert_eq!(out, value.to_bytes());
    }

    #[test]
    fn map_insert_replaces() {
        let mut map = Map::new();
        map.insert("a", 1);
        map.insert("a", 2);
        assert_eq!(map.len(), 1);
        assert_eq!(map.get("a"), Some(&Value::from(2)));
    }
}
