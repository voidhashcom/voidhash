/**
 * Pure data-shape helpers for the Google Play payment-provider services. None
 * touch the database or the Play API — they operate on already-fetched
 * configuration rows and normalized purchases. Tests live alongside as
 * `helpers.test.ts` and run without a runtime.
 */
import type {
  ProductPurchaseV2Type,
  SubscriptionPurchaseV2Type,
} from "@voidhash/google-play-server-sdk";
import {
  type PaymentProviderConfiguration as DbPaymentProviderConfiguration,
  type ProviderEnvironmentValue,
  ProviderEnvironment,
} from "@voidhash/db";
import { ANONYMOUS_USER_ID_PREFIX } from "@voidhash/lib";
import { pick } from "@voidhash/lib/lang";
import { DateTime, Effect, Option } from "effect";

import { PurchaseProcessingResult } from "../../../domain/purchaseProcessing/PurchaseProcessing.ts";
import {
  GooglePlayPaymentProviderNotEnabledForFollowingPackageNameError,
  GooglePlayPurchaseProcessingIdempotencyKeyDerivationError,
} from "./errors.ts";

/** Stable serviceId for the per-provider external-identifier binding (cross-owner transfer / rebind). */
export const GOOGLE_PLAY_SERVICE_ID = "google-play";

/**
 * The platform-neutral normalized view of a Google Play purchase that every
 * `record*` method consumes — the Google analogue of Apple's decoded JWS
 * transaction. The webhook handler / SDK boundary build this from the
 * authoritative `subscriptions.v2.get` / `products.v2.get` response (plus a
 * catalog price lookup); record methods never touch the raw Play schema.
 */
export interface GooglePlayNormalizedPurchase {
  readonly kind: "subscription" | "product";
  readonly productId: string;
  readonly purchaseToken: string;
  /** Per-charge order id (`GPA.xxxx-...`). Stable across deliveries of a single charge. */
  readonly orderId: Option.Option<string>;
  /** The UUIDv5 account token the SDK set as `obfuscatedAccountId`. Server-verified identity. */
  readonly obfuscatedExternalAccountId: Option.Option<string>;
  /** ISO 3166 region code of the buyer (Google uses alpha-2, e.g. `"US"`). */
  readonly storefront: Option.Option<string>;
  /** Resolved billable amount in minor units (cents), from the catalog regional price. */
  readonly priceMinorUnits: Option.Option<number>;
  readonly currency: Option.Option<string>;
  readonly startTime: Option.Option<Date>;
  readonly expiryTime: Option.Option<Date>;
  readonly subscriptionState: Option.Option<string>;
  readonly acknowledgementState: Option.Option<string>;
  readonly autoRenewEnabled: boolean;
  /**
   * Whether the current period is (potentially) a free/introductory offer. We
   * conservatively treat any subscription with an applied `offerId` as
   * non-revenue on its initial purchase (revenue is captured on the first
   * renewal), since `subscriptions.v2.get` doesn't expose the offer phase.
   */
  readonly isTrial: boolean;
  readonly basePlanId: Option.Option<string>;
  readonly offerId: Option.Option<string>;
  readonly linkedPurchaseToken: Option.Option<string>;
}

/** Parses an RFC-3339 timestamp string (Play V2 dates) into an `Option<Date>`. */
const parseRfc3339 = (value: string | undefined): Option.Option<Date> => {
  if (!value) return Option.none();
  return Option.map(DateTime.make(value), DateTime.toDateUtc);
};

/**
 * Picks the (single) enabled Google Play configuration for the given package
 * name. Fails with
 * {@link GooglePlayPaymentProviderNotEnabledForFollowingPackageNameError} when
 * none matches — not a database error, the rows simply don't grant access.
 */
export const getActiveGooglePlayPaymentProviderConfiguration = (
  configurations: ReadonlyArray<DbPaymentProviderConfiguration>,
  packageName: string,
  paymentProviderKey: string,
) =>
  Effect.gen(function* () {
    const configuration = configurations.find(
      (candidate) => candidate.paymentProviderKey === paymentProviderKey && candidate.enabled,
    );
    if (!configuration) {
      return yield* Effect.fail(
        new GooglePlayPaymentProviderNotEnabledForFollowingPackageNameError({ packageName }),
      );
    }
    return configuration;
  });

/**
 * Composes the provider product key matching the config-provider's
 * `createProductKey` (`productId` or `productId:basePlanId`).
 */
export const googlePlayProviderProductKey = (
  productId: string,
  basePlanId: Option.Option<string>,
): string =>
  Option.match(basePlanId, { onNone: () => productId, onSome: (id) => `${productId}:${id}` });

/**
 * Picks the provider identifier used to resolve or create Google Play people.
 * Falls through `obfuscatedExternalAccountId → orderId → purchaseToken`. The
 * latter branches exist for purchases lacking our SDK-set account token (e.g.
 * server-side restores). Returns `None` only when none are present.
 */
export const getGooglePlayPersonIdentifier = (
  purchase: GooglePlayNormalizedPurchase,
): Option.Option<string> =>
  purchase.obfuscatedExternalAccountId.pipe(
    Option.orElse(() => purchase.orderId),
    Option.orElse(() => Option.some(purchase.purchaseToken)),
  );

/**
 * Builds the deterministic distinctId for the synthetic anonymous "stand-in"
 * person an RTDN webhook creates when a notification arrives before the SDK has
 * confirmed the purchase. Keyed by `(environment, personIdentifier)`.
 */
export const buildGooglePlayWebhookAnonymousDistinctId = (input: {
  readonly providerEnvironment: ProviderEnvironmentValue;
  readonly personIdentifier: string;
}): string => {
  const environmentLabel = pick(
    input.providerEnvironment === ProviderEnvironment.Sandbox,
    "sandbox",
    "production",
  );
  return `${ANONYMOUS_USER_ID_PREFIX}provider:google-play:${environmentLabel}:${input.personIdentifier}`;
};

/** Creates an idempotent no-op result for Play-valid payloads we cannot map. */
export const makeIgnoredPurchaseProcessingResult = () =>
  new PurchaseProcessingResult({
    analyticsEventIds: [],
    changedGrantIds: [],
    idempotent: true,
    personId: "",
    purchaseId: Option.none(),
    subscriptionId: Option.none(),
    transactionId: Option.none(),
  });

/**
 * Builds a {@link GooglePlayNormalizedPurchase} from a `subscriptions.v2.get`
 * response. `priceMinorUnits`/`currency` are resolved separately (catalog
 * lookup) and threaded in by the caller.
 */
export const normalizeSubscriptionPurchaseV2 = (input: {
  readonly purchaseToken: string;
  readonly subscriptionId: string;
  readonly data: SubscriptionPurchaseV2Type;
  readonly priceMinorUnits: Option.Option<number>;
  readonly currency: Option.Option<string>;
}): GooglePlayNormalizedPurchase => {
  const lineItem = input.data.lineItems?.[0];
  const offerId = Option.fromNullishOr(lineItem?.offerDetails?.offerId);
  return {
    acknowledgementState: Option.fromNullishOr(input.data.acknowledgementState),
    autoRenewEnabled: lineItem?.autoRenewingPlan?.autoRenewEnabled ?? false,
    basePlanId: Option.fromNullishOr(lineItem?.offerDetails?.basePlanId),
    currency: input.currency,
    expiryTime: parseRfc3339(lineItem?.expiryTime),
    isTrial: Option.isSome(offerId),
    kind: "subscription",
    linkedPurchaseToken: Option.fromNullishOr(input.data.linkedPurchaseToken),
    obfuscatedExternalAccountId: Option.fromNullishOr(
      input.data.externalAccountIdentifiers?.obfuscatedExternalAccountId,
    ),
    offerId,
    orderId: Option.fromNullishOr(input.data.latestOrderId),
    priceMinorUnits: input.priceMinorUnits,
    productId: lineItem?.productId ?? input.subscriptionId,
    purchaseToken: input.purchaseToken,
    startTime: parseRfc3339(input.data.startTime),
    storefront: Option.fromNullishOr(input.data.regionCode),
    subscriptionState: Option.fromNullishOr(input.data.subscriptionState),
  };
};

/**
 * Builds a {@link GooglePlayNormalizedPurchase} from a `products.v2.get`
 * response. One-time products carry no catalog-typed regional price, so
 * `priceMinorUnits`/`currency` are usually `None`.
 */
export const normalizeProductPurchaseV2 = (input: {
  readonly purchaseToken: string;
  readonly sku: string;
  readonly data: ProductPurchaseV2Type;
  readonly priceMinorUnits: Option.Option<number>;
  readonly currency: Option.Option<string>;
}): GooglePlayNormalizedPurchase => {
  const lineItem = input.data.productLineItem?.[0];
  return {
    acknowledgementState: Option.fromNullishOr(input.data.acknowledgementState),
    autoRenewEnabled: false,
    basePlanId: Option.none(),
    currency: input.currency,
    expiryTime: Option.none(),
    isTrial: false,
    kind: "product",
    linkedPurchaseToken: Option.none(),
    obfuscatedExternalAccountId: Option.fromNullishOr(input.data.obfuscatedExternalAccountId),
    offerId: Option.fromNullishOr(lineItem?.offerDetails?.offerId),
    orderId: Option.fromNullishOr(input.data.orderId),
    priceMinorUnits: input.priceMinorUnits,
    productId: lineItem?.productId ?? input.sku,
    purchaseToken: input.purchaseToken,
    startTime: parseRfc3339(input.data.purchaseCompletionTime),
    storefront: Option.fromNullishOr(input.data.regionCode),
    subscriptionState: Option.none(),
  };
};

/**
 * Per-event idempotency-key event-types. Mirrors the `providerEventType`
 * strings the Google Play `record*` methods pass into PurchaseProcessingService.
 */
export type GooglePlayPurchaseProcessingEventType =
  | "purchase"
  | "renewal"
  | "expired"
  | "canceled"
  | "refund"
  | "revoke"
  | "billing_retry"
  | "extended"
  | "price_increase"
  | "auto_renew_resumed"
  | "one_time_purchase";

/**
 * Derives the per-event idempotency key used by PurchaseProcessingService to
 * dedupe duplicate inbound deliveries of the same logical Play event (RTDN +
 * SDK confirm + reconciliation). Fails hard when the purchase lacks the
 * anchors we'd need for a stable key — always an upstream bug, never silently
 * degraded.
 *
 * Key shape: `google:${anchorId}:${eventType}[:${anchorMs}]`
 *
 * - Charge events (`purchase`/`renewal`/`one_time_purchase`/`refund`) anchor on
 *   `orderId` — unique per charge, so no date component is needed.
 * - Subscription-series lifecycle events anchor on `purchaseToken` (stable
 *   across renewals of a series) + the period `expiryTime` to distinguish
 *   successive periods.
 * - `revoke` anchors on `purchaseToken` (entitlement-level, not per-charge).
 */
export const getGooglePlayPurchaseProcessingIdempotencyKey = (input: {
  readonly purchase: GooglePlayNormalizedPurchase;
  readonly eventType: GooglePlayPurchaseProcessingEventType;
}): Effect.Effect<string, GooglePlayPurchaseProcessingIdempotencyKeyDerivationError> =>
  Effect.gen(function* () {
    const { purchase, eventType } = input;
    const fail = (missingField: string) =>
      new GooglePlayPurchaseProcessingIdempotencyKeyDerivationError({
        eventType,
        missingField,
        purchaseToken: purchase.purchaseToken,
      });

    switch (eventType) {
      case "purchase":
      case "renewal":
      case "one_time_purchase":
      case "refund": {
        if (Option.isNone(purchase.orderId)) return yield* fail("orderId");
        return `google:${purchase.orderId.value}:${eventType}`;
      }
      case "revoke": {
        return `google:${purchase.purchaseToken}:revoke`;
      }
      case "expired":
      case "canceled":
      case "billing_retry":
      case "extended":
      case "price_increase":
      case "auto_renew_resumed": {
        if (Option.isNone(purchase.expiryTime)) return yield* fail("expiryTime");
        return `google:${purchase.purchaseToken}:${eventType}:${purchase.expiryTime.value.getTime()}`;
      }
    }
  });
