//! Unified error type for the Voidhash SDK.

use crate::generated::types::ApiError as GeneratedApiError;
use progenitor_client::Error as GeneratedError;

/// Errors returned by every SDK call. [`Error::Api`] carries the API's error
/// envelope: branch on its `type_` and `code`, which are stable, never on the
/// message.
#[derive(Debug, thiserror::Error)]
pub enum Error {
    /// A non-2xx API response.
    #[error("voidhash api error {status}{}", describe(.code, .message))]
    Api {
        /// HTTP status code.
        status: u16,
        /// The error's category (`invalid_request`, `unauthenticated`,
        /// `permission_denied`, `not_found`, `conflict`, `rate_limited`,
        /// `unavailable` or `internal`). Empty when the response carried no
        /// error envelope, as event capture's errors do not.
        type_: String,
        /// The specific, documented reason, for example `person_not_found`.
        /// Empty when the response carried none.
        code: String,
        /// A description written for the person reading it.
        message: String,
        /// The request field the error concerns, when there is one.
        param: Option<String>,
        /// The `Request-Id` the response carried; quote it to support.
        request_id: Option<String>,
    },

    /// Transport-level failure.
    #[error("transport error: {0}")]
    Transport(#[from] reqwest::Error),

    /// Anything else (client configuration, malformed request construction,
    /// body decoding).
    #[error("request failed: {0}")]
    Request(String),
}

impl Error {
    /// Reports whether the API reported "not found" (404).
    pub fn is_not_found(&self) -> bool {
        matches!(self, Error::Api { status: 404, .. })
    }

    /// The HTTP status code, when the error came from a response.
    pub fn status(&self) -> Option<u16> {
        match self {
            Error::Api { status, .. } => Some(*status),
            Error::Transport(error) => error.status().map(|code| code.as_u16()),
            _ => None,
        }
    }

    /// Reads an event capture failure, whose body is `{ _tag, code, error }`
    /// rather than the management API's envelope.
    pub(crate) fn from_capture_response(
        status: u16,
        request_id: Option<String>,
        body: &str,
    ) -> Self {
        let body = serde_json::from_str::<serde_json::Value>(body).unwrap_or_default();
        let text = |field: &str| body[field].as_str().unwrap_or_default().to_string();
        Error::Api {
            status,
            type_: String::new(),
            code: text("code"),
            message: text("error"),
            param: None,
            request_id,
        }
    }

    /// An error response without an envelope the SDK can read.
    fn bare(status: u16, request_id: Option<String>) -> Self {
        Error::Api {
            status,
            type_: String::new(),
            code: String::new(),
            message: String::new(),
            param: None,
            request_id,
        }
    }
}

/// `{ "error": { "type", "code", "message", "param"? } }`, the body of every
/// management API error.
#[derive(serde::Deserialize)]
struct Envelope {
    error: EnvelopeError,
}

#[derive(serde::Deserialize)]
struct EnvelopeError {
    #[serde(rename = "type")]
    type_: String,
    code: String,
    message: String,
    #[serde(default)]
    param: Option<String>,
}

impl EnvelopeError {
    fn into_error(self, status: u16, request_id: Option<String>) -> Error {
        Error::Api {
            status,
            type_: self.type_,
            code: self.code,
            message: self.message,
            param: self.param,
            request_id,
        }
    }
}

/// The status each envelope `type` is sent with (`docs/api-design.md`).
fn status_of(type_: &str) -> Option<u16> {
    Some(match type_ {
        "invalid_request" => 400,
        "unauthenticated" => 401,
        "permission_denied" => 403,
        "not_found" => 404,
        "conflict" => 409,
        "rate_limited" => 429,
        "internal" => 500,
        "unavailable" => 503,
        _ => return None,
    })
}

fn request_id(headers: &reqwest::header::HeaderMap) -> Option<String> {
    headers
        .get("request-id")
        .and_then(|value| value.to_str().ok())
        .map(str::to_string)
}

fn describe(code: &str, message: &str) -> String {
    match (code.is_empty(), message.is_empty()) {
        (false, false) => format!(" ({code}): {message}"),
        (false, true) => format!(" ({code})"),
        (true, false) => format!(": {message}"),
        (true, true) => String::new(),
    }
}

impl From<GeneratedError<GeneratedApiError>> for Error {
    fn from(value: GeneratedError<GeneratedApiError>) -> Self {
        match value {
            GeneratedError::ErrorResponse(response) => {
                let status = response.status().as_u16();
                let request_id = request_id(response.headers());
                // Read through JSON so the envelope does not depend on how
                // the generator models the shared error schema.
                serde_json::to_value(response.into_inner())
                    .and_then(serde_json::from_value::<Envelope>)
                    .map(|envelope| envelope.error.into_error(status, request_id.clone()))
                    .unwrap_or_else(|_| Error::bare(status, request_id))
            }
            // The generated client keeps only the body of a documented error
            // status whose body does not match its error schema, so the
            // status comes from the envelope's type.
            GeneratedError::InvalidResponsePayload(body, decode_error) => {
                match serde_json::from_slice::<Envelope>(&body) {
                    Ok(envelope) => match status_of(&envelope.error.type_) {
                        Some(status) => envelope.error.into_error(status, None),
                        None => Error::Request(format!("decoding response: {decode_error}")),
                    },
                    Err(_) => Error::Request(format!("decoding response: {decode_error}")),
                }
            }
            GeneratedError::CommunicationError(error) => Error::Transport(error),
            GeneratedError::UnexpectedResponse(response) => {
                Error::bare(response.status().as_u16(), request_id(response.headers()))
            }
            other => Error::Request(other.to_string()),
        }
    }
}
