//! Payments from a provider Voidhash does not integrate natively, pushed from
//! the customer's backend.
//!
//! ```no_run
//! # async fn example() -> Result<(), voidhash::Error> {
//! use voidhash::payment_sources::Charge;
//!
//! let client = voidhash::VoidhashClient::new("vh_sk_...")?;
//! // The payment source's payment provider id.
//! let paddle = client.payment_source("pp_conf_...");
//! let at = chrono::Utc::now();
//! paddle
//!     .charge(
//!         "txn_123",
//!         Charge::new("user-123", "pri_monthly", 4900, "EUR", at).subscription_id("sub_9"),
//!     )
//!     .await?;
//! # Ok(())
//! # }
//! ```

use chrono::{DateTime, SecondsFormat, Utc};

use crate::client::VoidhashClient;
use crate::error::Error;
use crate::generated::types;

/// Whether a payment is real or a test.
#[derive(
    Clone, Copy, Debug, Default, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize,
)]
#[serde(rename_all = "snake_case")]
pub enum Environment {
    /// Real money.
    #[default]
    Production,
    /// Test payments.
    Test,
}

/// The state a subscription is in at the source.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SubscriptionStatus {
    /// In a free trial.
    Trialing,
    /// Paid and current.
    Active,
    /// A renewal payment failed and the source is retrying it.
    PastDue,
    /// Ended early; access ends at `canceled_at`.
    Canceled,
    /// Ran to the end of its last period.
    Expired,
}

/// Records payments and subscription state for one payment source. Create one
/// with [`crate::VoidhashClient::payment_source`].
///
/// Every record is keyed by the source's own id, so repeating a request is
/// safe: the same request again returns the recorded result.
pub struct PaymentSourceApi<'a> {
    pub(crate) client: &'a VoidhashClient,
    pub(crate) payment_provider_id: String,
}

impl PaymentSourceApi<'_> {
    /// Records a charge under the source's transaction id.
    pub async fn charge(
        &self,
        transaction_id: &str,
        charge: Charge,
    ) -> Result<types::PaymentSourceTransaction, Error> {
        let body = types::RecordPaymentSourceTransactionBody {
            type_: types::RecordPaymentSourceTransactionBodyType::Charge,
            distinct_id: charge.distinct_id,
            customer: charge.customer.map(customer),
            product_key: Some(charge.product_key),
            amount: charge.amount,
            currency: charge.currency,
            fee: charge.fee,
            tax: charge.tax,
            occurred_at: iso8601(charge.occurred_at),
            subscription_id: charge.subscription_id,
            period_start: charge.period_start.map(iso8601),
            period_end: charge.period_end.map(iso8601),
            refunds_transaction_id: None,
            environment: charge.environment.map(environment),
        };
        let project_id = self.client.project_id().await?;
        Ok(self
            .client
            .core
            .payment_sources_upsert_transaction(
                project_id,
                &self.payment_provider_id,
                transaction_id,
                &body,
            )
            .await?
            .into_inner())
    }

    /// Records a refund of an earlier charge under the source's refund id.
    pub async fn refund(
        &self,
        refund_id: &str,
        refund: Refund,
    ) -> Result<types::PaymentSourceTransaction, Error> {
        let body = types::RecordPaymentSourceTransactionBody {
            type_: types::RecordPaymentSourceTransactionBodyType::Refund,
            distinct_id: refund.distinct_id,
            customer: refund.customer.map(customer),
            product_key: refund.product_key,
            amount: refund.amount,
            currency: refund.currency,
            fee: refund.fee,
            tax: refund.tax,
            occurred_at: iso8601(refund.occurred_at),
            subscription_id: None,
            period_start: None,
            period_end: None,
            refunds_transaction_id: Some(refund.refunds_transaction_id),
            environment: refund.environment.map(environment),
        };
        let project_id = self.client.project_id().await?;
        Ok(self
            .client
            .core
            .payment_sources_upsert_transaction(
                project_id,
                &self.payment_provider_id,
                refund_id,
                &body,
            )
            .await?
            .into_inner())
    }

    /// Records a subscription's latest state under the source's subscription
    /// id. A state older than the recorded one (by `updated_at`) is answered
    /// `superseded` and changes nothing.
    pub async fn subscription(
        &self,
        subscription_id: &str,
        state: SubscriptionState,
    ) -> Result<types::PaymentSourceSubscription, Error> {
        let body = types::RecordPaymentSourceSubscriptionBody {
            distinct_id: state.distinct_id,
            customer: state.customer.map(customer),
            product_key: state.product_key,
            status: match state.status {
                SubscriptionStatus::Trialing => {
                    types::RecordPaymentSourceSubscriptionBodyStatus::Trialing
                }
                SubscriptionStatus::Active => {
                    types::RecordPaymentSourceSubscriptionBodyStatus::Active
                }
                SubscriptionStatus::PastDue => {
                    types::RecordPaymentSourceSubscriptionBodyStatus::PastDue
                }
                SubscriptionStatus::Canceled => {
                    types::RecordPaymentSourceSubscriptionBodyStatus::Canceled
                }
                SubscriptionStatus::Expired => {
                    types::RecordPaymentSourceSubscriptionBodyStatus::Expired
                }
            },
            current_period_start: iso8601(state.current_period_start),
            current_period_end: iso8601(state.current_period_end),
            is_auto_renewing: state.is_auto_renewing,
            canceled_at: state.canceled_at.map(iso8601),
            updated_at: iso8601(state.updated_at),
            environment: state.environment.map(environment),
        };
        let project_id = self.client.project_id().await?;
        Ok(self
            .client
            .core
            .payment_sources_upsert_subscription(
                project_id,
                &self.payment_provider_id,
                subscription_id,
                &body,
            )
            .await?
            .into_inner())
    }

    /// Cancels a subscription at the source through its provider endpoint
    /// (`subscription.cancel`) and records the state the endpoint answers.
    ///
    /// When the endpoint could not cancel it, fails with `conflict` (the
    /// endpoint is missing, does not support it or refused) or `unavailable`
    /// (it did not answer properly); the error's `code` and `message` say why.
    pub async fn cancel_subscription(
        &self,
        subscription_id: &str,
        when: CancelAt,
    ) -> Result<types::PaymentSourceSubscription, Error> {
        let body = types::CancelPaymentSourceSubscriptionBody {
            is_immediate: Some(when == CancelAt::Now),
        };
        let project_id = self.client.project_id().await?;
        Ok(self
            .client
            .core
            .payment_sources_cancel_subscription(
                project_id,
                &self.payment_provider_id,
                subscription_id,
                &body,
            )
            .await?
            .into_inner())
    }

    /// Refunds a charge at the source through its provider endpoint
    /// (`transaction.refund`) and records the refund the endpoint answers.
    /// Unlike [`PaymentSourceApi::refund`], which reports a refund the source
    /// already made, this asks the source to make one.
    ///
    /// When the endpoint could not refund it, fails with `conflict` (the
    /// endpoint is missing, does not support it or refused) or `unavailable`
    /// (it did not answer properly); the error's `code` and `message` say why.
    pub async fn refund_transaction(
        &self,
        transaction_id: &str,
        refund: RefundTransaction,
    ) -> Result<types::PaymentSourceTransaction, Error> {
        let body = types::RefundPaymentSourceTransactionBody {
            amount: refund.amount,
            reason: refund.reason,
        };
        let project_id = self.client.project_id().await?;
        Ok(self
            .client
            .core
            .payment_sources_refund_transaction(
                project_id,
                &self.payment_provider_id,
                transaction_id,
                &body,
            )
            .await?
            .into_inner())
    }
}

/// When [`PaymentSourceApi::cancel_subscription`] ends a subscription.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum CancelAt {
    /// Stop renewal; access lasts until the current period ends.
    PeriodEnd,
    /// End the subscription and its access now.
    Now,
}

/// A refund for [`PaymentSourceApi::refund_transaction`].
#[derive(Clone, Debug)]
pub struct RefundTransaction {
    amount: Option<i64>,
    reason: Option<String>,
}

impl RefundTransaction {
    /// Refunds everything left of the charge.
    pub fn full() -> Self {
        Self {
            amount: None,
            reason: None,
        }
    }

    /// Refunds `amount` minor units of the charge.
    pub fn partial(amount: i64) -> Self {
        Self {
            amount: Some(amount),
            reason: None,
        }
    }

    /// Why, passed on to the source; at most 500 characters.
    pub fn reason(mut self, reason: impl Into<String>) -> Self {
        self.reason = Some(reason.into());
        self
    }
}

/// A payment for [`PaymentSourceApi::charge`]. Amounts are integers in minor
/// units (cents).
///
/// Without [`Charge::subscription_id`] it completes a one-time purchase; with
/// it, it pays for the period from [`Charge::period`] of a subscription.
#[derive(Clone, Debug)]
pub struct Charge {
    distinct_id: Option<String>,
    customer: Option<String>,
    product_key: String,
    amount: i64,
    currency: String,
    fee: Option<i64>,
    tax: Option<i64>,
    occurred_at: DateTime<Utc>,
    subscription_id: Option<String>,
    period_start: Option<DateTime<Utc>>,
    period_end: Option<DateTime<Utc>>,
    environment: Option<Environment>,
}

impl Charge {
    /// A charge by the person with `distinct_id` for the product `product_key`.
    pub fn new(
        distinct_id: impl Into<String>,
        product_key: impl Into<String>,
        amount: i64,
        currency: impl Into<String>,
        occurred_at: DateTime<Utc>,
    ) -> Self {
        Self {
            distinct_id: Some(distinct_id.into()),
            customer: None,
            product_key: product_key.into(),
            amount,
            currency: currency.into(),
            fee: None,
            tax: None,
            occurred_at,
            subscription_id: None,
            period_start: None,
            period_end: None,
            environment: None,
        }
    }

    /// A charge by a customer known only by the source's customer id.
    pub fn for_customer(
        customer_id: impl Into<String>,
        product_key: impl Into<String>,
        amount: i64,
        currency: impl Into<String>,
        occurred_at: DateTime<Utc>,
    ) -> Self {
        Self {
            distinct_id: None,
            customer: Some(customer_id.into()),
            ..Self::new("", product_key, amount, currency, occurred_at)
        }
    }

    /// Also names the source's customer id, linking it to the person.
    pub fn customer(mut self, customer_id: impl Into<String>) -> Self {
        self.customer = Some(customer_id.into());
        self
    }

    /// The source's commission, in minor units.
    pub fn fee(mut self, fee: i64) -> Self {
        self.fee = Some(fee);
        self
    }

    /// The tax included in the amount, in minor units.
    pub fn tax(mut self, tax: i64) -> Self {
        self.tax = Some(tax);
        self
    }

    /// The source's id of the subscription this charge pays for.
    pub fn subscription_id(mut self, subscription_id: impl Into<String>) -> Self {
        self.subscription_id = Some(subscription_id.into());
        self
    }

    /// The subscription period this charge pays for.
    pub fn period(mut self, start: DateTime<Utc>, end: DateTime<Utc>) -> Self {
        self.period_start = Some(start);
        self.period_end = Some(end);
        self
    }

    /// Marks the charge as a test payment, or explicitly as a real one.
    pub fn environment(mut self, environment: Environment) -> Self {
        self.environment = Some(environment);
        self
    }
}

/// A refund for [`PaymentSourceApi::refund`]. It takes the refunded charge's
/// person, product and environment; its currency must be the charge's.
#[derive(Clone, Debug)]
pub struct Refund {
    refunds_transaction_id: String,
    distinct_id: Option<String>,
    customer: Option<String>,
    product_key: Option<String>,
    amount: i64,
    currency: String,
    fee: Option<i64>,
    tax: Option<i64>,
    occurred_at: DateTime<Utc>,
    environment: Option<Environment>,
}

impl Refund {
    /// A refund of `amount` minor units of the charge `refunds_transaction_id`.
    /// Refunding everything left of the charge ends the access it granted.
    pub fn new(
        refunds_transaction_id: impl Into<String>,
        amount: i64,
        currency: impl Into<String>,
        occurred_at: DateTime<Utc>,
    ) -> Self {
        Self {
            refunds_transaction_id: refunds_transaction_id.into(),
            distinct_id: None,
            customer: None,
            product_key: None,
            amount,
            currency: currency.into(),
            fee: None,
            tax: None,
            occurred_at,
            environment: None,
        }
    }

    /// Repeats the charge's person; it must match.
    pub fn distinct_id(mut self, distinct_id: impl Into<String>) -> Self {
        self.distinct_id = Some(distinct_id.into());
        self
    }

    /// Repeats the charge's customer id; it must match.
    pub fn customer(mut self, customer_id: impl Into<String>) -> Self {
        self.customer = Some(customer_id.into());
        self
    }

    /// Repeats the charge's product key; it must match.
    pub fn product_key(mut self, product_key: impl Into<String>) -> Self {
        self.product_key = Some(product_key.into());
        self
    }

    /// The commission the source returns, in minor units.
    pub fn fee(mut self, fee: i64) -> Self {
        self.fee = Some(fee);
        self
    }

    /// The tax included in the amount, in minor units.
    pub fn tax(mut self, tax: i64) -> Self {
        self.tax = Some(tax);
        self
    }

    /// Sets the environment explicitly; it defaults to the charge's.
    pub fn environment(mut self, environment: Environment) -> Self {
        self.environment = Some(environment);
        self
    }
}

/// A subscription's latest state for [`PaymentSourceApi::subscription`]. It
/// carries no money: revenue comes from charges.
#[derive(Clone, Debug)]
pub struct SubscriptionState {
    distinct_id: Option<String>,
    customer: Option<String>,
    product_key: String,
    status: SubscriptionStatus,
    current_period_start: DateTime<Utc>,
    current_period_end: DateTime<Utc>,
    is_auto_renewing: bool,
    canceled_at: Option<DateTime<Utc>>,
    updated_at: DateTime<Utc>,
    environment: Option<Environment>,
}

impl SubscriptionState {
    /// The state of a subscription held by the person with `distinct_id`.
    /// `updated_at` orders updates: an older state never replaces a newer one.
    pub fn new(
        distinct_id: impl Into<String>,
        product_key: impl Into<String>,
        status: SubscriptionStatus,
        current_period_start: DateTime<Utc>,
        current_period_end: DateTime<Utc>,
        is_auto_renewing: bool,
        updated_at: DateTime<Utc>,
    ) -> Self {
        Self {
            distinct_id: Some(distinct_id.into()),
            customer: None,
            product_key: product_key.into(),
            status,
            current_period_start,
            current_period_end,
            is_auto_renewing,
            canceled_at: None,
            updated_at,
            environment: None,
        }
    }

    /// The state of a subscription held by a customer known only by the
    /// source's customer id.
    pub fn for_customer(
        customer_id: impl Into<String>,
        product_key: impl Into<String>,
        status: SubscriptionStatus,
        current_period_start: DateTime<Utc>,
        current_period_end: DateTime<Utc>,
        is_auto_renewing: bool,
        updated_at: DateTime<Utc>,
    ) -> Self {
        Self {
            distinct_id: None,
            customer: Some(customer_id.into()),
            ..Self::new(
                "",
                product_key,
                status,
                current_period_start,
                current_period_end,
                is_auto_renewing,
                updated_at,
            )
        }
    }

    /// Also names the source's customer id, linking it to the person.
    pub fn customer(mut self, customer_id: impl Into<String>) -> Self {
        self.customer = Some(customer_id.into());
        self
    }

    /// When a `canceled` subscription's access ended. Without it, access
    /// ends at `updated_at`.
    pub fn canceled_at(mut self, canceled_at: DateTime<Utc>) -> Self {
        self.canceled_at = Some(canceled_at);
        self
    }

    /// Marks the subscription as a test, or explicitly as a real one.
    pub fn environment(mut self, environment: Environment) -> Self {
        self.environment = Some(environment);
        self
    }
}

fn customer(external_id: String) -> types::PaymentSourceCustomer {
    types::PaymentSourceCustomer { external_id }
}

fn environment(environment: Environment) -> types::PaymentSourceEnvironment {
    match environment {
        Environment::Production => types::PaymentSourceEnvironment::Production,
        Environment::Test => types::PaymentSourceEnvironment::Test,
    }
}

fn iso8601(at: DateTime<Utc>) -> String {
    at.to_rfc3339_opts(SecondsFormat::Millis, true)
}
