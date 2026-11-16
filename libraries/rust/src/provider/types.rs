//! What Voidhash asks a provider endpoint for and what the endpoint returns.

use chrono::{DateTime, Utc};

use super::validate;

pub use crate::payment_sources::{Environment, SubscriptionStatus};

/// Input of `catalog.list`: one page of the source's products.
#[derive(Clone, Debug, PartialEq, Eq, serde::Deserialize)]
#[non_exhaustive]
pub struct CatalogRequest {
    /// The `next_cursor` of the previous page; `None` for the first page.
    pub cursor: Option<String>,
    /// Whether Voidhash asks for test or real data.
    #[serde(skip)]
    pub environment: Environment,
}

impl CatalogRequest {
    /// A request for the page starting at `cursor`, in production.
    pub fn new(cursor: Option<String>) -> Self {
        Self {
            cursor,
            environment: Environment::Production,
        }
    }
}

/// Input of `history.list`: one page of past records of one kind.
#[derive(Clone, Debug, PartialEq, Eq, serde::Deserialize)]
#[non_exhaustive]
pub struct HistoryRequest {
    /// Which records to list.
    pub kind: HistoryKind,
    /// The `next_cursor` of the previous page; `None` for the first page.
    pub cursor: Option<String>,
    /// When the import started. List records created before it; later ones
    /// arrive through the push endpoints.
    #[serde(with = "iso8601")]
    pub before: DateTime<Utc>,
    /// Whether Voidhash asks for test or real data.
    #[serde(skip)]
    pub environment: Environment,
}

impl HistoryRequest {
    /// A request for the page of `kind` starting at `cursor`, in production.
    pub fn new(kind: HistoryKind, cursor: Option<String>, before: DateTime<Utc>) -> Self {
        Self {
            kind,
            cursor,
            before,
            environment: Environment::Production,
        }
    }
}

/// The records a [`HistoryRequest`] asks for.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HistoryKind {
    /// Answer with [`HistoryPage::Subscriptions`].
    Subscriptions,
    /// Answer with [`HistoryPage::Transactions`].
    Transactions,
}

/// Input of `subscription.get`: a subscription's current state.
#[derive(Clone, Debug, PartialEq, Eq, serde::Deserialize)]
#[non_exhaustive]
pub struct SubscriptionRequest {
    /// The source's subscription id.
    #[serde(deserialize_with = "record_id")]
    pub id: String,
    /// Whether Voidhash asks for test or real data.
    #[serde(skip)]
    pub environment: Environment,
}

impl SubscriptionRequest {
    /// A request for the subscription `id`, in production.
    pub fn new(id: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            environment: Environment::Production,
        }
    }
}

/// Input of `subscription.cancel`: cancel a subscription at the source.
#[derive(Clone, Debug, PartialEq, Eq, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
#[non_exhaustive]
pub struct CancelSubscriptionRequest {
    /// The source's subscription id.
    #[serde(deserialize_with = "record_id")]
    pub id: String,
    /// `true` to stop renewal and keep access until the period ends; `false`
    /// to end the subscription now.
    pub at_period_end: bool,
    /// Whether Voidhash asks for test or real data.
    #[serde(skip)]
    pub environment: Environment,
}

impl CancelSubscriptionRequest {
    /// A request to cancel the subscription `id`, in production.
    pub fn new(id: impl Into<String>, at_period_end: bool) -> Self {
        Self {
            id: id.into(),
            at_period_end,
            environment: Environment::Production,
        }
    }
}

/// Input of `transaction.refund`: refund a charge at the source.
#[derive(Clone, Debug, PartialEq, Eq, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
#[non_exhaustive]
pub struct RefundTransactionRequest {
    /// The source's id of the charge to refund.
    #[serde(deserialize_with = "record_id")]
    pub transaction_id: String,
    /// How much to refund, in minor units; `None` refunds everything left of
    /// the charge.
    #[serde(deserialize_with = "nullable")]
    pub amount: Option<u64>,
    /// Why, as the person who started the refund gave it; at most 500
    /// characters.
    #[serde(deserialize_with = "refund_reason")]
    pub reason: Option<String>,
    /// Whether Voidhash asks for test or real data.
    #[serde(skip)]
    pub environment: Environment,
}

impl RefundTransactionRequest {
    /// A request to refund `amount` of the charge `transaction_id` (`None`
    /// for everything left), in production.
    pub fn new(transaction_id: impl Into<String>, amount: Option<u64>) -> Self {
        Self {
            transaction_id: transaction_id.into(),
            amount,
            reason: None,
            environment: Environment::Production,
        }
    }
}

/// One page of products.
#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogPage {
    /// At most 1000 products.
    pub items: Vec<CatalogProduct>,
    /// Where the next page starts; `None` on the last page.
    pub next_cursor: Option<String>,
}

impl CatalogPage {
    /// A page of products; pass `None` as `next_cursor` on the last page.
    pub fn new(items: Vec<CatalogProduct>, next_cursor: Option<String>) -> Self {
        Self { items, next_cursor }
    }
}

/// A product a source sells.
#[derive(Clone, Debug, serde::Serialize)]
pub struct CatalogProduct {
    /// The product key payments name in `product_key`.
    pub key: String,
    /// The product's display name.
    pub name: String,
    /// How the product is sold.
    pub kind: ProductKind,
}

impl CatalogProduct {
    /// A product with its key, display name and kind.
    pub fn new(key: impl Into<String>, name: impl Into<String>, kind: ProductKind) -> Self {
        Self {
            key: key.into(),
            name: name.into(),
            kind,
        }
    }
}

/// How a product is sold.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, serde::Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ProductKind {
    /// Renews every period.
    Subscription,
    /// Bought once, kept forever.
    OneTime,
    /// Bought and used up, possibly many times.
    Consumable,
}

/// One page of history, of the kind the request asked for.
#[derive(Clone, Debug, serde::Serialize)]
#[serde(untagged)]
pub enum HistoryPage {
    /// Subscription states, for [`HistoryKind::Subscriptions`].
    #[serde(rename_all = "camelCase")]
    Subscriptions {
        /// At most 1000 subscriptions.
        items: Vec<Subscription>,
        /// Where the next page starts; `None` on the last page.
        next_cursor: Option<String>,
    },
    /// Charges and refunds, for [`HistoryKind::Transactions`].
    #[serde(rename_all = "camelCase")]
    Transactions {
        /// At most 1000 transactions.
        items: Vec<Transaction>,
        /// Where the next page starts; `None` on the last page.
        next_cursor: Option<String>,
    },
}

/// The buyer as the source knows them.
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Customer {
    /// The source's customer id.
    #[serde(deserialize_with = "identifier")]
    pub external_id: String,
}

/// A subscription's state, with the same fields the subscription push takes.
#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Subscription {
    /// The source's subscription id.
    pub id: String,
    /// The person holding it.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub distinct_id: Option<String>,
    /// The source's customer holding it.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub customer: Option<Customer>,
    /// The subscribed product's key.
    pub product_key: String,
    /// Its state at the source.
    pub status: SubscriptionStatus,
    /// Start of the current period.
    #[serde(with = "iso8601")]
    pub current_period_start: DateTime<Utc>,
    /// End of the current period.
    #[serde(with = "iso8601")]
    pub current_period_end: DateTime<Utc>,
    /// Whether it renews at the end of the current period.
    pub will_renew: bool,
    /// When a canceled subscription's access ended.
    #[serde(with = "iso8601::option", skip_serializing_if = "Option::is_none")]
    pub canceled_at: Option<DateTime<Utc>>,
    /// When the source last changed it.
    #[serde(with = "iso8601")]
    pub updated_at: DateTime<Utc>,
}

impl Subscription {
    /// A subscription's state; name its holder with
    /// [`Subscription::distinct_id`] or [`Subscription::customer`].
    pub fn new(
        id: impl Into<String>,
        product_key: impl Into<String>,
        status: SubscriptionStatus,
        current_period_start: DateTime<Utc>,
        current_period_end: DateTime<Utc>,
        will_renew: bool,
        updated_at: DateTime<Utc>,
    ) -> Self {
        Self {
            id: id.into(),
            distinct_id: None,
            customer: None,
            product_key: product_key.into(),
            status,
            current_period_start,
            current_period_end,
            will_renew,
            canceled_at: None,
            updated_at,
        }
    }

    /// Names the person holding the subscription.
    pub fn distinct_id(mut self, distinct_id: impl Into<String>) -> Self {
        self.distinct_id = Some(distinct_id.into());
        self
    }

    /// Names the source's customer holding the subscription.
    pub fn customer(mut self, customer_id: impl Into<String>) -> Self {
        self.customer = Some(Customer {
            external_id: customer_id.into(),
        });
        self
    }

    /// When a canceled subscription's access ended.
    pub fn canceled_at(mut self, canceled_at: DateTime<Utc>) -> Self {
        self.canceled_at = Some(canceled_at);
        self
    }
}

/// Whether a [`Transaction`] took or returned money.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, serde::Serialize)]
#[serde(rename_all = "snake_case")]
pub enum TransactionType {
    /// A payment.
    Charge,
    /// Money returned for an earlier charge.
    Refund,
}

/// A charge or refund, with the same fields the transaction push takes.
/// Amounts are integers in minor units (cents).
#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Transaction {
    /// The source's transaction id.
    pub id: String,
    /// Charge or refund.
    #[serde(rename = "type")]
    pub transaction_type: TransactionType,
    /// The paying person.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub distinct_id: Option<String>,
    /// The source's paying customer.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub customer: Option<Customer>,
    /// The product key; required for charges.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub product_key: Option<String>,
    /// The amount in minor units.
    pub amount: u64,
    /// The three-letter ISO 4217 currency code.
    pub currency: String,
    /// The source's commission, in minor units.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fee: Option<u64>,
    /// The tax included in the amount, in minor units.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tax: Option<u64>,
    /// When the money moved.
    #[serde(with = "iso8601")]
    pub occurred_at: DateTime<Utc>,
    /// The subscription a charge pays for.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subscription_id: Option<String>,
    /// Start of the subscription period a charge pays for.
    #[serde(with = "iso8601::option", skip_serializing_if = "Option::is_none")]
    pub period_start: Option<DateTime<Utc>>,
    /// End of the subscription period a charge pays for.
    #[serde(with = "iso8601::option", skip_serializing_if = "Option::is_none")]
    pub period_end: Option<DateTime<Utc>>,
    /// The charge a refund returns money for.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub refunds_transaction_id: Option<String>,
}

impl Transaction {
    /// A charge for `product_key`; name the buyer with
    /// [`Transaction::distinct_id`] or [`Transaction::customer`].
    pub fn charge(
        id: impl Into<String>,
        product_key: impl Into<String>,
        amount: u64,
        currency: impl Into<String>,
        occurred_at: DateTime<Utc>,
    ) -> Self {
        Self {
            id: id.into(),
            transaction_type: TransactionType::Charge,
            distinct_id: None,
            customer: None,
            product_key: Some(product_key.into()),
            amount,
            currency: currency.into(),
            fee: None,
            tax: None,
            occurred_at,
            subscription_id: None,
            period_start: None,
            period_end: None,
            refunds_transaction_id: None,
        }
    }

    /// A refund of the charge `refunds_transaction_id`.
    pub fn refund(
        id: impl Into<String>,
        refunds_transaction_id: impl Into<String>,
        amount: u64,
        currency: impl Into<String>,
        occurred_at: DateTime<Utc>,
    ) -> Self {
        Self {
            transaction_type: TransactionType::Refund,
            product_key: None,
            refunds_transaction_id: Some(refunds_transaction_id.into()),
            ..Self::charge(id, "", amount, currency, occurred_at)
        }
    }

    /// Names the paying person.
    pub fn distinct_id(mut self, distinct_id: impl Into<String>) -> Self {
        self.distinct_id = Some(distinct_id.into());
        self
    }

    /// Names the source's paying customer.
    pub fn customer(mut self, customer_id: impl Into<String>) -> Self {
        self.customer = Some(Customer {
            external_id: customer_id.into(),
        });
        self
    }

    /// The source's commission, in minor units.
    pub fn fee(mut self, fee: u64) -> Self {
        self.fee = Some(fee);
        self
    }

    /// The tax included in the amount, in minor units.
    pub fn tax(mut self, tax: u64) -> Self {
        self.tax = Some(tax);
        self
    }

    /// The subscription a charge pays for, and the period it pays for.
    pub fn subscription(
        mut self,
        subscription_id: impl Into<String>,
        period_start: DateTime<Utc>,
        period_end: DateTime<Utc>,
    ) -> Self {
        self.subscription_id = Some(subscription_id.into());
        self.period_start = Some(period_start);
        self.period_end = Some(period_end);
        self
    }
}

// Input fields are checked as the protocol defines them. Fields typed
// `Option` use `deserialize_with` so that a missing key is refused: the
// protocol always sends them, with `null` for none.

fn record_id<'de, D: serde::Deserializer<'de>>(deserializer: D) -> Result<String, D::Error> {
    bounded(deserializer, 1, validate::RECORD_ID_MAX_LENGTH)
}

fn identifier<'de, D: serde::Deserializer<'de>>(deserializer: D) -> Result<String, D::Error> {
    bounded(deserializer, 1, validate::IDENTIFIER_MAX_LENGTH)
}

fn refund_reason<'de, D: serde::Deserializer<'de>>(
    deserializer: D,
) -> Result<Option<String>, D::Error> {
    nullable(deserializer)?
        .map(|value| check_length(value, 0, REFUND_REASON_MAX_LENGTH))
        .transpose()
}

fn nullable<'de, D, T>(deserializer: D) -> Result<Option<T>, D::Error>
where
    D: serde::Deserializer<'de>,
    T: serde::Deserialize<'de>,
{
    <Option<T> as serde::Deserialize>::deserialize(deserializer)
}

fn bounded<'de, D: serde::Deserializer<'de>>(
    deserializer: D,
    min: usize,
    max: usize,
) -> Result<String, D::Error> {
    check_length(
        <String as serde::Deserialize>::deserialize(deserializer)?,
        min,
        max,
    )
}

/// Lengths count UTF-16 code units, as JavaScript does where Voidhash checks
/// them.
fn check_length<E: serde::de::Error>(value: String, min: usize, max: usize) -> Result<String, E> {
    let length = value.encode_utf16().count();
    if (min..=max).contains(&length) {
        Ok(value)
    } else {
        Err(E::custom(format!(
            "a string of {length} characters where {min} to {max} are allowed"
        )))
    }
}

const REFUND_REASON_MAX_LENGTH: usize = 500;

/// Dates on the wire: ISO 8601 in UTC with milliseconds.
mod iso8601 {
    use chrono::{DateTime, SecondsFormat, Utc};

    pub fn serialize<S: serde::Serializer>(
        at: &DateTime<Utc>,
        serializer: S,
    ) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&at.to_rfc3339_opts(SecondsFormat::Millis, true))
    }

    pub fn deserialize<'de, D: serde::Deserializer<'de>>(
        deserializer: D,
    ) -> Result<DateTime<Utc>, D::Error> {
        let value = <String as serde::Deserialize>::deserialize(deserializer)?;
        DateTime::parse_from_rfc3339(&value)
            .map(|at| at.with_timezone(&Utc))
            .map_err(|error| serde::de::Error::custom(format!("invalid date {value:?}: {error}")))
    }

    pub mod option {
        use chrono::{DateTime, Utc};

        pub fn serialize<S: serde::Serializer>(
            at: &Option<DateTime<Utc>>,
            serializer: S,
        ) -> Result<S::Ok, S::Error> {
            match at {
                Some(at) => super::serialize(at, serializer),
                None => serializer.serialize_none(),
            }
        }
    }
}
