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

pub use client::{ClientBuilder, VoidhashClient};
pub use error::Error;

/// A single analytics capture for [`VoidhashClient::event_capture`].
#[derive(Debug, serde::Serialize)]
pub struct Event {
    pub event: String,
    #[serde(rename = "distinctId")]
    pub distinct_id: String,
    #[serde(rename = "properties", skip_serializing_if = "Option::is_none")]
    pub properties: Option<serde_json::Map<String, serde_json::Value>>,
}
