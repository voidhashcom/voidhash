//! `POST /v1/events` — forward a client-supplied analytics event.
//!
//! Nimbus's mobile apps capture `paywall_viewed` and `checkout_started`
//! directly through the client SDK. This route exists for the surfaces that
//! cannot — a web client, a background job, another service — and it is where
//! you would attach server-side truth (plan, tenant, request id) that a client
//! must not be trusted to supply.

use axum::extract::rejection::JsonRejection;
use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

use crate::error::ApiError;
use crate::state::SharedState;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureBody {
    distinct_id: String,
    event: String,
    #[serde(default)]
    properties: Map<String, Value>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureResponse {
    /// Always `sent`; an event ingestion did not accept fails the request
    /// instead.
    status: &'static str,
    event: String,
    distinct_id: String,
}

/// `POST /v1/events`
pub async fn capture(
    State(state): State<SharedState>,
    body: Result<Json<CaptureBody>, JsonRejection>,
) -> Result<(StatusCode, Json<CaptureResponse>), ApiError> {
    let Json(body) = body?;

    let distinct_id = body.distinct_id.trim();
    if distinct_id.is_empty() {
        return Err(ApiError::invalid_body("\"distinctId\" is required"));
    }
    let event = body.event.trim();
    if event.is_empty() {
        return Err(ApiError::invalid_body("\"event\" is required"));
    }

    // Forwarding is this route's only job, so a rejected capture is a failed
    // request — unlike the best-effort capture on the note path.
    state
        .analytics
        .capture(distinct_id, event, body.properties)
        .await?;

    Ok((
        StatusCode::ACCEPTED,
        Json(CaptureResponse {
            status: "sent",
            event: event.to_string(),
            distinct_id: distinct_id.to_string(),
        }),
    ))
}
