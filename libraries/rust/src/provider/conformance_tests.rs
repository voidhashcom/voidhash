//! Replays the shared provider protocol conformance cases
//! (`libraries/test-fixtures/provider-protocol.json`).
//!
//! The cases return raw JSON, including results the typed API cannot express
//! (a fractional amount), so the fake operations register below the typed
//! builder methods while still decoding their input
//! into the typed requests.

use serde_json::Value;

use super::*;

const FIXTURES: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../test-fixtures/provider-protocol.json"
);

#[tokio::test]
async fn replays_every_conformance_case() {
    let fixtures: Value = serde_json::from_str(
        &std::fs::read_to_string(FIXTURES).expect("conformance fixtures are readable"),
    )
    .expect("conformance fixtures are JSON");
    let source = fixtures["source"].as_str().expect("fixture source");
    let secret = fixtures["secret"].as_str().expect("fixture secret");
    let now = fixtures["now"].as_i64().expect("fixture clock");
    let cases = fixtures["cases"].as_array().expect("fixture cases");
    assert!(!cases.is_empty());

    for case in cases {
        let name = case["name"].as_str().expect("case name");
        let mut handler = ProviderHandler::new(source, secret);
        for (operation, behavior) in case["provider"]["operations"]
            .as_object()
            .expect("case operations")
        {
            handler = match operation.as_str() {
                CATALOG_LIST => fake::<CatalogRequest>(handler, CATALOG_LIST, behavior),
                HISTORY_LIST => fake::<HistoryRequest>(handler, HISTORY_LIST, behavior),
                SUBSCRIPTION_GET => {
                    fake::<SubscriptionRequest>(handler, SUBSCRIPTION_GET, behavior)
                }
                SUBSCRIPTION_CANCEL => {
                    fake::<CancelSubscriptionRequest>(handler, SUBSCRIPTION_CANCEL, behavior)
                }
                TRANSACTION_REFUND => {
                    fake::<RefundTransactionRequest>(handler, TRANSACTION_REFUND, behavior)
                }
                other => panic!("{name}: unknown operation {other}"),
            };
        }

        let mut headers = http::HeaderMap::new();
        for (header, value) in case["request"]["headers"]
            .as_object()
            .expect("case headers")
        {
            headers.append(
                http::HeaderName::from_bytes(header.as_bytes()).expect("header name"),
                http::HeaderValue::from_str(value.as_str().expect("header value"))
                    .expect("header value"),
            );
        }
        let body = case["request"]["body"]
            .as_str()
            .expect("case body")
            .as_bytes()
            .to_vec();

        let response = handler
            .handle_at(ProviderRequest { headers, body }, now)
            .await;

        let actual = response.json();
        assert_eq!(
            response.status,
            case["expect"]["status"].as_u64().expect("expected status") as u16,
            "{name}: status, body {actual}"
        );
        if let Err(path) = subset(&case["expect"]["body"], &actual, "body") {
            panic!("{name}: {path} differs; got {actual}");
        }
    }
}

/// Registers an operation that checks its decoded input against
/// `expectInput` and answers as the case says.
fn fake<I>(handler: ProviderHandler, operation: &'static str, behavior: &Value) -> ProviderHandler
where
    I: serde::de::DeserializeOwned + PartialEq + std::fmt::Debug + Send + 'static,
{
    let behavior = behavior.clone();
    handler.register(operation, move |input: I, _environment| {
        if let Some(expected) = behavior.get("expectInput") {
            let expected: I =
                serde_json::from_value(expected.clone()).expect("expectInput decodes");
            assert_eq!(input, expected, "{operation} input");
        }
        let behavior = behavior.clone();
        async move {
            if let Some(message) = behavior.get("throws") {
                return Err(ProviderError::other(
                    message.as_str().expect("throws message").to_string(),
                ));
            }
            if let Some(error) = behavior.get("throwsProviderError") {
                let message = error["message"]
                    .as_str()
                    .expect("error message")
                    .to_string();
                return Err(match error["code"].as_str() {
                    Some("invalid_request") => ProviderError::InvalidRequest(message),
                    Some("not_found") => ProviderError::NotFound(message),
                    Some("unavailable") => ProviderError::Unavailable(message),
                    other => panic!("unknown provider error code {other:?}"),
                });
            }
            Ok(behavior["returns"].clone())
        }
    })
}

/// Checks that `expected` is contained in `actual`: an absent field equals
/// null and timestamps compare as instants. Returns the first differing path.
fn subset(expected: &Value, actual: &Value, path: &str) -> Result<(), String> {
    match (expected, actual) {
        (Value::Object(expected), Value::Object(actual)) => {
            for (key, value) in expected {
                subset(
                    value,
                    actual.get(key).unwrap_or(&Value::Null),
                    &format!("{path}.{key}"),
                )?;
            }
            Ok(())
        }
        (Value::Array(expected), Value::Array(actual)) if expected.len() == actual.len() => {
            for (index, (expected, actual)) in expected.iter().zip(actual).enumerate() {
                subset(expected, actual, &format!("{path}[{index}]"))?;
            }
            Ok(())
        }
        (Value::String(expected), Value::String(actual)) if expected != actual => {
            match (
                chrono::DateTime::parse_from_rfc3339(expected),
                chrono::DateTime::parse_from_rfc3339(actual),
            ) {
                (Ok(expected), Ok(actual)) if expected == actual => Ok(()),
                _ => Err(path.to_string()),
            }
        }
        (Value::Number(expected), Value::Number(actual))
            if expected.as_f64() == actual.as_f64() =>
        {
            Ok(())
        }
        (expected, actual) if expected == actual => Ok(()),
        _ => Err(path.to_string()),
    }
}
