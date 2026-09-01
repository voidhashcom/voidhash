/**
 * Pure data-shape helpers used by App Store payment-provider services. None of these
 * touch the database or the Apple SDK directly — they operate on already-
 * fetched rows and decoded transactions. Tests live alongside this file as
 * `helpers.test.ts` and run without a runtime.
 */

import {
  InAppOwnershipType,
  type JWSRenewalInfoDecodedPayload,
  type JWSTransactionDecodedPayload,
  RevocationType,
} from "@voidhash/app-store-server-sdk";
import {
  type PaymentProviderConfiguration as DbPaymentProviderConfiguration,
  type ProviderEnvironmentValue,
  ProviderEnvironment,
} from "@voidhash/db";
import { ANONYMOUS_USER_ID_PREFIX } from "@voidhash/lib";
import { parseISO4217CurrencyCode } from "@voidhash/lib/constants";
import { pick } from "@voidhash/lib/lang";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { PurchaseProcessingResult } from "@voidhash/core-v2";
import {
  AppStorePaymentProviderNotEnabledForFollowingBundleIdError,
  AppStorePurchaseProcessingIdempotencyKeyDerivationError,
} from "./errors.ts";
import * as Match from "effect/Match";

/**
 * Picks the (single) enabled App Store payment provider configuration for the
 * given bundle id from a project's configurations. Fails with
 * `AppStorePaymentProviderNotEnabledForFollowingBundleIdError` when no enabled configuration
 * matches — that's not a database error, the rows simply don't grant access
 * to this bundle.
 */
export const getActiveAppStorePaymentProviderConfiguration = (
  configurations: ReadonlyArray<DbPaymentProviderConfiguration>,
  bundleId: string,
  paymentProviderKey: string,
) =>
  Effect.gen(function* () {
    const configuration = configurations.find(
      (paymentProviderConfiguration) =>
        paymentProviderConfiguration.paymentProviderKey === paymentProviderKey &&
        paymentProviderConfiguration.enabled,
    );

    if (!configuration) {
      return yield* Effect.fail(
        new AppStorePaymentProviderNotEnabledForFollowingBundleIdError({
          bundleId,
        }),
      );
    }

    return configuration;
  });

/** Parses an optional App Store currency code without requiring it to exist. */
export const parseAppStoreCurrency = (currency: Option.Option<string>) =>
  Option.match(currency, {
    onNone: () => Effect.succeedNone,
    onSome: (value) => parseISO4217CurrencyCode(value).pipe(Effect.map(Option.some)),
  });

/**
 * Apple's per-charge `transactionId` (paymentId) — stable across sources for a
 * single payment, renewal, or refund event. Falls back to the StoreKit-observed
 * id only when the decoded JWS lacks one (defensive — Apple always sets
 * `transactionId` on a valid signed transaction).
 */
export const getAppStoreProviderTransactionId = (input: {
  readonly decodedTransaction: JWSTransactionDecodedPayload;
  readonly sdkTransactionId?: string;
}): Option.Option<string> =>
  Option.firstSomeOf([
    input.decodedTransaction.transactionId,
    Option.fromNullishOr(input.sdkTransactionId),
  ]);

/**
 * Apple's `originalTransactionId` (subscriptionId) — stable across every
 * renewal and refund within a subscription series. Absent for non-subscription
 * charges.
 */
export const getAppStoreProviderSubscriptionId = (
  decodedTransaction: JWSTransactionDecodedPayload,
): Option.Option<string> => decodedTransaction.originalTransactionId;

/**
 * Picks the provider identifier used to resolve or create App Store people.
 * Falls through `appAccountToken → originalTransactionId → transactionId`. The
 * `originalTransactionId` / `transactionId` branches exist for the parallel-
 * RevenueCat migration story (those purchases lack our SDK-set
 * `appAccountToken`). Returns `None` when none are present — caller decides
 * how to surface the degenerate case.
 */
export const getAppStorePersonIdentifier = (
  decodedTransaction: JWSTransactionDecodedPayload,
): Option.Option<string> =>
  decodedTransaction.appAccountToken.pipe(
    Option.orElse(() => decodedTransaction.originalTransactionId),
    Option.orElse(() => decodedTransaction.transactionId),
  );

/**
 * Builds the deterministic distinctId for the synthetic anonymous "stand-in"
 * person an App Store webhook creates when a notification arrives before the
 * SDK has confirmed the transaction. Keyed by `(environment, personIdentifier)`
 * so each transaction series gets exactly one stand-in.
 *
 * The stand-in is additionally marked with `PersonOrigin.AppStoreWebhook` on
 * its person row — that origin, not this distinctId, is the signal the SDK
 * identity-rebind path uses to decide merge-vs-transfer.
 */
export const buildAppStoreWebhookAnonymousDistinctId = (input: {
  readonly providerEnvironment: ProviderEnvironmentValue;
  readonly personIdentifier: string;
}): string => {
  const environmentLabel = pick(
    input.providerEnvironment === ProviderEnvironment.Sandbox,
    "sandbox",
    "production",
  );
  return `${ANONYMOUS_USER_ID_PREFIX}provider:apple-app-store:${environmentLabel}:${input.personIdentifier}`;
};

/** Whether a `revocationDate`-bearing transaction is a refund or a Family Sharing revoke. */
export type AppStoreRevocationKind = "refund" | "family_revoke";

/**
 * Classifies a revoked App Store transaction as a refund vs. a Family Sharing
 * revoke. The two look identical on the surface (`revocationDate` is set on
 * both), but they have opposite revenue semantics: refunds reduce revenue,
 * Family Sharing revokes don't move money.
 *
 * `revocationType` is Apple's authoritative signal. When it's absent (older
 * history pre-dating the field), fall back to `inAppOwnershipType`: refunds
 * are issued against the purchaser's `PURCHASED` transaction, never against
 * the `FAMILY_SHARED` mirror.
 *
 * Callers must have already checked that `revocationDate` is present.
 */
export const classifyAppStoreRevocation = (
  decoded: JWSTransactionDecodedPayload,
): AppStoreRevocationKind => {
  const revocationType = Option.getOrUndefined(decoded.revocationType);
  if (revocationType === RevocationType.FAMILY_REVOKE) return "family_revoke";
  if (
    revocationType === RevocationType.REFUND_FULL ||
    revocationType === RevocationType.REFUND_PRORATED
  ) {
    return "refund";
  }
  if (Option.getOrUndefined(decoded.inAppOwnershipType) === InAppOwnershipType.FAMILY_SHARED) {
    return "family_revoke";
  }
  return "refund";
};

/** Creates an idempotent no-op result for Apple-valid payloads we cannot map. */
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
 * Per-event idempotency-key event-types. Mirrors the `providerEventType`
 * strings the App Store `record*` methods pass into PurchaseProcessingService.
 */
export type AppStorePurchaseProcessingEventType =
  | "purchase"
  | "renewal"
  | "expired"
  | "canceled"
  | "refund"
  | "refund_reversed"
  | "revoke"
  | "billing_retry"
  | "extended"
  | "renewal_pref_change"
  | "offer_redeemed"
  | "price_increase"
  | "auto_renew_resumed";

const REFUND_FULL_PERCENTAGE_MILLIUNITS = 100_000;

/**
 * Derives the per-event idempotency key used by PurchaseProcessingService to
 * dedupe duplicate inbound deliveries of the same logical Apple event
 * (webhook + SDK + reconciliation). Fails hard when the JWS lacks the inputs
 * we'd need for a stable key — this is always an upstream bug, never a normal
 * runtime state, so we propagate it instead of silently degrading.
 *
 * Key shape: `apple:${anchorId}:${eventType}:${anchorDateMs}[:${extra}]`
 *
 * Per-event anchor (id + date), chosen to be:
 * - stable across `webhook | sdk | reconciliation` (rules out `signedDate`
 *   which Apple re-stamps per re-fetch, and `notificationUUID` which only
 *   exists on the webhook path),
 * - unique per logical event (refunds add `revocationPercentage` so two
 *   partial refunds against the same `transactionId` stay distinct).
 *
 * | eventType        | anchor id              | anchor date         | extra                  |
 * | ---------------- | ---------------------- | ------------------- | ---------------------- |
 * | purchase         | transactionId          | purchaseDate        | —                      |
 * | renewal          | transactionId          | purchaseDate        | —                      |
 * | expired          | originalTransactionId  | expiresDate         | —                      |
 * | canceled         | originalTransactionId  | expiresDate         | —                      |
 * | refund           | transactionId          | revocationDate      | revocationPercentage   |
 * | revoke           | transactionId          | revocationDate      | —                      |
 * | refund_reversed  | transactionId          | purchaseDate        | —                      |
 * | billing_retry    | originalTransactionId  | expiresDate         | —                      |
 * | extended         | originalTransactionId  | expiresDate         | —                      |
 * | renewal_pref_change | originalTransactionId | renewalDate/expiresDate | productId          |
 * | offer_redeemed   | transactionId          | purchaseDate        | offerIdentifier        |
 * | price_increase   | originalTransactionId  | renewalDate/expiresDate | price + currency    |
 * | auto_renew_resumed | originalTransactionId | renewalDate/expiresDate | —                  |
 */
export const getAppStorePurchaseProcessingIdempotencyKey = (input: {
  readonly decodedTransaction: JWSTransactionDecodedPayload;
  readonly decodedRenewalInfo?: Option.Option<JWSRenewalInfoDecodedPayload>;
  readonly eventType: AppStorePurchaseProcessingEventType;
  readonly sdkTransactionId?: string;
}): Effect.Effect<string, AppStorePurchaseProcessingIdempotencyKeyDerivationError> =>
  Effect.gen(function* () {
    const transaction = input.decodedTransaction;
    const renewalInfo = Option.getOrUndefined(
      input.decodedRenewalInfo ?? Option.none<JWSRenewalInfoDecodedPayload>(),
    );
    const transactionIdOp = getAppStoreProviderTransactionId({
      decodedTransaction: transaction,
      sdkTransactionId: input.sdkTransactionId,
    });
    const originalTransactionIdOp = getAppStoreProviderSubscriptionId(transaction);
    const renewalOrExpiryDate = Option.firstSomeOf([
      renewalInfo?.renewalDate ?? Option.none<number>(),
      transaction.expiresDate,
    ]);

    const fail = (missingField: string) =>
      new AppStorePurchaseProcessingIdempotencyKeyDerivationError({
        eventType: input.eventType,
        missingField,
        providerTransactionId: Option.getOrUndefined(transactionIdOp),
      });

    return yield* Match.value(input.eventType).pipe(
      Match.whenOr("purchase", "renewal", () =>
        Effect.gen(function* () {
if (Option.isNone(transactionIdOp)) return yield* fail("transactionId");
        if (Option.isNone(transaction.purchaseDate)) return yield* fail("purchaseDate");
        return `apple:${transactionIdOp.value}:${input.eventType}:${transaction.purchaseDate.value}`;
        })),
      Match.whenOr("expired", "canceled", () =>
        Effect.gen(function* () {
if (Option.isNone(originalTransactionIdOp)) return yield* fail("originalTransactionId");
        if (Option.isNone(transaction.expiresDate)) return yield* fail("expiresDate");
        return `apple:${originalTransactionIdOp.value}:${input.eventType}:${transaction.expiresDate.value}`;
        })),
      Match.when("refund", () =>
        Effect.gen(function* () {
if (Option.isNone(transactionIdOp)) return yield* fail("transactionId");
        if (Option.isNone(transaction.revocationDate)) return yield* fail("revocationDate");
        const percentage = Option.getOrElse(
          transaction.revocationPercentage,
          () => REFUND_FULL_PERCENTAGE_MILLIUNITS,
        );
        return `apple:${transactionIdOp.value}:refund:${transaction.revocationDate.value}:${percentage}`;
        })),
      Match.when("revoke", () =>
        Effect.gen(function* () {
if (Option.isNone(transactionIdOp)) return yield* fail("transactionId");
        if (Option.isNone(transaction.revocationDate)) return yield* fail("revocationDate");
        return `apple:${transactionIdOp.value}:revoke:${transaction.revocationDate.value}`;
        })),
      Match.when("refund_reversed", () =>
        Effect.gen(function* () {
if (Option.isNone(transactionIdOp)) return yield* fail("transactionId");
        if (Option.isNone(transaction.purchaseDate)) return yield* fail("purchaseDate");
        return `apple:${transactionIdOp.value}:refund_reversed:${transaction.purchaseDate.value}`;
        })),
      Match.when("billing_retry", () =>
        Effect.gen(function* () {
if (Option.isNone(originalTransactionIdOp)) return yield* fail("originalTransactionId");
        if (Option.isNone(transaction.expiresDate)) return yield* fail("expiresDate");
        return `apple:${originalTransactionIdOp.value}:billing_retry:${transaction.expiresDate.value}`;
        })),
      Match.when("extended", () =>
        Effect.gen(function* () {
if (Option.isNone(originalTransactionIdOp)) return yield* fail("originalTransactionId");
        if (Option.isNone(transaction.expiresDate)) return yield* fail("expiresDate");
        return `apple:${originalTransactionIdOp.value}:extended:${transaction.expiresDate.value}`;
        })),
      Match.when("renewal_pref_change", () =>
        Effect.gen(function* () {
if (Option.isNone(originalTransactionIdOp)) return yield* fail("originalTransactionId");
        if (Option.isNone(renewalOrExpiryDate)) return yield* fail("renewalDate");
        const productId = Option.firstSomeOf([
          renewalInfo?.autoRenewProductId ?? Option.none<string>(),
          transaction.productId,
        ]);
        if (Option.isNone(productId)) return yield* fail("productId");
        return `apple:${originalTransactionIdOp.value}:renewal_pref_change:${renewalOrExpiryDate.value}:${productId.value}`;
        })),
      Match.when("offer_redeemed", () =>
        Effect.gen(function* () {
if (Option.isNone(transactionIdOp)) return yield* fail("transactionId");
        if (Option.isNone(transaction.purchaseDate)) return yield* fail("purchaseDate");
        const offer = Option.getOrElse(
          Option.firstSomeOf([
            transaction.offerIdentifier,
            renewalInfo?.offerIdentifier ?? Option.none<string>(),
          ]),
          () => "",
        );
        return `apple:${transactionIdOp.value}:offer_redeemed:${transaction.purchaseDate.value}:${offer}`;
        })),
      Match.when("price_increase", () =>
        Effect.gen(function* () {
if (Option.isNone(originalTransactionIdOp)) return yield* fail("originalTransactionId");
        if (Option.isNone(renewalOrExpiryDate)) return yield* fail("renewalDate");
        const price = Option.getOrElse(
          Option.firstSomeOf([
            renewalInfo?.renewalPrice ?? Option.none<number>(),
            transaction.price,
          ]),
          () => 0,
        );
        const currency = Option.getOrElse(
          Option.firstSomeOf([
            renewalInfo?.currency ?? Option.none<string>(),
            transaction.currency,
          ]),
          () => "",
        );
        return `apple:${originalTransactionIdOp.value}:price_increase:${renewalOrExpiryDate.value}:${price}:${currency}`;
        })),
      Match.when("auto_renew_resumed", () =>
        Effect.gen(function* () {
if (Option.isNone(originalTransactionIdOp)) return yield* fail("originalTransactionId");
        if (Option.isNone(renewalOrExpiryDate)) return yield* fail("renewalDate");
        return `apple:${originalTransactionIdOp.value}:auto_renew_resumed:${renewalOrExpiryDate.value}`;
        })),
      Match.exhaustive,
    );
  });
