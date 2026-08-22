//! Inbound webhook verification, de-duplication and handling.
//!
//! Voidhash retries a delivery that is slow or that answers non-2xx, so the
//! same event arrives more than once as a matter of routine. Handling has to
//! be idempotent; [`WebhookProcessor::claim`] gives that a name.

use std::collections::{HashSet, VecDeque};
use std::sync::{PoisonError, RwLock};

use axum::http::HeaderMap;
use serde_json::Value;
use voidhash::webhooks::{self, WebhookEvent, EVENT_HEADER, SIGNATURE_HEADER, TIMESTAMP_HEADER};

use crate::entitlements::EntitlementCache;
use crate::error::ApiError;

/// How many delivery keys to remember. A real service would use a table with
/// a unique index and a TTL; a bounded ring is enough to show the shape.
const DEDUPE_CAPACITY: usize = 1_024;

/// Verifies deliveries and remembers the ones already handled.
pub struct WebhookProcessor {
    secret: Option<String>,
    seen: RwLock<DedupeSet>,
}

impl WebhookProcessor {
    /// Builds a processor. `secret` is `VOIDHASH_WEBHOOK_SECRET`; when it is
    /// `None` the route rejects every delivery rather than trusting it.
    pub fn new(secret: Option<String>) -> Self {
        Self {
            secret,
            seen: RwLock::new(DedupeSet::new(DEDUPE_CAPACITY)),
        }
    }

    /// Checks the signature over `body` and parses the payload.
    ///
    /// `body` must be the exact bytes that arrived on the wire.
    pub fn verify(&self, headers: &HeaderMap, body: &[u8]) -> Result<WebhookEvent, ApiError> {
        let secret = self
            .secret
            .as_deref()
            .ok_or_else(ApiError::webhook_not_configured)?;

        let header = |name: &str| headers.get(name).and_then(|value| value.to_str().ok());
        let (Some(event), Some(signature), Some(timestamp)) = (
            header(EVENT_HEADER),
            header(SIGNATURE_HEADER),
            header(TIMESTAMP_HEADER),
        ) else {
            return Err(ApiError::missing_signature_headers());
        };

        webhooks::construct_event(body, event, signature, timestamp, secret)
            .map_err(|error| ApiError::invalid_signature(error.to_string()))
    }

    /// Records `key` as handled. Returns `false` when it was already claimed,
    /// which is the signal to acknowledge the redelivery and do nothing else.
    pub fn claim(&self, key: &str) -> bool {
        self.seen
            .write()
            .unwrap_or_else(PoisonError::into_inner)
            .insert(key)
    }
}

/// Stable identity of one delivery.
///
/// The body carries no delivery id, and the signature is recomputed with a
/// fresh timestamp on every retry, so neither can be the key. The payload
/// itself is byte-identical across attempts, so the subject id plus
/// `occurredAt` identifies the transition — and falls back to the whole body
/// for an event shape this example does not know about yet.
pub fn delivery_key(event: &WebhookEvent) -> String {
    let string = |field: &str| event.payload.get(field).and_then(Value::as_str);
    let subject = string("subscriptionId")
        .or_else(|| string("purchaseId"))
        .or_else(|| string("providerTransactionId"));

    match (subject, string("occurredAt")) {
        (Some(subject), Some(occurred_at)) => {
            format!("{}:{subject}:{occurred_at}", event.event_type)
        }
        _ => format!("{}:{}", event.event_type, event.payload),
    }
}

/// Reacts to a verified, not-yet-handled delivery.
///
/// Nimbus keeps no entitlement state of its own — Voidhash is the source of
/// truth — so the only real work is dropping the cached answer for the person
/// the event is about. An app with its own `users.plan` column would write it
/// here.
pub fn apply(event: &WebhookEvent, entitlements: &EntitlementCache) {
    let distinct_id = event
        .payload
        .get("distinctId")
        .and_then(Value::as_str)
        .unwrap_or_default();

    if distinct_id.is_empty() {
        tracing::warn!(
            event_type = %event.event_type,
            "delivery carried no distinctId; nothing to invalidate"
        );
        return;
    }

    match event.event_type.as_str() {
        "subscription.created" | "subscription.renewed" | "purchase.completed" => {
            entitlements.invalidate(distinct_id);
            tracing::info!(distinct_id, event_type = %event.event_type, "access granted or extended");
        }
        "subscription.cancelled" | "subscription.expired" | "purchase.refunded" => {
            entitlements.invalidate(distinct_id);
            tracing::info!(distinct_id, event_type = %event.event_type, "access ended or shortened");
        }
        // An unknown name is a newer Voidhash, not a bug. Acknowledge it and
        // move on rather than failing the delivery into a retry loop.
        other => tracing::info!(distinct_id, event_type = other, "unhandled webhook event"),
    }
}

/// Bounded insertion-ordered set of delivery keys.
struct DedupeSet {
    capacity: usize,
    keys: HashSet<String>,
    order: VecDeque<String>,
}

impl DedupeSet {
    fn new(capacity: usize) -> Self {
        Self {
            capacity,
            keys: HashSet::new(),
            order: VecDeque::new(),
        }
    }

    fn insert(&mut self, key: &str) -> bool {
        if !self.keys.insert(key.to_string()) {
            return false;
        }
        self.order.push_back(key.to_string());
        if self.order.len() > self.capacity {
            if let Some(evicted) = self.order.pop_front() {
                self.keys.remove(&evicted);
            }
        }
        true
    }
}
