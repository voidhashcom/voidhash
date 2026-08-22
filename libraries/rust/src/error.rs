//! Unified error type for the Voidhash SDK.

use crate::generated::types::ApiError as GeneratedApiError;
use progenitor_client::Error as GeneratedError;

/// Errors returned by every SDK call. [`Error::Api`] carries the HTTP status
/// and the wire `_tag` discriminant (for example `Api/PersonNotFoundError`),
/// which is the stable way to branch on specific failures.
#[derive(Debug, thiserror::Error)]
pub enum Error {
    /// A non-2xx API response.
    #[error("voidhash api error {status}{separator}{tag}", separator = if tag.is_empty() { "" } else { ": " })]
    Api {
        /// HTTP status code.
        status: u16,
        /// Server-side error discriminant, empty when absent.
        tag: String,
    },

    /// Transport-level failure.
    #[error("transport error: {0}")]
    Transport(#[from] reqwest::Error),

    /// Anything else (malformed request construction, body decoding).
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
}

impl From<GeneratedError<GeneratedApiError>> for Error {
    fn from(value: GeneratedError<GeneratedApiError>) -> Self {
        match value {
            GeneratedError::ErrorResponse(response) => Error::Api {
                status: response.status().as_u16(),
                tag: response.into_inner().tag,
            },
            GeneratedError::CommunicationError(error) => Error::Transport(error),
            GeneratedError::UnexpectedResponse(response) => Error::Api {
                status: response.status().as_u16(),
                tag: String::new(),
            },
            other => Error::Request(other.to_string()),
        }
    }
}
