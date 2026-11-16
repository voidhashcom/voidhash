//! `POST /webhooks/voidhash` — verified, idempotent delivery intake.

use axum::body::Bytes;
use axum::extract::State;
use axum::http::HeaderMap;
use axum::Json;
use serde::Serialize;

use crate::error::ApiError;
use crate::state::SharedState;
use crate::webhooks::{apply, delivery_key};

#[derive(Serialize)]
pub struct WebhookAck {
    received: bool,
    /// `true` when this delivery had already been handled.
    duplicate: bool,
}

/// `POST /webhooks/voidhash`
///
/// The body is taken as [`Bytes`], not `Json<T>`. The signature covers the
/// exact bytes Voidhash sent, and `Json<T>` would deserialize them into a
/// value that has to be re-serialized to check — at which point key order,
/// number formatting and whitespace have all changed and every delivery fails
/// verification. This is the single most common way to get webhooks wrong.
pub async fn receive(
    State(state): State<SharedState>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<WebhookAck>, ApiError> {
    let event = state.webhooks.verify(&headers, &body)?;
    let key = delivery_key(&event);

    // Claim before handling, not after: two concurrent redeliveries of the
    // same event must not both get through.
    if !state.webhooks.claim(&key) {
        tracing::info!(key, "duplicate webhook delivery, already handled");
        return Ok(Json(WebhookAck {
            received: true,
            duplicate: true,
        }));
    }

    // Acknowledge first, handle after. Voidhash retries a delivery it
    // considers slow, so the response must not wait on the handler.
    let handler_state = state.clone();
    tokio::spawn(async move { apply(&event, &handler_state.entitlements) });

    Ok(Json(WebhookAck {
        received: true,
        duplicate: false,
    }))
}
