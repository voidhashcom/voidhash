//! Checks what a provider returns against the protocol before it is sent, so a
//! mistake surfaces as `invalid_result` naming the field rather than as a
//! record Voidhash refuses later.
//!
//! The check runs on the serialized JSON: the typed results cannot express
//! most violations, but empty strings, over-long ids and oversized pages can.

use serde_json::{Map, Value};

use super::types::HistoryKind;

/// The longest id a source may give a transaction or subscription.
pub(crate) const RECORD_ID_MAX_LENGTH: usize = 200;
/// The longest key, name or person id the protocol accepts.
pub(crate) const IDENTIFIER_MAX_LENGTH: usize = 255;
const PAGE_MAX_ITEMS: usize = 1000;
/// Integers above this lose precision in JavaScript, where Voidhash reads them.
const MAX_SAFE_INTEGER: f64 = 9_007_199_254_740_991.0;

/// Checks a `catalog.list` result.
pub(crate) fn catalog_page(result: &Value) -> Result<(), String> {
    page(result, "result", |item, path| {
        let product = object(item, path)?;
        string(product, "key", path, IDENTIFIER_MAX_LENGTH)?;
        string(product, "name", path, IDENTIFIER_MAX_LENGTH)?;
        one_of(
            product,
            "kind",
            path,
            &["subscription", "one_time", "consumable"],
        )
    })
}

/// Checks a `history.list` result against the kind the request asked for.
pub(crate) fn history_page(result: &Value, kind: HistoryKind) -> Result<(), String> {
    match kind {
        HistoryKind::Subscriptions => page(result, "result", subscription),
        HistoryKind::Transactions => page(result, "result", transaction),
    }
}

/// Checks a `subscription.get` result.
pub(crate) fn subscription_result(result: &Value) -> Result<(), String> {
    let fields = object(result, "result")?;
    match fields.get("subscription") {
        Some(Value::Null) => Ok(()),
        Some(value) => subscription(value, "result.subscription"),
        None => Err("result.subscription is required; return null when there is none".into()),
    }
}

/// Checks a `subscription.cancel` result: the subscription's state afterwards.
pub(crate) fn cancel_result(result: &Value) -> Result<(), String> {
    let fields = object(result, "result")?;
    match fields.get("subscription") {
        Some(value) => subscription(value, "result.subscription"),
        None => Err("result.subscription is required".into()),
    }
}

/// Checks a `transaction.refund` result: a transaction of type `refund`.
pub(crate) fn refund_result(result: &Value) -> Result<(), String> {
    let fields = object(result, "result")?;
    let Some(refund) = fields.get("refund") else {
        return Err("result.refund is required".into());
    };
    transaction(refund, "result.refund")?;
    match refund.get("type").and_then(Value::as_str) {
        Some("refund") => Ok(()),
        _ => Err("result.refund.type must be refund".into()),
    }
}

fn page(
    result: &Value,
    path: &str,
    item: impl Fn(&Value, &str) -> Result<(), String>,
) -> Result<(), String> {
    let fields = object(result, path)?;
    let Some(Value::Array(items)) = fields.get("items") else {
        return Err(format!("{path}.items must be an array"));
    };
    if items.len() > PAGE_MAX_ITEMS {
        return Err(format!(
            "{path}.items has {} items; a page holds at most {PAGE_MAX_ITEMS}",
            items.len()
        ));
    }
    for (index, value) in items.iter().enumerate() {
        item(value, &format!("{path}.items[{index}]"))?;
    }
    match fields.get("nextCursor") {
        Some(Value::Null | Value::String(_)) => Ok(()),
        _ => Err(format!("{path}.nextCursor must be a string or null")),
    }
}

fn subscription(value: &Value, path: &str) -> Result<(), String> {
    let fields = object(value, path)?;
    string(fields, "id", path, RECORD_ID_MAX_LENGTH)?;
    buyer(fields, path)?;
    string(fields, "productKey", path, IDENTIFIER_MAX_LENGTH)?;
    one_of(
        fields,
        "status",
        path,
        &["trialing", "active", "past_due", "canceled", "expired"],
    )?;
    date(fields, "currentPeriodStart", path)?;
    date(fields, "currentPeriodEnd", path)?;
    if !matches!(fields.get("willRenew"), Some(Value::Bool(_))) {
        return Err(format!("{path}.willRenew must be a boolean"));
    }
    optional(fields, "canceledAt", |_| date(fields, "canceledAt", path))?;
    date(fields, "updatedAt", path)
}

fn transaction(value: &Value, path: &str) -> Result<(), String> {
    let fields = object(value, path)?;
    string(fields, "id", path, RECORD_ID_MAX_LENGTH)?;
    one_of(fields, "type", path, &["charge", "refund"])?;
    buyer(fields, path)?;
    optional(fields, "productKey", |_| {
        string(fields, "productKey", path, IDENTIFIER_MAX_LENGTH)
    })?;
    minor_amount(fields, "amount", path)?;
    match fields.get("currency") {
        Some(Value::String(currency)) if currency.encode_utf16().count() == 3 => {}
        _ => {
            return Err(format!(
                "{path}.currency must be a three-letter currency code"
            ))
        }
    }
    optional(fields, "fee", |_| minor_amount(fields, "fee", path))?;
    optional(fields, "tax", |_| minor_amount(fields, "tax", path))?;
    date(fields, "occurredAt", path)?;
    optional(fields, "subscriptionId", |_| {
        string(fields, "subscriptionId", path, RECORD_ID_MAX_LENGTH)
    })?;
    optional(fields, "periodStart", |_| date(fields, "periodStart", path))?;
    optional(fields, "periodEnd", |_| date(fields, "periodEnd", path))?;
    optional(fields, "refundsTransactionId", |_| {
        string(fields, "refundsTransactionId", path, RECORD_ID_MAX_LENGTH)
    })
}

/// The optional `distinctId` and `customer: { externalId }` naming the buyer.
fn buyer(fields: &Map<String, Value>, path: &str) -> Result<(), String> {
    optional(fields, "distinctId", |_| {
        string(fields, "distinctId", path, IDENTIFIER_MAX_LENGTH)
    })?;
    optional(fields, "customer", |customer| {
        let customer_path = format!("{path}.customer");
        string(
            object(customer, &customer_path)?,
            "externalId",
            &customer_path,
            IDENTIFIER_MAX_LENGTH,
        )
    })
}

fn object<'a>(value: &'a Value, path: &str) -> Result<&'a Map<String, Value>, String> {
    value
        .as_object()
        .ok_or_else(|| format!("{path} must be an object"))
}

/// Runs `check` on a field that may be absent or null.
fn optional(
    fields: &Map<String, Value>,
    field: &str,
    check: impl FnOnce(&Value) -> Result<(), String>,
) -> Result<(), String> {
    match fields.get(field) {
        None | Some(Value::Null) => Ok(()),
        Some(value) => check(value),
    }
}

fn string(
    fields: &Map<String, Value>,
    field: &str,
    path: &str,
    max_length: usize,
) -> Result<(), String> {
    match fields.get(field) {
        Some(Value::String(value)) if (1..=max_length).contains(&value.encode_utf16().count()) => {
            Ok(())
        }
        _ => Err(format!(
            "{path}.{field} must be a string of 1 to {max_length} characters"
        )),
    }
}

fn one_of(
    fields: &Map<String, Value>,
    field: &str,
    path: &str,
    allowed: &[&str],
) -> Result<(), String> {
    match fields.get(field).and_then(Value::as_str) {
        Some(value) if allowed.contains(&value) => Ok(()),
        _ => Err(format!(
            "{path}.{field} must be one of {}",
            allowed.join(", ")
        )),
    }
}

fn minor_amount(fields: &Map<String, Value>, field: &str, path: &str) -> Result<(), String> {
    let is_minor_amount = fields
        .get(field)
        .and_then(Value::as_f64)
        .is_some_and(|amount| amount >= 0.0 && amount.fract() == 0.0 && amount <= MAX_SAFE_INTEGER);
    if is_minor_amount {
        Ok(())
    } else {
        Err(format!(
            "{path}.{field} must be a non-negative integer amount in minor units"
        ))
    }
}

fn date(fields: &Map<String, Value>, field: &str, path: &str) -> Result<(), String> {
    match fields.get(field).and_then(Value::as_str) {
        Some(value) if chrono::DateTime::parse_from_rfc3339(value).is_ok() => Ok(()),
        _ => Err(format!("{path}.{field} must be an ISO 8601 date")),
    }
}
