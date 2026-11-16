//! Acme Pay: a made-up payment provider Voidhash does not integrate, kept in
//! memory, and the provider endpoint Voidhash calls to read and act on it.
//!
//! In your own service each trait implementation calls the provider's API
//! instead of the in-memory [`Ledger`]. Everything else stays: the traits, the
//! errors and how the handler is assembled in [`provider_handler`].

use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};

use chrono::{TimeZone, Utc};
use voidhash::provider::{
    CancelSubscriptionRequest, CancellationSource, CatalogPage, CatalogProduct, CatalogRequest,
    CatalogSource, HistoryKind, HistoryPage, HistoryRequest, HistorySource, ProductKind,
    ProviderError, ProviderHandler, RefundSource, RefundTransactionRequest, Subscription,
    SubscriptionRequest, SubscriptionSource, SubscriptionStatus, Transaction, TransactionType,
};

/// The source's slug, as created in Studio under Payment sources.
pub const SOURCE: &str = "acme";

/// How many records one page of `catalog.list` or `history.list` holds.
const PAGE_SIZE: usize = 100;

/// The provider endpoint for Acme Pay, verifying requests with the source's
/// signing secret.
pub fn provider_handler(acme: AcmePay, signing_secret: String) -> ProviderHandler {
    ProviderHandler::new(SOURCE, signing_secret)
        .catalog(acme.clone())
        .history(acme.clone())
        .subscription(acme.clone())
        .cancellations(acme.clone())
        .refunds(acme)
}

/// A handle on Acme Pay's data. Cloning shares it.
#[derive(Clone)]
pub struct AcmePay {
    ledger: Arc<Mutex<Ledger>>,
}

/// What Acme Pay knows: its products, subscriptions and money movements.
struct Ledger {
    products: Vec<CatalogProduct>,
    subscriptions: BTreeMap<String, Subscription>,
    transactions: Vec<Transaction>,
    next_id: u64,
}

impl Ledger {
    fn next_id(&mut self, prefix: &str) -> String {
        self.next_id += 1;
        format!("{prefix}_{}", self.next_id)
    }
}

impl AcmePay {
    /// Acme Pay with Nimbus's three products and one paying subscriber.
    pub fn seeded() -> Self {
        let period_start = Utc.with_ymd_and_hms(2026, 10, 1, 0, 0, 0).unwrap();
        let period_end = Utc.with_ymd_and_hms(2026, 11, 1, 0, 0, 0).unwrap();
        let subscription = Subscription::new(
            "sub_1",
            "pro-monthly",
            SubscriptionStatus::Active,
            period_start,
            period_end,
            true,
            period_start,
        )
        .distinct_id("pro-user")
        .customer("ctm_1");
        let charge = Transaction::charge("txn_1", "pro-monthly", 999, "EUR", period_start)
            .distinct_id("pro-user")
            .customer("ctm_1")
            .fee(59)
            .subscription("sub_1", period_start, period_end);

        Self {
            ledger: Arc::new(Mutex::new(Ledger {
                products: vec![
                    CatalogProduct::new(
                        "pro-monthly",
                        "Nimbus Pro monthly",
                        ProductKind::Subscription,
                    ),
                    CatalogProduct::new(
                        "pro-annual",
                        "Nimbus Pro annual",
                        ProductKind::Subscription,
                    ),
                    CatalogProduct::new(
                        "pro-lifetime",
                        "Nimbus Pro lifetime",
                        ProductKind::OneTime,
                    ),
                ],
                subscriptions: BTreeMap::from([("sub_1".to_string(), subscription)]),
                transactions: vec![charge],
                next_id: 1,
            })),
        }
    }

    fn ledger(&self) -> std::sync::MutexGuard<'_, Ledger> {
        // A panic while holding the lock leaves plain data behind; keep serving.
        self.ledger
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

impl CatalogSource for AcmePay {
    async fn list_catalog(&self, request: CatalogRequest) -> Result<CatalogPage, ProviderError> {
        let products = self.ledger().products.clone();
        let (items, next_cursor) = page(products, request.cursor)?;
        Ok(CatalogPage::new(items, next_cursor))
    }
}

impl HistorySource for AcmePay {
    async fn list_history(&self, request: HistoryRequest) -> Result<HistoryPage, ProviderError> {
        let ledger = self.ledger();
        // Later records reach Voidhash through the push in
        // `routes::acme_pay`, so the import stops at `before`.
        Ok(match request.kind {
            HistoryKind::Subscriptions => {
                let subscriptions = ledger
                    .subscriptions
                    .values()
                    .filter(|subscription| subscription.current_period_start < request.before)
                    .cloned()
                    .collect();
                let (items, next_cursor) = page(subscriptions, request.cursor)?;
                HistoryPage::Subscriptions { items, next_cursor }
            }
            HistoryKind::Transactions => {
                let transactions = ledger
                    .transactions
                    .iter()
                    .filter(|transaction| transaction.occurred_at < request.before)
                    .cloned()
                    .collect();
                let (items, next_cursor) = page(transactions, request.cursor)?;
                HistoryPage::Transactions { items, next_cursor }
            }
        })
    }
}

impl SubscriptionSource for AcmePay {
    async fn get_subscription(
        &self,
        request: SubscriptionRequest,
    ) -> Result<Option<Subscription>, ProviderError> {
        Ok(self.ledger().subscriptions.get(&request.id).cloned())
    }
}

impl CancellationSource for AcmePay {
    async fn cancel_subscription(
        &self,
        request: CancelSubscriptionRequest,
    ) -> Result<Subscription, ProviderError> {
        let mut ledger = self.ledger();
        let Some(subscription) = ledger.subscriptions.get_mut(&request.id) else {
            return Err(ProviderError::NotFound(format!(
                "Acme Pay has no subscription {}",
                request.id
            )));
        };
        let now = Utc::now();
        subscription.will_renew = false;
        if !request.at_period_end && subscription.status != SubscriptionStatus::Canceled {
            subscription.status = SubscriptionStatus::Canceled;
            subscription.canceled_at = Some(now);
        }
        subscription.updated_at = now;
        Ok(subscription.clone())
    }
}

impl RefundSource for AcmePay {
    async fn refund_transaction(
        &self,
        request: RefundTransactionRequest,
    ) -> Result<Transaction, ProviderError> {
        let mut ledger = self.ledger();
        let Some(charge) = ledger
            .transactions
            .iter()
            .find(|transaction| {
                transaction.id == request.transaction_id
                    && transaction.transaction_type == TransactionType::Charge
            })
            .cloned()
        else {
            return Err(ProviderError::NotFound(format!(
                "Acme Pay has no charge {}",
                request.transaction_id
            )));
        };
        let refunded: u64 = ledger
            .transactions
            .iter()
            .filter(|transaction| transaction.refunds_transaction_id.as_ref() == Some(&charge.id))
            .map(|transaction| transaction.amount)
            .sum();
        let left = charge.amount - refunded;
        let amount = request.amount.unwrap_or(left);
        if amount > left {
            return Err(ProviderError::InvalidRequest(format!(
                "{} has {left} left to refund",
                charge.id
            )));
        }

        let id = ledger.next_id("re");
        let refund = Transaction {
            distinct_id: charge.distinct_id.clone(),
            customer: charge.customer.clone(),
            ..Transaction::refund(id, &charge.id, amount, &charge.currency, Utc::now())
        };
        ledger.transactions.push(refund.clone());
        Ok(refund)
    }
}

/// One page of `items` starting at `cursor`, an offset this service issued.
fn page<T>(
    items: Vec<T>,
    cursor: Option<String>,
) -> Result<(Vec<T>, Option<String>), ProviderError> {
    let start = match cursor {
        None => 0,
        Some(cursor) => cursor
            .parse::<usize>()
            .map_err(|_| ProviderError::InvalidRequest(format!("Unknown cursor {cursor:?}")))?,
    };
    let total = items.len();
    let end = (start + PAGE_SIZE).min(total);
    let next_cursor = (end < total).then(|| end.to_string());
    Ok((
        items.into_iter().skip(start).take(PAGE_SIZE).collect(),
        next_cursor,
    ))
}

#[cfg(test)]
mod tests {
    //! `ProviderHandler::test` sends a correctly signed request through the
    //! handler, so the endpoint is tested exactly as Voidhash calls it.

    use serde_json::json;

    use super::*;

    /// An import started after the seeded records were created.
    fn after_seed() -> chrono::DateTime<Utc> {
        Utc.with_ymd_and_hms(2026, 10, 28, 0, 0, 0).unwrap()
    }

    fn handler() -> ProviderHandler {
        provider_handler(AcmePay::seeded(), "vhps_test".to_string())
    }

    #[tokio::test]
    async fn describes_every_operation() {
        let response = handler().test("describe", json!({})).await;

        assert_eq!(
            response.json()["result"]["operations"],
            json!([
                "catalog.list",
                "describe",
                "history.list",
                "subscription.cancel",
                "subscription.get",
                "transaction.refund",
            ])
        );
    }

    #[tokio::test]
    async fn imports_history_before_the_import_started() {
        let response = handler()
            .test(
                "history.list",
                json!({ "kind": "transactions", "cursor": null, "before": after_seed() }),
            )
            .await;

        assert_eq!(response.status, 200);
        assert_eq!(response.json()["result"]["items"][0]["id"], "txn_1");
    }

    #[tokio::test]
    async fn refunds_what_is_left_and_no_more() {
        let handler = handler();
        let refund = |amount: Option<u64>| {
            handler.test(
                "transaction.refund",
                json!({ "transactionId": "txn_1", "amount": amount, "reason": null }),
            )
        };

        let partial = refund(Some(400)).await;
        assert_eq!(partial.status, 200);
        assert_eq!(partial.json()["result"]["refund"]["amount"], 400);

        let rest = refund(None).await;
        assert_eq!(rest.json()["result"]["refund"]["amount"], 599);

        let too_much = refund(Some(1)).await;
        assert_eq!(too_much.status, 400);
        assert_eq!(too_much.json()["error"]["code"], "invalid_request");
    }

    #[tokio::test]
    async fn cancels_now_or_at_the_period_end() {
        let handler = handler();

        let at_period_end = handler
            .test(
                "subscription.cancel",
                json!({ "id": "sub_1", "atPeriodEnd": true }),
            )
            .await
            .json();
        assert_eq!(at_period_end["result"]["subscription"]["status"], "active");
        assert_eq!(at_period_end["result"]["subscription"]["willRenew"], false);

        let now = handler
            .test(
                "subscription.cancel",
                json!({ "id": "sub_1", "atPeriodEnd": false }),
            )
            .await
            .json();
        assert_eq!(now["result"]["subscription"]["status"], "canceled");

        let unknown = handler
            .test(
                "subscription.cancel",
                json!({ "id": "sub_404", "atPeriodEnd": true }),
            )
            .await;
        assert_eq!(unknown.status, 404);
    }
}
