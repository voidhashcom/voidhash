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
    /// Identifies the person. A distinct id Voidhash has not seen creates a
    /// person, the same way `create` does.
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
#[derive(Clone, Debug, Default)]
pub struct Event {
    /// Event name, for example `note_created`.
    pub event: String,
    /// The person the event belongs to.
    pub distinct_id: String,
    /// The event's own attributes. Facts about the person belong in person
    /// attributes (`client.persons().set_attributes`) instead.
    pub properties: serde_json::Map<String, serde_json::Value>,
    /// The sending environment. Optional.
    pub context: serde_json::Map<String, serde_json::Value>,
    /// When the event occurred. Defaults to when it is sent.
    pub timestamp: Option<chrono::DateTime<chrono::Utc>>,
}

impl Event {
    /// Builds an event with empty context and properties.
    pub fn new(distinct_id: impl Into<String>, event: impl Into<String>) -> Self {
        Self {
            event: event.into(),
            distinct_id: distinct_id.into(),
            ..Self::default()
        }
    }

    /// Replaces the event's properties.
    pub fn with_properties(
        mut self,
        properties: serde_json::Map<String, serde_json::Value>,
    ) -> Self {
        self.properties = properties;
        self
    }
}
