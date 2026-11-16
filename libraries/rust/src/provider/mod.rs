//! The endpoint Voidhash calls to read a payment source's catalog, history and
//! subscriptions, and to cancel subscriptions and refund charges there.
//!
//! Implement the operations your source supports, register them on a
//! [`ProviderHandler`], and serve it at the HTTPS URL configured for the
//! source. The handler verifies Voidhash's signature, decodes the request,
//! answers `describe` itself, and checks what your implementation returns
//! before replying.
//!
//! ```no_run
//! use voidhash::provider::{
//!     CatalogPage, CatalogProduct, CatalogRequest, CatalogSource, ProductKind, ProviderError,
//!     ProviderHandler, ProviderRequest,
//! };
//!
//! struct Paddle;
//!
//! impl CatalogSource for Paddle {
//!     async fn list_catalog(&self, _request: CatalogRequest) -> Result<CatalogPage, ProviderError> {
//!         Ok(CatalogPage::new(
//!             vec![CatalogProduct::new("pri_monthly", "Pro monthly", ProductKind::Subscription)],
//!             None,
//!         ))
//!     }
//! }
//!
//! # async fn example(headers: http::HeaderMap, body: Vec<u8>) {
//! let handler = ProviderHandler::new("paddle", "vhps_...").catalog(Paddle);
//! let response = handler.handle(ProviderRequest { headers, body }).await;
//! # }
//! ```

#[cfg(feature = "axum")]
mod axum;
mod types;
mod validate;

use std::collections::BTreeMap;
use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;

use serde_json::{json, Value};

use crate::webhooks;

pub use types::*;

/// The protocol version this SDK speaks.
pub const PROTOCOL_VERSION: u64 = 1;
/// Header carrying `v1=` and the request's HMAC-SHA256 signature.
pub const SIGNATURE_HEADER: &str = "x-voidhash-signature";
/// Header carrying the unix time the request was signed at.
pub const TIMESTAMP_HEADER: &str = "x-voidhash-timestamp";
/// How far, in seconds, a request's timestamp may be from the receiver's clock.
pub const SIGNATURE_TOLERANCE_SECONDS: i64 = 300;
/// The message a `provider_error` carries in production instead of the
/// implementation's own.
pub const HIDDEN_ERROR_MESSAGE: &str = "The provider failed to handle the request";

const DESCRIBE: &str = "describe";
const CATALOG_LIST: &str = "catalog.list";
const HISTORY_LIST: &str = "history.list";
const SUBSCRIPTION_GET: &str = "subscription.get";
const SUBSCRIPTION_CANCEL: &str = "subscription.cancel";
const TRANSACTION_REFUND: &str = "transaction.refund";

/// Lists the products a source sells (`catalog.list`), for the product import.
pub trait CatalogSource: Send + Sync + 'static {
    /// Returns one page of products, starting at `request.cursor`.
    fn list_catalog(
        &self,
        request: CatalogRequest,
    ) -> impl Future<Output = Result<CatalogPage, ProviderError>> + Send;
}

/// Lists a source's past subscriptions and transactions (`history.list`), for
/// the history import.
pub trait HistorySource: Send + Sync + 'static {
    /// Returns one page of the records `request.kind` names, created before
    /// `request.before`. Answer with the [`HistoryPage`] variant of that kind.
    fn list_history(
        &self,
        request: HistoryRequest,
    ) -> impl Future<Output = Result<HistoryPage, ProviderError>> + Send;
}

/// Looks up a subscription's current state (`subscription.get`). Voidhash asks
/// when a subscription's period ended without a renewal charge or final state.
pub trait SubscriptionSource: Send + Sync + 'static {
    /// Returns the subscription, or `None` when the source does not know it.
    fn get_subscription(
        &self,
        request: SubscriptionRequest,
    ) -> impl Future<Output = Result<Option<Subscription>, ProviderError>> + Send;
}

/// Cancels subscriptions at the source (`subscription.cancel`), when someone
/// cancels one in Voidhash.
pub trait CancellationSource: Send + Sync + 'static {
    /// Cancels the subscription and returns its state afterwards, which
    /// Voidhash records as if the source had reported it. Repeating a
    /// cancellation should answer with the same state, not fail.
    fn cancel_subscription(
        &self,
        request: CancelSubscriptionRequest,
    ) -> impl Future<Output = Result<Subscription, ProviderError>> + Send;
}

/// Refunds charges at the source (`transaction.refund`), when someone refunds
/// one in Voidhash.
pub trait RefundSource: Send + Sync + 'static {
    /// Refunds the charge and returns the refund, a [`Transaction::refund`],
    /// which Voidhash records as if the source had reported it.
    fn refund_transaction(
        &self,
        request: RefundTransactionRequest,
    ) -> impl Future<Output = Result<Transaction, ProviderError>> + Send;
}

/// How an implementation fails. The first three are answered as they are;
/// [`ProviderError::Other`] is answered as `provider_error`, with its message
/// shown only for test requests.
#[derive(Debug, thiserror::Error)]
pub enum ProviderError {
    /// The input cannot be answered (`invalid_request`, 400).
    #[error("{0}")]
    InvalidRequest(String),
    /// Nothing matches the input (`not_found`, 404).
    #[error("{0}")]
    NotFound(String),
    /// The source's upstream is down; Voidhash retries later (`unavailable`,
    /// 503).
    #[error("{0}")]
    Unavailable(String),
    /// Any other failure (`provider_error`, 500).
    #[error("{0}")]
    Other(#[from] Box<dyn std::error::Error + Send + Sync>),
}

impl ProviderError {
    /// Wraps any error as [`ProviderError::Other`].
    pub fn other(error: impl Into<Box<dyn std::error::Error + Send + Sync>>) -> Self {
        Self::Other(error.into())
    }
}

/// An HTTP request as it reached the endpoint. Pass the body exactly as
/// received: the signature covers its raw bytes.
#[derive(Clone, Debug, Default)]
pub struct ProviderRequest {
    /// The request headers.
    pub headers: http::HeaderMap,
    /// The raw request body.
    pub body: Vec<u8>,
}

/// The HTTP response to send back.
#[derive(Clone, Debug)]
pub struct ProviderResponse {
    /// The status code.
    pub status: u16,
    /// The response headers.
    pub headers: http::HeaderMap,
    /// The JSON response body.
    pub body: Vec<u8>,
}

impl ProviderResponse {
    /// The body as JSON, for assertions in tests.
    pub fn json(&self) -> Value {
        serde_json::from_slice(&self.body).unwrap_or(Value::Null)
    }

    fn new(status: u16, body: &Value) -> Self {
        let mut headers = http::HeaderMap::new();
        headers.insert(
            http::header::CONTENT_TYPE,
            http::HeaderValue::from_static("application/json"),
        );
        Self {
            status,
            headers,
            body: body.to_string().into_bytes(),
        }
    }

    fn error(id: Option<&str>, code: &str, message: &str) -> Self {
        let status = match code {
            "invalid_signature" => 401,
            "invalid_request" => 400,
            "unsupported_operation" | "not_found" => 404,
            "unavailable" => 503,
            _ => 500,
        };
        Self::new(
            status,
            &json!({ "id": id, "error": { "code": code, "message": message } }),
        )
    }
}

impl From<ProviderResponse> for http::Response<Vec<u8>> {
    fn from(value: ProviderResponse) -> Self {
        let mut response = http::Response::new(value.body);
        *response.status_mut() =
            http::StatusCode::from_u16(value.status).unwrap_or(http::StatusCode::OK);
        *response.headers_mut() = value.headers;
        response
    }
}

type OperationFuture = Pin<Box<dyn Future<Output = Result<Value, ProviderError>> + Send>>;
/// A registered operation: decodes its input (an error is `invalid_request`)
/// and starts the implementation.
type Operation = Arc<dyn Fn(Value, Environment) -> Result<OperationFuture, String> + Send + Sync>;

/// Serves the provider endpoint for one payment source.
///
/// ```no_run
/// # use voidhash::provider::*;
/// # #[derive(Clone)] struct Paddle;
/// # impl CatalogSource for Paddle {
/// #     async fn list_catalog(&self, _: CatalogRequest) -> Result<CatalogPage, ProviderError> { todo!() }
/// # }
/// # impl HistorySource for Paddle {
/// #     async fn list_history(&self, _: HistoryRequest) -> Result<HistoryPage, ProviderError> { todo!() }
/// # }
/// let handler = ProviderHandler::new("paddle", "vhps_...")
///     .catalog(Paddle)
///     .history(Paddle);
/// ```
#[derive(Clone)]
pub struct ProviderHandler {
    source: String,
    secret: String,
    operations: BTreeMap<&'static str, Operation>,
}

impl std::fmt::Debug for ProviderHandler {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("ProviderHandler")
            .field("source", &self.source)
            .field("operations", &self.operations.keys().collect::<Vec<_>>())
            .finish_non_exhaustive()
    }
}

impl ProviderHandler {
    /// A handler for the source with slug `source`, verifying requests with
    /// its signing secret (`vhps_...`). It answers only `describe` until
    /// operations are registered.
    pub fn new(source: impl Into<String>, signing_secret: impl Into<String>) -> Self {
        Self {
            source: source.into(),
            secret: signing_secret.into(),
            operations: BTreeMap::new(),
        }
    }

    /// Answers `catalog.list` with `source`.
    pub fn catalog<S: CatalogSource>(self, source: S) -> Self {
        let source = Arc::new(source);
        self.register(
            CATALOG_LIST,
            move |mut request: CatalogRequest, environment| {
                let source = Arc::clone(&source);
                request.environment = environment;
                async move { encode(source.list_catalog(request).await) }
            },
        )
    }

    /// Answers `history.list` with `source`.
    pub fn history<S: HistorySource>(self, source: S) -> Self {
        let source = Arc::new(source);
        self.register(
            HISTORY_LIST,
            move |mut request: HistoryRequest, environment| {
                let source = Arc::clone(&source);
                request.environment = environment;
                async move { encode(source.list_history(request).await) }
            },
        )
    }

    /// Answers `subscription.get` with `source`.
    pub fn subscription<S: SubscriptionSource>(self, source: S) -> Self {
        let source = Arc::new(source);
        self.register(
            SUBSCRIPTION_GET,
            move |mut request: SubscriptionRequest, environment| {
                let source = Arc::clone(&source);
                request.environment = environment;
                async move {
                    let subscription = encode(source.get_subscription(request).await)?;
                    Ok(json!({ "subscription": subscription }))
                }
            },
        )
    }

    /// Answers `subscription.cancel` with `source`.
    pub fn cancellations<S: CancellationSource>(self, source: S) -> Self {
        let source = Arc::new(source);
        self.register(
            SUBSCRIPTION_CANCEL,
            move |mut request: CancelSubscriptionRequest, environment| {
                let source = Arc::clone(&source);
                request.environment = environment;
                async move {
                    let subscription = encode(source.cancel_subscription(request).await)?;
                    Ok(json!({ "subscription": subscription }))
                }
            },
        )
    }

    /// Answers `transaction.refund` with `source`.
    pub fn refunds<S: RefundSource>(self, source: S) -> Self {
        let source = Arc::new(source);
        self.register(
            TRANSACTION_REFUND,
            move |mut request: RefundTransactionRequest, environment| {
                let source = Arc::clone(&source);
                request.environment = environment;
                async move {
                    let refund = encode(source.refund_transaction(request).await)?;
                    Ok(json!({ "refund": refund }))
                }
            },
        )
    }

    fn register<I, F, R>(mut self, operation: &'static str, call: F) -> Self
    where
        I: serde::de::DeserializeOwned,
        F: Fn(I, Environment) -> R + Send + Sync + 'static,
        R: Future<Output = Result<Value, ProviderError>> + Send + 'static,
    {
        let operation_fn: Operation = Arc::new(move |input, environment| {
            let input = serde_json::from_value(input).map_err(|error| error.to_string())?;
            Ok(Box::pin(call(input, environment)))
        });
        self.operations.insert(operation, operation_fn);
        self
    }

    /// Answers one request. Never fails: every problem becomes the protocol's
    /// error response.
    pub async fn handle(&self, request: ProviderRequest) -> ProviderResponse {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|value| value.as_secs() as i64)
            .unwrap_or_default();
        self.handle_at(request, now).await
    }

    /// Sends a correctly signed `test` request for `operation` with
    /// `input` through the handler, for unit tests of an implementation.
    /// Test requests show an implementation's own error messages.
    ///
    /// ```no_run
    /// # async fn example(handler: voidhash::provider::ProviderHandler) {
    /// let response = handler
    ///     .test("catalog.list", serde_json::json!({ "cursor": null }))
    ///     .await;
    /// assert_eq!(response.status, 200);
    /// # }
    /// ```
    pub async fn test(&self, operation: &str, input: Value) -> ProviderResponse {
        let body = json!({
            "protocolVersion": PROTOCOL_VERSION,
            "id": "preq_test",
            "source": self.source,
            "environment": "test",
            "operation": operation,
            "input": input,
        })
        .to_string()
        .into_bytes();
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|value| value.as_secs())
            .unwrap_or_default()
            .to_string();
        let mut headers = http::HeaderMap::new();
        headers.insert(
            http::header::CONTENT_TYPE,
            http::HeaderValue::from_static("application/json"),
        );
        headers.insert(
            TIMESTAMP_HEADER,
            http::HeaderValue::from_str(&timestamp).expect("digits are a valid header value"),
        );
        headers.insert(
            SIGNATURE_HEADER,
            http::HeaderValue::from_str(&webhooks::sign(&body, &timestamp, &self.secret))
                .expect("hex is a valid header value"),
        );
        self.handle(ProviderRequest { headers, body }).await
    }

    pub(crate) async fn handle_at(&self, request: ProviderRequest, now: i64) -> ProviderResponse {
        let (Some(timestamp), Some(signature)) = (
            single_header(&request.headers, TIMESTAMP_HEADER),
            single_header(&request.headers, SIGNATURE_HEADER),
        ) else {
            return ProviderResponse::error(
                None,
                "invalid_signature",
                "The request must carry one x-voidhash-timestamp and one x-voidhash-signature header",
            );
        };
        if !webhooks::verify_signature_at(
            &request.body,
            signature,
            timestamp,
            &self.secret,
            SIGNATURE_TOLERANCE_SECONDS,
            now,
        ) {
            return ProviderResponse::error(
                None,
                "invalid_signature",
                "The signature or timestamp is not valid",
            );
        }

        let Ok(body) = serde_json::from_slice::<Value>(&request.body) else {
            return ProviderResponse::error(None, "invalid_request", "The body is not JSON");
        };
        let id = body.get("id").and_then(Value::as_str);
        let envelope = match self.envelope(&body) {
            Ok(envelope) => envelope,
            Err(message) => return ProviderResponse::error(id, "invalid_request", &message),
        };

        if envelope.operation == DESCRIBE {
            let mut operations: Vec<&str> = self.operations.keys().copied().collect();
            operations.push(DESCRIBE);
            operations.sort_unstable();
            return ProviderResponse::new(
                200,
                &json!({
                    "id": id,
                    "result": {
                        "protocolVersion": PROTOCOL_VERSION,
                        "source": self.source,
                        "operations": operations,
                        "sdk": { "name": "voidhash-rust", "version": env!("CARGO_PKG_VERSION") },
                    },
                }),
            );
        }
        let Some(operation) = self.operations.get(envelope.operation) else {
            return ProviderResponse::error(
                id,
                "unsupported_operation",
                &format!("This endpoint does not implement {:?}", envelope.operation),
            );
        };

        let input = body.get("input").cloned().unwrap_or(Value::Null);
        let started = match operation(input.clone(), envelope.environment) {
            Ok(started) => started,
            Err(message) => {
                return ProviderResponse::error(
                    id,
                    "invalid_request",
                    &format!("Invalid input: {message}"),
                )
            }
        };
        let result = match started.await {
            Ok(result) => result,
            Err(error) => {
                let (code, message) = match error {
                    ProviderError::InvalidRequest(message) => ("invalid_request", message),
                    ProviderError::NotFound(message) => ("not_found", message),
                    ProviderError::Unavailable(message) => ("unavailable", message),
                    ProviderError::Other(error) => (
                        "provider_error",
                        match envelope.environment {
                            Environment::Test => error.to_string(),
                            Environment::Production => HIDDEN_ERROR_MESSAGE.to_string(),
                        },
                    ),
                };
                return ProviderResponse::error(id, code, &message);
            }
        };

        let checked = match envelope.operation {
            CATALOG_LIST => validate::catalog_page(&result),
            HISTORY_LIST => {
                // The input decoded above, so `kind` is one of the two.
                let kind = match input.get("kind").and_then(Value::as_str) {
                    Some("subscriptions") => HistoryKind::Subscriptions,
                    _ => HistoryKind::Transactions,
                };
                validate::history_page(&result, kind)
            }
            SUBSCRIPTION_GET => validate::subscription_result(&result),
            SUBSCRIPTION_CANCEL => validate::cancel_result(&result),
            TRANSACTION_REFUND => validate::refund_result(&result),
            // Only the operations above register.
            other => Err(format!("{other} is not a protocol operation")),
        };
        match checked {
            Ok(()) => ProviderResponse::new(200, &json!({ "id": id, "result": result })),
            Err(message) => ProviderResponse::error(
                id,
                "invalid_result",
                &format!(
                    "The {} result breaks the protocol: {message}",
                    envelope.operation
                ),
            ),
        }
    }

    fn envelope<'a>(&self, body: &'a Value) -> Result<Envelope<'a>, String> {
        if body.get("protocolVersion").and_then(Value::as_u64) != Some(PROTOCOL_VERSION) {
            return Err(format!(
                "This endpoint speaks protocol version {PROTOCOL_VERSION}"
            ));
        }
        if body.get("id").and_then(Value::as_str).is_none() {
            return Err("id must be a string".into());
        }
        match body.get("source").and_then(Value::as_str) {
            Some(source) if source == self.source => {}
            Some(source) => {
                return Err(format!(
                    "The request is for source {source:?}, this endpoint serves {:?}",
                    self.source
                ))
            }
            None => return Err("source must be a string".into()),
        }
        let environment = match body.get("environment").and_then(Value::as_str) {
            Some("production") => Environment::Production,
            Some("test") => Environment::Test,
            _ => return Err("environment must be production or test".into()),
        };
        let Some(operation) = body.get("operation").and_then(Value::as_str) else {
            return Err("operation must be a string".into());
        };
        Ok(Envelope {
            environment,
            operation,
        })
    }
}

struct Envelope<'a> {
    environment: Environment,
    operation: &'a str,
}

/// The header's value when it was sent exactly once.
fn single_header<'a>(headers: &'a http::HeaderMap, name: &str) -> Option<&'a str> {
    let mut values = headers.get_all(name).iter();
    match (values.next(), values.next()) {
        (Some(value), None) => value.to_str().ok(),
        _ => None,
    }
}

fn encode<T: serde::Serialize>(result: Result<T, ProviderError>) -> Result<Value, ProviderError> {
    serde_json::to_value(result?).map_err(ProviderError::other)
}

#[cfg(test)]
mod conformance_tests;
