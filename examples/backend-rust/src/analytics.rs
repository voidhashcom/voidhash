//! Server-side analytics, over the SDK.
//!
//! Two different credentials are in play, which is the thing worth noticing:
//!
//! - [`Analytics::capture`] posts to event ingest, which authenticates on the
//!   **publishable** key (`ClientBuilder::publishable_key`). It is disabled
//!   when that is unset.
//! - [`Analytics::set_attributes`] is a server-to-server write on the
//!   **secret** key. Traits describe the person and persist, so facts like the
//!   current plan go here rather than being repeated on every event.

use std::sync::Arc;

use serde::Serialize;
use serde_json::{Map, Value};
use voidhash::VoidhashClient;

/// What happened to a capture.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Captured {
    /// Ingestion accepted the event.
    Sent,
    /// No publishable key is configured, so nothing was sent.
    Skipped,
}

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
    enabled: bool,
}

impl Analytics {
    /// Wraps the SDK client. With no publishable key configured every capture
    /// is a no-op; attribute writes still work, because they use the secret
    /// key.
    pub fn new(client: Arc<VoidhashClient>, publishable_key: Option<&str>) -> Self {
        Self {
            client,
            enabled: publishable_key.is_some_and(|key| !key.trim().is_empty()),
        }
    }

    /// Whether a publishable key is configured.
    pub fn enabled(&self) -> bool {
        self.enabled
    }

    /// Sends one event.
    pub async fn capture(
        &self,
        distinct_id: &str,
        event: &str,
        properties: Map<String, Value>,
    ) -> Result<Captured, AnalyticsError> {
        if !self.enabled {
            return Ok(Captured::Skipped);
        }

        let result = self
            .client
            .event_capture()
            .capture(&voidhash::Event::new(distinct_id, event).with_properties(properties))
            .await?;

        // A 2xx with `accepted: 0` means the event was dropped during
        // validation. Treating that as success would hide a broken payload.
        if result.accepted == 0 {
            return Err(AnalyticsError::NotAccepted);
        }

        Ok(Captured::Sent)
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
