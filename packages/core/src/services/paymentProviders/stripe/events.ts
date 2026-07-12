/**
 * Lean, permissive `effect/Schema` shapes for the Stripe webhook event envelope
 * and the `data.object` payloads the record engine reads. Only the fields the
 * integration consumes are declared; every non-essential field is `optional` /
 * `NullOr` so decoding tolerates Stripe API-version drift (and excess keys are
 * ignored on decode). The `@distilled.cloud/stripe` SDK ships outbound REST
 * object schemas but no webhook event types, so these are hand-rolled.
 *
 * Fields decode to `T | undefined` (`Schema.optional`) / `T | null`
 * (`Schema.NullOr`) — read with plain nullish checks, NOT `Option`. The engine
 * converts to the `Option`-based domain types at its boundary.
 */
import { Effect, Schema } from "effect";

import { StripePaymentProviderServiceError } from "./errors.ts";

/** Stripe event types this integration acts on. Any other type is ignored (still wire-deduped). */
export const StripeEventType = {
  CheckoutSessionCompleted: "checkout.session.completed",
  ChargeDisputeClosed: "charge.dispute.closed",
  ChargeRefundUpdated: "charge.refund.updated",
  ChargeRefunded: "charge.refunded",
  CustomerSubscriptionDeleted: "customer.subscription.deleted",
  CustomerSubscriptionUpdated: "customer.subscription.updated",
  InvoicePaid: "invoice.paid",
  InvoicePaymentFailed: "invoice.payment_failed",
} as const;

/**
 * Stripe webhook event envelope. `data.object` stays `Unknown` (decoded per
 * type); `data.previous_attributes` carries the pre-change values on `*.updated`
 * events and is read to detect which field actually changed.
 */
export const StripeEventSchema = Schema.Struct({
  id: Schema.String,
  type: Schema.String,
  created: Schema.optional(Schema.Number),
  livemode: Schema.optional(Schema.Boolean),
  data: Schema.Struct({
    object: Schema.Unknown,
    previous_attributes: Schema.optional(Schema.Unknown),
  }),
});
export type StripeEvent = typeof StripeEventSchema.Type;

/**
 * Loose view of `data.previous_attributes` for `customer.subscription.updated`.
 * The presence of `cancel_at_period_end` / `items` keys is the signal that the
 * field changed; values are read defensively.
 */
export const StripeSubscriptionPreviousAttributesSchema = Schema.Struct({
  cancel_at_period_end: Schema.optional(Schema.NullOr(Schema.Boolean)),
  items: Schema.optional(Schema.Unknown),
  plan: Schema.optional(Schema.Unknown),
});
export type StripeSubscriptionPreviousAttributes =
  typeof StripeSubscriptionPreviousAttributesSchema.Type;

const StripePriceRef = Schema.Struct({
  id: Schema.optional(Schema.String),
  product: Schema.optional(Schema.NullOr(Schema.String)),
  type: Schema.optional(Schema.NullOr(Schema.String)),
});

const StripeLinePeriod = Schema.Struct({
  start: Schema.optional(Schema.NullOr(Schema.Number)),
  end: Schema.optional(Schema.NullOr(Schema.Number)),
});

const StripeInvoiceLine = Schema.Struct({
  price: Schema.optional(Schema.NullOr(StripePriceRef)),
  period: Schema.optional(Schema.NullOr(StripeLinePeriod)),
  amount: Schema.optional(Schema.Number),
});

const StripeTotalTax = Schema.Struct({
  amount: Schema.optional(Schema.Number),
});

/**
 * Subset of a Stripe `invoice`. `subscription` / `charge` / `payment_intent`
 * have moved location across Stripe API versions, so they are read defensively
 * here and reconciled by the engine's resolver helpers.
 */
export const StripeInvoiceSchema = Schema.Struct({
  id: Schema.optional(Schema.String),
  currency: Schema.optional(Schema.String),
  amount_paid: Schema.optional(Schema.Number),
  amount_due: Schema.optional(Schema.Number),
  total: Schema.optional(Schema.Number),
  subtotal: Schema.optional(Schema.Number),
  tax: Schema.optional(Schema.NullOr(Schema.Number)),
  total_taxes: Schema.optional(Schema.NullOr(Schema.Array(StripeTotalTax))),
  billing_reason: Schema.optional(Schema.NullOr(Schema.String)),
  subscription: Schema.optional(Schema.NullOr(Schema.String)),
  customer: Schema.optional(Schema.NullOr(Schema.String)),
  charge: Schema.optional(Schema.NullOr(Schema.String)),
  payment_intent: Schema.optional(Schema.NullOr(Schema.String)),
  attempt_count: Schema.optional(Schema.Number),
  created: Schema.optional(Schema.Number),
  lines: Schema.optional(
    Schema.NullOr(Schema.Struct({ data: Schema.optional(Schema.Array(StripeInvoiceLine)) })),
  ),
  metadata: Schema.optional(Schema.NullOr(Schema.Record(Schema.String, Schema.String))),
  subscription_details: Schema.optional(
    Schema.NullOr(
      Schema.Struct({
        metadata: Schema.optional(Schema.NullOr(Schema.Record(Schema.String, Schema.String))),
      }),
    ),
  ),
});
export type StripeInvoice = typeof StripeInvoiceSchema.Type;

const StripeSubscriptionItem = Schema.Struct({
  price: Schema.optional(Schema.NullOr(StripePriceRef)),
  current_period_start: Schema.optional(Schema.NullOr(Schema.Number)),
  current_period_end: Schema.optional(Schema.NullOr(Schema.Number)),
});

/** Subset of a Stripe `subscription`. */
export const StripeSubscriptionSchema = Schema.Struct({
  id: Schema.optional(Schema.String),
  customer: Schema.optional(Schema.NullOr(Schema.String)),
  status: Schema.optional(Schema.NullOr(Schema.String)),
  cancel_at_period_end: Schema.optional(Schema.NullOr(Schema.Boolean)),
  canceled_at: Schema.optional(Schema.NullOr(Schema.Number)),
  ended_at: Schema.optional(Schema.NullOr(Schema.Number)),
  current_period_start: Schema.optional(Schema.NullOr(Schema.Number)),
  current_period_end: Schema.optional(Schema.NullOr(Schema.Number)),
  start_date: Schema.optional(Schema.NullOr(Schema.Number)),
  trial_end: Schema.optional(Schema.NullOr(Schema.Number)),
  latest_invoice: Schema.optional(Schema.NullOr(Schema.String)),
  items: Schema.optional(
    Schema.NullOr(Schema.Struct({ data: Schema.optional(Schema.Array(StripeSubscriptionItem)) })),
  ),
  metadata: Schema.optional(Schema.NullOr(Schema.Record(Schema.String, Schema.String))),
});
export type StripeSubscription = typeof StripeSubscriptionSchema.Type;

const StripeBillingDetails = Schema.Struct({
  address: Schema.optional(
    Schema.NullOr(Schema.Struct({ country: Schema.optional(Schema.NullOr(Schema.String)) })),
  ),
});

/** Subset of a Stripe `charge`. */
export const StripeChargeSchema = Schema.Struct({
  id: Schema.optional(Schema.String),
  amount: Schema.optional(Schema.Number),
  amount_captured: Schema.optional(Schema.Number),
  amount_refunded: Schema.optional(Schema.Number),
  currency: Schema.optional(Schema.String),
  payment_intent: Schema.optional(Schema.NullOr(Schema.String)),
  balance_transaction: Schema.optional(Schema.NullOr(Schema.String)),
  customer: Schema.optional(Schema.NullOr(Schema.String)),
  invoice: Schema.optional(Schema.NullOr(Schema.String)),
  refunded: Schema.optional(Schema.Boolean),
  created: Schema.optional(Schema.Number),
  billing_details: Schema.optional(Schema.NullOr(StripeBillingDetails)),
  metadata: Schema.optional(Schema.NullOr(Schema.Record(Schema.String, Schema.String))),
});
export type StripeCharge = typeof StripeChargeSchema.Type;

/** Subset of a Stripe `checkout.session`. */
export const StripeCheckoutSessionSchema = Schema.Struct({
  id: Schema.optional(Schema.String),
  mode: Schema.optional(Schema.NullOr(Schema.String)),
  payment_status: Schema.optional(Schema.NullOr(Schema.String)),
  payment_intent: Schema.optional(Schema.NullOr(Schema.String)),
  subscription: Schema.optional(Schema.NullOr(Schema.String)),
  customer: Schema.optional(Schema.NullOr(Schema.String)),
  client_reference_id: Schema.optional(Schema.NullOr(Schema.String)),
  amount_total: Schema.optional(Schema.NullOr(Schema.Number)),
  amount_subtotal: Schema.optional(Schema.NullOr(Schema.Number)),
  currency: Schema.optional(Schema.NullOr(Schema.String)),
  created: Schema.optional(Schema.Number),
  total_details: Schema.optional(
    Schema.NullOr(Schema.Struct({ amount_tax: Schema.optional(Schema.NullOr(Schema.Number)) })),
  ),
  metadata: Schema.optional(Schema.NullOr(Schema.Record(Schema.String, Schema.String))),
});
export type StripeCheckoutSession = typeof StripeCheckoutSessionSchema.Type;

/** Subset of a Stripe `refund` (`charge.refund.updated`). */
export const StripeRefundSchema = Schema.Struct({
  id: Schema.optional(Schema.String),
  charge: Schema.optional(Schema.NullOr(Schema.String)),
  payment_intent: Schema.optional(Schema.NullOr(Schema.String)),
  status: Schema.optional(Schema.NullOr(Schema.String)),
  amount: Schema.optional(Schema.Number),
  currency: Schema.optional(Schema.String),
  created: Schema.optional(Schema.Number),
  metadata: Schema.optional(Schema.NullOr(Schema.Record(Schema.String, Schema.String))),
});
export type StripeRefund = typeof StripeRefundSchema.Type;

/** Subset of a Stripe `dispute` (`charge.dispute.closed`). */
export const StripeDisputeSchema = Schema.Struct({
  id: Schema.optional(Schema.String),
  charge: Schema.optional(Schema.NullOr(Schema.String)),
  payment_intent: Schema.optional(Schema.NullOr(Schema.String)),
  status: Schema.optional(Schema.NullOr(Schema.String)),
  amount: Schema.optional(Schema.Number),
  currency: Schema.optional(Schema.String),
  created: Schema.optional(Schema.Number),
  metadata: Schema.optional(Schema.NullOr(Schema.Record(Schema.String, Schema.String))),
});
export type StripeDispute = typeof StripeDisputeSchema.Type;

/** Line-items list returned by `GET /v1/checkout/sessions/{id}/line_items`. */
export const StripeCheckoutLineItemsSchema = Schema.Struct({
  data: Schema.optional(
    Schema.Array(
      Schema.Struct({
        price: Schema.optional(Schema.NullOr(StripePriceRef)),
        amount_total: Schema.optional(Schema.Number),
        amount_subtotal: Schema.optional(Schema.Number),
      }),
    ),
  ),
});
export type StripeCheckoutLineItems = typeof StripeCheckoutLineItemsSchema.Type;

/** Balance-transaction fee shape (from `GET /v1/balance_transactions/{id}`). */
export const StripeBalanceTransactionSchema = Schema.Struct({
  fee: Schema.optional(Schema.Number),
  net: Schema.optional(Schema.Number),
  currency: Schema.optional(Schema.String),
  amount: Schema.optional(Schema.Number),
});
export type StripeBalanceTransaction = typeof StripeBalanceTransactionSchema.Type;

const decodeEvent = Schema.decodeUnknownEffect(StripeEventSchema);

/** Decodes the verified raw JSON into the {@link StripeEvent} envelope. */
export const decodeStripeEvent = (raw: unknown) =>
  decodeEvent(raw).pipe(
    Effect.mapError(
      (error) =>
        new StripePaymentProviderServiceError({ cause: `Stripe event decode failed: ${error}` }),
    ),
  );

/**
 * Decodes `event.data.object` into a typed object schema. Failures collapse to
 * `StripePaymentProviderServiceError` so a malformed payload is a transient
 * service error rather than a leaked schema error.
 */
export const decodeStripeObject =
  <S extends Schema.Top>(schema: S) =>
  (object: unknown) =>
    Schema.decodeUnknownEffect(schema)(object).pipe(
      Effect.mapError(
        (error) =>
          new StripePaymentProviderServiceError({ cause: `Stripe object decode failed: ${error}` }),
      ),
    );
