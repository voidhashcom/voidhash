//! Server-side analytics, over the SDK.
//!
//! Both calls in here authenticate with the project's **secret** key — capture
//! sends it as `x-secret-key`, exactly like every other SDK call, so no
//! publishable key is involved:
//!
//! - [`Analytics::capture`] posts to event ingest, which lives on its own
//!   origin (`VOIDHASH_INGEST_URL`).
//! - [`Analytics::set_attributes`] is a server-to-server write. Traits
//!   describe the person and persist, so facts like the current plan go here
//!   rather than being repeated on every event.

use std::sync::Arc;

use serde_json::{Map, Value};
use voidhash::VoidhashClient;

/// Why a capture failed.
#[derive(Debug)]
pub enum AnalyticsError {
    /// The SDK could not deliver the event.
    Sdk(voidhash::Error),
    /// Ingestion accepted the request but discarded every event in it.
    NotAccepted,
}

impl std::fmt::Display for AnalyticsError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Sdk(error) => write!(f, "event ingestion failed: {error}"),
            Self::NotAccepted => write!(f, "event ingestion discarded the event"),
        }
    }
}

impl std::error::Error for AnalyticsError {}

impl From<voidhash::Error> for AnalyticsError {
    fn from(value: voidhash::Error) -> Self {
        Self::Sdk(value)
    }
}

/// Analytics facade over the SDK client.
pub struct Analytics {
    client: Arc<VoidhashClient>,
}

impl Analytics {
    /// Wraps the SDK client.
    pub fn new(client: Arc<VoidhashClient>) -> Self {
        Self { client }
    }

    /// Sends one event.
    pub async fn capture(
        &self,
        distinct_id: &str,
        event: &str,
        properties: Map<String, Value>,
    ) -> Result<(), AnalyticsError> {
        let result = self
            .client
            .event_capture()
            .capture(&voidhash::Event::new(event, distinct_id).properties(properties))
            .await?;

        // A 2xx with `accepted: 0` means the event was dropped during
        // validation. Treating that as success would hide a broken payload.
        if result.accepted == 0 {
            return Err(AnalyticsError::NotAccepted);
        }

        Ok(())
    }

    /// Sends one event, logging rather than failing the caller.
    ///
    /// A dropped metric is not worth a 500 on a write path. A production
    /// service would hand this to a queue instead of awaiting it inline.
    pub async fn capture_best_effort(
        &self,
        distinct_id: &str,
        event: &str,
        properties: Map<String, Value>,
    ) {
        if let Err(error) = self.capture(distinct_id, event, properties).await {
            tracing::warn!(distinct_id, event, %error, "analytics capture failed");
        }
    }

    /// Writes person traits, logging rather than failing the caller.
    pub async fn set_attributes_best_effort(&self, distinct_id: &str, traits: Map<String, Value>) {
        if let Err(error) = self
            .client
            .persons()
            .set_attributes(&voidhash::PersonAttributes::new(distinct_id, traits))
            .await
        {
            tracing::warn!(distinct_id, %error, "writing person attributes failed");
        }
    }
}
