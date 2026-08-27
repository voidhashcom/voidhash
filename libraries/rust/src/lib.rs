//! Idiomatic Rust SDK for the Voidhash API.
//!
//! The typed request/response surface in [`generated`] is code-generated from
//! the committed OpenAPI document; the hand-written layer on top mirrors the
//! API's resource structure:
//!
//! ```no_run
//! # async fn example() -> Result<(), voidhash::Error> {
//! let client = voidhash::VoidhashClient::new("vh_sk_...")?;
//! let person = client.persons().get_by_distinct_id("user-123").await?;
//! # Ok(())
//! # }
//! ```

pub mod client;
pub mod error;
pub mod webhooks;

/// Code-generated management API surface.
pub mod generated {
    #![allow(clippy::all)]
    #![allow(rustdoc::all)]
    include!(concat!(env!("OUT_DIR"), "/core.rs"));
}

/// Code-generated event ingestion surface.
pub mod eventcapture {
    #![allow(clippy::all)]
    #![allow(rustdoc::all)]
    include!(concat!(env!("OUT_DIR"), "/eventcapture.rs"));
}

pub use client::{
    CaptureResult, ClientBuilder, VoidhashClient, DEFAULT_BASE_URL, DEFAULT_INGEST_URL,
};
pub use error::Error;

/// Profile fields and traits for `client.persons().set_attributes`.
///
/// Traits describe the person and persist across events, so a fact like a
/// subscription plan belongs here rather than repeated on every event's
/// properties.
#[derive(Clone, Debug, Default, serde::Serialize)]
pub struct PersonAttributes {
    /// Identifies the person. The distinct id is resolved to an existing
    /// person; an unknown one is an error, so use `create` for new persons.
    #[serde(rename = "distinctId")]
    pub distinct_id: String,
    /// Sets the person's email address.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    /// Sets the person's display name.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    /// `$set` attributes — the newest write wins per key.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub traits: Option<serde_json::Map<String, serde_json::Value>>,
    /// `$set_once` attributes — the earliest write wins, and any `traits`
    /// write beats them.
    #[serde(rename = "setOnce", skip_serializing_if = "Option::is_none")]
    pub set_once: Option<serde_json::Map<String, serde_json::Value>>,
}

impl PersonAttributes {
    /// Builds an attribute write for `distinct_id` with the given traits.
    pub fn new(
        distinct_id: impl Into<String>,
        traits: serde_json::Map<String, serde_json::Value>,
    ) -> Self {
        Self {
            distinct_id: distinct_id.into(),
            traits: Some(traits),
            ..Self::default()
        }
    }
}

/// A single analytics capture for [`VoidhashClient::event_capture`].
///
/// Build one with [`Event::new`] and refine it with the chained setters:
///
/// ```
/// let event = voidhash::Event::new("paywall_viewed", "user-123", chrono::Utc::now())
///     .property("paywall_id", "pw_1")
///     .session_id("sess_9");
/// ```
#[derive(Debug, Clone, serde::Serialize)]
pub struct Event {
    /// Deduplication key. Left unset, a UUIDv4 is generated at send time; set
    /// it explicitly to make retries of the same event idempotent.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uuid: Option<String>,
    /// Event name, for example `paywall_viewed`.
    pub event: String,
    /// Identity the event belongs to.
    pub distinct_id: String,
    /// The event's own attributes. Always sent, empty as `{}`.
    pub properties: serde_json::Map<String, serde_json::Value>,
    /// Ambient attributes (app version, platform, locale). Always sent, empty
    /// as `{}`.
    pub context: serde_json::Map<String, serde_json::Value>,
    /// Groups events into a session. Omitted when unset.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    /// When the event occurred.
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

impl Event {
    /// Creates an event with empty properties and context.
    pub fn new(
        event: impl Into<String>,
        distinct_id: impl Into<String>,
        timestamp: chrono::DateTime<chrono::Utc>,
    ) -> Self {
        Self {
            uuid: None,
            event: event.into(),
            distinct_id: distinct_id.into(),
            properties: serde_json::Map::new(),
            context: serde_json::Map::new(),
            session_id: None,
            timestamp,
        }
    }

    /// Sets the deduplication key.
    pub fn uuid(mut self, uuid: impl Into<String>) -> Self {
        self.uuid = Some(uuid.into());
        self
    }

    /// Replaces the event properties.
    pub fn properties(mut self, properties: serde_json::Map<String, serde_json::Value>) -> Self {
        self.properties = properties;
        self
    }

    /// Adds one event property.
    pub fn property(mut self, key: impl Into<String>, value: impl Into<serde_json::Value>) -> Self {
        self.properties.insert(key.into(), value.into());
        self
    }

    /// Replaces the client context.
    pub fn context(mut self, context: serde_json::Map<String, serde_json::Value>) -> Self {
        self.context = context;
        self
    }

    /// Adds one context attribute.
    pub fn context_property(
        mut self,
        key: impl Into<String>,
        value: impl Into<serde_json::Value>,
    ) -> Self {
        self.context.insert(key.into(), value.into());
        self
    }

    /// Sets the session grouping key.
    pub fn session_id(mut self, session_id: impl Into<String>) -> Self {
        self.session_id = Some(session_id.into());
        self
    }

    /// Sets when the event occurred.
    pub fn timestamp(mut self, timestamp: chrono::DateTime<chrono::Utc>) -> Self {
        self.timestamp = timestamp;
        self
    }
}
