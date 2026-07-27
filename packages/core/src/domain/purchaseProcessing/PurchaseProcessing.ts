import { Option, Schema } from "effect";

import { CurrencyCode, ExchangeRate, MinorAmount } from "../shared/Money.ts";

/**
 * Source of a purchase event. `sdk` and `webhook` are normal in-band sources;
 * `reconciliation` is the App Store / Google Play replay path that re-ingests
 * historical notifications.
 */
export const PurchaseEventSource = Schema.Literals(["sdk", "webhook", "reconciliation"]);
export type PurchaseEventSource = typeof PurchaseEventSource.Type;

/**
 * Same five amounts as {@link PurchaseProcessingMoney} converted to the
 * unified reporting currency (USD).
 *
 * `exchangeRate` is the rate from the original currency to USD encoded as
 * `rate * 1_000_000` so the integer-only `transaction.exchange_rate` column
 * keeps six decimal places of precision.
 *
 * Absent (`usd: Option.none()` on the parent) when no FX rate was available
 * for the transaction's currency on the transaction date.
 */
export class PurchaseProcessingMoneyUsd extends Schema.Class<PurchaseProcessingMoneyUsd>(
  "PurchaseProcessingMoneyUsd",
)({
  grossAmount: MinorAmount,
  storeCommissionAmount: MinorAmount,
  taxAmount: MinorAmount,
  proceedsAmount: MinorAmount,
  proceedsAfterTaxAmount: MinorAmount,
  exchangeRate: ExchangeRate,
}) {}

/**
 * Normalized money for a purchase event. Carries gross, store commission,
 * tax, and the two derived proceeds amounts in the original transaction
 * currency, plus the same five amounts converted to USD when an FX rate is
 * available.
 *
 * All amounts are non-negative minor units — the analytics mapper applies
 * the sign convention (refunds emit negative deltas) just before writing the
 * event envelope.
 */
export class PurchaseProcessingMoney extends Schema.Class<PurchaseProcessingMoney>(
  "PurchaseProcessingMoney",
)({
  currency: CurrencyCode,
  /** Apple-style ISO 3166 alpha-3 storefront country (e.g., `"USA"`, `"DEU"`). */
  storefront: Schema.Option(Schema.String),
  grossAmount: MinorAmount,
  storeCommissionAmount: MinorAmount,
  taxAmount: MinorAmount,
  proceedsAmount: MinorAmount,
  proceedsAfterTaxAmount: MinorAmount,
  usd: Schema.Option(PurchaseProcessingMoneyUsd),
}) {
  hasUsd(): boolean {
    return Option.isSome(this.usd);
  }
}

/**
 * Result returned by every `PurchaseProcessingService.*` method.
 *
 * `idempotent` reflects operational-row reuse — i.e. the transaction or
 * subscription row already existed when the action arrived (renewal arrived
 * before the initial-buy notification, retry after a transient analytics
 * failure, etc.). It does NOT reflect inbound-event dedup; that gate lives
 * upstream in the payment-provider service and short-circuits before this
 * service runs.
 */
export class PurchaseProcessingResult extends Schema.TaggedClass<PurchaseProcessingResult>()(
  "PurchaseProcessingResult",
  {
    personId: Schema.String,
    purchaseId: Schema.Option(Schema.String),
    subscriptionId: Schema.Option(Schema.String),
    transactionId: Schema.Option(Schema.String),
    changedGrantIds: Schema.Array(Schema.String),
    analyticsEventIds: Schema.Array(Schema.String),
    idempotent: Schema.Boolean,
  },
) {}
