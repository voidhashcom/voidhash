//! One error type for every handler, mapped to the JSON envelope the spec
//! defines: `{"error": "<code>", "message": "<human readable>"}`.

use axum::extract::rejection::JsonRejection;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Serialize;

use crate::analytics::AnalyticsError;

/// A failed request. Handlers return `Result<T, ApiError>` and use `?`.
#[derive(Debug)]
pub struct ApiError {
    status: StatusCode,
    code: &'static str,
    message: String,
}

#[derive(Serialize)]
struct ErrorBody<'a> {
    error: &'a str,
    message: &'a str,
}

impl ApiError {
    /// Builds an error with an explicit status and machine-readable code.
    pub fn new(status: StatusCode, code: &'static str, message: impl Into<String>) -> Self {
        Self {
            status,
            code,
            message: message.into(),
        }
    }

    /// `400` — the request did not carry a usable `distinctId`.
    pub fn missing_distinct_id() -> Self {
        Self::new(
            StatusCode::BAD_REQUEST,
            "missing_distinct_id",
            "query parameter \"distinctId\" is required",
        )
    }

    /// `400` — the JSON body was absent, malformed, or missing fields.
    pub fn invalid_body(message: impl Into<String>) -> Self {
        Self::new(StatusCode::BAD_REQUEST, "invalid_body", message)
    }

    /// `403` — a free account already holds the maximum number of notes.
    pub fn note_limit_reached(limit: usize) -> Self {
        Self::new(
            StatusCode::FORBIDDEN,
            "note_limit_reached",
            format!("free accounts are limited to {limit} notes; upgrade to Nimbus Pro"),
        )
    }

    /// `402` — the caller does not hold the `pro` perk.
    pub fn premium_required() -> Self {
        Self::new(
            StatusCode::PAYMENT_REQUIRED,
            "premium_required",
            "export requires an active \"pro\" entitlement",
        )
    }

    /// `503` — entitlements could not be resolved and nothing was cached.
    ///
    /// Reached only when Voidhash is unreachable *and* this process has never
    /// seen the caller before. With a cached answer the request is served
    /// stale instead; see [`crate::entitlements`].
    pub fn entitlements_unavailable() -> Self {
        Self::new(
            StatusCode::SERVICE_UNAVAILABLE,
            "entitlements_unavailable",
            "entitlements are temporarily unavailable and no cached answer exists",
        )
    }

    /// `400` — webhook signing headers were missing.
    pub fn missing_signature_headers() -> Self {
        Self::new(
            StatusCode::BAD_REQUEST,
            "missing_signature_headers",
            "x-webhook-event, x-webhook-signature and x-webhook-timestamp are required",
        )
    }

    /// `400` — the webhook signature or timestamp did not check out.
    pub fn invalid_signature(message: impl Into<String>) -> Self {
        Self::new(StatusCode::BAD_REQUEST, "invalid_signature", message)
    }

    /// `500` — `VOIDHASH_WEBHOOK_SECRET` was not configured.
    pub fn webhook_not_configured() -> Self {
        Self::new(
            StatusCode::INTERNAL_SERVER_ERROR,
            "webhook_not_configured",
            "VOIDHASH_WEBHOOK_SECRET is not set, so deliveries cannot be verified",
        )
    }
}

/// Translates an SDK failure into a response.
///
/// The branch is taken on the structured [`voidhash::Error`] variants — never
/// on the text of the message. `401`/`403` mean *our* secret key is wrong, so
/// they surface as a `500`: the caller did nothing wrong.
impl From<voidhash::Error> for ApiError {
    fn from(error: voidhash::Error) -> Self {
        match &error {
            voidhash::Error::Api { status: 401, tag }
            | voidhash::Error::Api { status: 403, tag } => Self::new(
                StatusCode::INTERNAL_SERVER_ERROR,
                "voidhash_auth_failed",
                format!("VOIDHASH_SECRET_KEY was rejected by Voidhash ({tag})"),
            ),
            voidhash::Error::Api { status: 404, .. } => Self::new(
                StatusCode::NOT_FOUND,
                "not_found",
                "Voidhash has no record of that resource",
            ),
            voidhash::Error::Api { status: 429, .. } => Self::new(
                StatusCode::TOO_MANY_REQUESTS,
                "rate_limited",
                "Voidhash rate limit reached; retry shortly",
            ),
            voidhash::Error::Api { status, tag } if *status >= 500 => Self::new(
                StatusCode::BAD_GATEWAY,
                "voidhash_unavailable",
                format!("Voidhash returned {status} ({tag})"),
            ),
            voidhash::Error::Api { status, tag } => Self::new(
                StatusCode::BAD_GATEWAY,
                "voidhash_error",
                format!("Voidhash returned {status} ({tag})"),
            ),
            voidhash::Error::Transport(_) => Self::new(
                StatusCode::BAD_GATEWAY,
                "voidhash_unreachable",
                format!("could not reach Voidhash: {error}"),
            ),
            voidhash::Error::Request(message) => Self::new(
                StatusCode::INTERNAL_SERVER_ERROR,
                "voidhash_request_invalid",
                format!("the SDK refused the request: {message}"),
            ),
        }
    }
}

/// Translates an ingestion failure into a response. Only reached from
/// `POST /v1/events`, where forwarding the event is the point of the request.
impl From<AnalyticsError> for ApiError {
    fn from(error: AnalyticsError) -> Self {
        match &error {
            AnalyticsError::Sdk(voidhash::Error::Transport(_)) => Self::new(
                StatusCode::BAD_GATEWAY,
                "analytics_unreachable",
                error.to_string(),
            ),
            AnalyticsError::Sdk(voidhash::Error::Api { status, .. }) if *status >= 500 => {
                Self::new(
                    StatusCode::BAD_GATEWAY,
                    "analytics_unavailable",
                    error.to_string(),
                )
            }
            AnalyticsError::Sdk(voidhash::Error::Request(_)) => Self::new(
                StatusCode::INTERNAL_SERVER_ERROR,
                "analytics_request_invalid",
                error.to_string(),
            ),
            AnalyticsError::Sdk(voidhash::Error::Api { .. }) | AnalyticsError::NotAccepted => {
                Self::new(
                    StatusCode::BAD_GATEWAY,
                    "analytics_rejected",
                    error.to_string(),
                )
            }
        }
    }
}

impl From<JsonRejection> for ApiError {
    fn from(rejection: JsonRejection) -> Self {
        Self::invalid_body(rejection.body_text())
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        if self.status.is_server_error() {
            tracing::error!(code = self.code, message = %self.message, "request failed");
        }
        let body = Json(ErrorBody {
            error: self.code,
            message: &self.message,
        });
        (self.status, body).into_response()
    }
}
