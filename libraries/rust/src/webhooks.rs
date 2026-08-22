//! Webhook signature verification.

use hmac::{Hmac, Mac};
use sha2::Sha256;

type HmacSha256 = Hmac<Sha256>;

const SIGNATURE_PREFIX: &str = "v1=";
const DEFAULT_TOLERANCE_SECONDS: i64 = 300;

/// Headers carried by every Voidhook webhook delivery.
pub const EVENT_HEADER: &str = "x-webhook-event";
pub const SIGNATURE_HEADER: &str = "x-webhook-signature";
pub const TIMESTAMP_HEADER: &str = "x-webhook-timestamp";

/// Why [`construct_event`] refused to accept a request.
#[derive(Debug, thiserror::Error)]
pub enum WebhookVerificationError {
    /// A signing header was missing or repeated.
    #[error("webhook request must carry exactly one \"{0}\" header")]
    MissingHeader(String),
    /// The signature or timestamp check failed.
    #[error("signature or timestamp check failed")]
    InvalidSignature,
    /// The body was not valid JSON.
    #[error("body is not valid JSON")]
    InvalidPayload(#[from] serde_json::Error),
}

/// A verified webhook delivery.
#[derive(Debug)]
pub struct WebhookEvent {
    /// Value of the `X-Webhook-Event` header. Unknown names pass through as
    /// plain strings, so an out-of-date SDK never drops a delivery.
    pub event_type: String,
    /// Parsed JSON body.
    pub payload: serde_json::Value,
    /// Signing time reported by `X-Webhook-Timestamp`.
    pub timestamp: i64,
}

/// Verifies an inbound webhook request and parses its body.
///
/// Voidhash signs `${timestamp}.${rawBody}` with HMAC-SHA256 keyed by the raw
/// UTF-8 endpoint secret and sends it as `v1=<lowercase hex>`. The raw body
/// must be the exact bytes that were signed — do not re-serialize before
/// calling this.
pub fn construct_event(
    payload: &[u8],
    event_header: &str,
    signature: &str,
    timestamp: &str,
    secret: &str,
) -> Result<WebhookEvent, WebhookVerificationError> {
    if !verify_signature(payload, signature, timestamp, secret, DEFAULT_TOLERANCE_SECONDS) {
        return Err(WebhookVerificationError::InvalidSignature);
    }

    let parsed: serde_json::Value = serde_json::from_slice(payload)?;
    Ok(WebhookEvent {
        event_type: event_header.to_string(),
        payload: parsed,
        timestamp: timestamp.parse().unwrap_or_default(),
    })
}

/// Checks a webhook signature and its timestamp freshness without parsing the
/// payload. Prefer [`construct_event`] unless you need the boolean directly.
pub fn verify_signature(
    payload: &[u8],
    signature: &str,
    timestamp: &str,
    secret: &str,
    tolerance_seconds: i64,
) -> bool {
    let Ok(timestamp_seconds) = timestamp.parse::<i64>() else {
        return false;
    };
    if timestamp_seconds.to_string() != timestamp {
        return false;
    }

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|value| value.as_secs() as i64)
        .unwrap_or_default();
    if (now - timestamp_seconds).abs() > tolerance_seconds {
        return false;
    }

    let Some(provided) = signature.strip_prefix(SIGNATURE_PREFIX) else {
        return false;
    };

    let Ok(mut mac) = HmacSha256::new_from_slice(secret.as_bytes()) else {
        return false;
    };
    mac.update(timestamp.as_bytes());
    mac.update(b".");
    mac.update(payload);
    let expected = hex::encode(mac.finalize().into_bytes());

    constant_time_eq(expected.as_bytes(), provided.as_bytes())
}

fn constant_time_eq(left: &[u8], right: &[u8]) -> bool {
    if left.len() != right.len() {
        return false;
    }
    left.iter()
        .zip(right.iter())
        .fold(0u8, |accumulator, (a, b)| accumulator | (a ^ b))
        == 0
}
