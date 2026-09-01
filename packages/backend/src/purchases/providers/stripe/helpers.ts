import * as Schema from "effect/Schema";
/**
 * Pure data-shape helpers for the Stripe payment-provider engine. None touch
 * the DB or the Stripe API — they operate on already-decoded event objects.
 * Tests live alongside as `helpers.test.ts` and run without a runtime.
 */
import { type ProviderEnvironmentValue, ProviderEnvironment } from "@voidhash/db";
import { ANONYMOUS_USER_ID_PREFIX } from "@voidhash/lib";
import { pick } from "@voidhash/lib/lang";
import * as Effect from "effect/Effect";

import { StripePurchaseProcessingIdempotencyKeyDerivationError } from "./errors.ts";
import type {
  StripeCharge,
  StripeCheckoutSession,
  StripeInvoice,
  StripeSubscription,
} from "./events.ts";
import * as P from "effect/Predicate";
import * as Arr from "effect/Array";

/** Metadata key (on a checkout session / subscription / invoice) carrying the voidhash distinctId. */
export const STRIPE_DISTINCT_ID_METADATA_KEY = "voidhash_distinct_id";

/** `person_external_identifier.serviceId` value used for Stripe customer bindings. */
export const STRIPE_EXTERNAL_IDENTIFIER_SERVICE_ID = "stripe";

/**
 * Per-event idempotency-key event-types. Mirror the `providerEventType` strings
 * the Stripe `record*` methods pass into `PurchaseProcessingService`.
 */
export type StripePurchaseProcessingEventType =
  | "purchase"
  | "renewal"
  | "expired"
  | "canceled"
  | "billing_retry"
  | "renewal_pref_change"
  | "auto_renew_resumed"
  | "refund"
  | "partial_refund"
  | "refund_reversed";

/**
 * Derives the per-event idempotency key used by `PurchaseProcessingService` to
 * dedupe the same logical Stripe event across redelivery and replay.
 *
 * Key shape: `stripe:${anchorId}:${eventType}[:${extra}…]`. The `anchorId` must
 * be stable across redelivery (a Stripe object id — `in_…`, `sub_…`,
 * `pi_…`/`ch_…`, `re_…`/`dp_…`), NEVER the per-delivery `event.id` (`evt_…`,
 * that is the wire-dedup key). Fails loudly when the anchor is absent — always
 * an upstream bug, never silently degraded.
 */
export const getStripeIdempotencyKey = (input: {
  readonly eventType: StripePurchaseProcessingEventType;
  readonly anchorId: string | typeof Schema.Null.Type | typeof Schema.Undefined.Type;
  readonly anchorField: string;
  readonly extra?: ReadonlyArray<string | number>;
}): Effect.Effect<string, StripePurchaseProcessingIdempotencyKeyDerivationError> => {
  if (!input.anchorId) {
    return Effect.fail(
      new StripePurchaseProcessingIdempotencyKeyDerivationError({
        eventType: input.eventType,
        missingField: input.anchorField,
      }),
    );
  }
  const suffix = (input.extra ?? []).map((part) => `:${part}`).join("");
  return Effect.succeed(`stripe:${input.anchorId}:${input.eventType}${suffix}`);
};

/** Maps Stripe's `livemode` boolean to the provider-environment enum value. */
export const stripeProviderEnvironment = (
  livemode: boolean | typeof Schema.Undefined.Type,
): ProviderEnvironmentValue =>
  pick(livemode === false, ProviderEnvironment.Sandbox, ProviderEnvironment.Production);

const metadataDistinctId = (
  metadata: Readonly<Record<string, string>> | typeof Schema.Null.Type | typeof Schema.Undefined.Type,
): string | typeof Schema.Undefined.Type => metadata?.[STRIPE_DISTINCT_ID_METADATA_KEY];

/**
 * Extracts the voidhash distinctId stamped at checkout, if any. Checks
 * `client_reference_id` and `metadata.voidhash_distinct_id` on a checkout
 * session, and `metadata` / `subscription_details.metadata` elsewhere. Returns
 * `undefined` when the integration did not stamp one (then the engine falls
 * back to the Stripe customer id).
 */
export const extractStripeDistinctId = (object: {
  readonly client_reference_id?: string | typeof Schema.Null.Type;
  readonly metadata?: Readonly<Record<string, string>> | typeof Schema.Null.Type;
  readonly subscription_details?: {
    readonly metadata?: Readonly<Record<string, string>> | typeof Schema.Null.Type;
  } | typeof Schema.Null.Type;
}): string | typeof Schema.Undefined.Type =>
  object.client_reference_id ??
  metadataDistinctId(object.metadata) ??
  metadataDistinctId(object.subscription_details?.metadata);

/**
 * Builds the deterministic distinctId for the synthetic anonymous "stand-in"
 * person a Stripe webhook creates when an event arrives for a customer we have
 * never seen and no distinctId was stamped. Keyed by `(environment, customer)`
 * so each Stripe customer gets exactly one stand-in. The person row is marked
 * `PersonOrigin.Stripe`.
 */
export const buildStripeWebhookAnonymousDistinctId = (input: {
  readonly providerEnvironment: ProviderEnvironmentValue;
  readonly customerId: string;
}): string => {
  const environmentLabel = pick(
    input.providerEnvironment === ProviderEnvironment.Sandbox,
    "sandbox",
    "production",
  );
  return `${ANONYMOUS_USER_ID_PREFIX}provider:stripe:${environmentLabel}:${input.customerId}`;
};

/** First non-empty Stripe price id + product id from an invoice's primary line. */
export const invoicePrimaryPriceProduct = (
  invoice: typeof StripeInvoice.Type,
): { readonly priceId?: string; readonly productId?: string } | typeof Schema.Undefined.Type => {
  const line = invoice.lines?.data?.find((entry) => entry.price?.id);
  if (!line?.price) return undefined;
  return { priceId: line.price.id, productId: line.price.product ?? undefined };
};

/** First non-empty Stripe price id + product id from a subscription's primary item. */
export const subscriptionPrimaryPriceProduct = (
  subscription: typeof StripeSubscription.Type,
): { readonly priceId?: string; readonly productId?: string } | typeof Schema.Undefined.Type => {
  const item = subscription.items?.data?.find((entry) => entry.price?.id);
  if (!item?.price) return undefined;
  return { priceId: item.price.id, productId: item.price.product ?? undefined };
};

/** Builds the `"${product}:${price}"` provider product key matching `stripe/config-provider.ts`. */
export const stripeProviderProductKey = (input: {
  readonly priceId?: string;
  readonly productId?: string;
}): string | typeof Schema.Undefined.Type => {
  if (input.productId && input.priceId) return `${input.productId}:${input.priceId}`;
  return undefined;
};

/**
 * Canonical per-charge transaction id, stable between the paying event and the
 * later refund/reversal event so the transaction row dedups and refund money is
 * reconstructed from it. Prefers the `payment_intent` (present on invoices,
 * charges, and checkout sessions), falling back to the charge id.
 */
export const resolveChargeKey = (object: {
  readonly payment_intent?: string | typeof Schema.Null.Type;
  readonly charge?: string | typeof Schema.Null.Type;
  readonly id?: string;
}): string | typeof Schema.Undefined.Type => object.payment_intent ?? object.charge ?? object.id ?? undefined;

/** Total tax (minor units) from an invoice — legacy `tax` or summed `total_taxes`. */
export const invoiceTaxMinor = (invoice: typeof StripeInvoice.Type): number => {
  if (P.isNumber(invoice.tax)) return invoice.tax;
  const taxes = invoice.total_taxes;
  if (taxes && Arr.isReadonlyArrayNonEmpty(taxes)) {
    return taxes.reduce((sum, entry) => sum + (entry.amount ?? 0), 0);
  }
  return 0;
};

/** Whether a checkout session represents a completed one-time (non-subscription) payment. */
export const isPaidOneTimeCheckout = (session: typeof StripeCheckoutSession.Type): boolean =>
  session.mode === "payment" && session.payment_status === "paid";

/** Storefront ISO-3166 alpha-2 country from a charge's billing details, if present. */
export const chargeStorefront = (charge: typeof StripeCharge.Type): string | typeof Schema.Undefined.Type =>
  charge.billing_details?.address?.country ?? undefined;
