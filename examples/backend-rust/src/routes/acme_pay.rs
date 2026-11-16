//! `POST /webhooks/acme-pay` — Acme Pay reports a subscription payment, and
//! Nimbus pushes it to Voidhash as a charge and the subscription's new state.

use axum::extract::rejection::JsonRejection;
use axum::extract::State;
use axum::Json;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use voidhash::generated::types::{PaymentSourceSubscription, PaymentSourceTransaction};
use voidhash::payment_sources::{Charge, SubscriptionState, SubscriptionStatus};

use crate::error::ApiError;
use crate::state::SharedState;

/// Acme Pay's `subscription.paid` event, in Acme Pay's own shape. A real
/// provider signs its webhooks: verify them as its documentation says before
/// trusting the body.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubscriptionPaid {
    transaction_id: String,
    subscription_id: String,
    /// The buyer's Voidhash distinct id. Your server stores it in the
    /// checkout's metadata when it creates the checkout at Acme Pay, and Acme
    /// Pay echoes it here.
    distinct_id: String,
    customer_id: String,
    product_key: String,
    amount: i64,
    currency: String,
    fee: Option<i64>,
    paid_at: DateTime<Utc>,
    period_start: DateTime<Utc>,
    period_end: DateTime<Utc>,
}

#[derive(Serialize)]
pub struct Recorded {
    transaction: PaymentSourceTransaction,
    subscription: PaymentSourceSubscription,
}

/// `POST /webhooks/acme-pay`
///
/// Both pushes are keyed by Acme Pay's own ids, so when Acme Pay retries a
/// delivery the same records are sent again and nothing is counted twice.
/// Any failure answers an error, which makes Acme Pay retry.
pub async fn subscription_paid(
    State(state): State<SharedState>,
    body: Result<Json<SubscriptionPaid>, JsonRejection>,
) -> Result<Json<Recorded>, ApiError> {
    let Json(event) = body?;
    let payment_provider_id = state
        .acme_pay_payment_provider_id
        .as_deref()
        .ok_or_else(ApiError::acme_pay_not_configured)?;
    let acme = state.voidhash.payment_source(payment_provider_id);

    let mut charge = Charge::new(
        &event.distinct_id,
        &event.product_key,
        event.amount,
        &event.currency,
        event.paid_at,
    )
    .customer(&event.customer_id)
    .subscription_id(&event.subscription_id)
    .period(event.period_start, event.period_end);
    if let Some(fee) = event.fee {
        charge = charge.fee(fee);
    }
    let transaction = acme.charge(&event.transaction_id, charge).await?;

    // The charge pays for the period; the state says the subscription is
    // active through it and renews. It carries no money of its own.
    let subscription = acme
        .subscription(
            &event.subscription_id,
            SubscriptionState::new(
                &event.distinct_id,
                &event.product_key,
                SubscriptionStatus::Active,
                event.period_start,
                event.period_end,
                true,
                event.paid_at,
            )
            .customer(&event.customer_id),
        )
        .await?;

    Ok(Json(Recorded {
        transaction,
        subscription,
    }))
}
