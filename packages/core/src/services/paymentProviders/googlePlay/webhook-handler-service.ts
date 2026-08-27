/**
 * Google Play RTDN webhook handler. The Google analogue of the App Store
 * webhook handler: decode the Pub/Sub push envelope, re-fetch authoritative
 * purchase state from the Play Developer API (RTDN bodies are pointers), and
 * dispatch to the matching `record*` method. Terminal/business outcomes fold
 * into a success value so Pub/Sub stops retrying; only transient/infra failures
 * use the error channel (mapped to 5xx by the route).
 */
import { type ProviderEnvironmentValue } from "@voidhash/db";
import { generateId } from "../../../utils/index.ts";
import { constant, pick } from "@voidhash/lib/lang";
import { Context, DateTime, Effect, Layer, Match, Option, Predicate, Schema } from "effect";

import type { PurchaseProcessingResult } from "../../../domain/purchaseProcessing/PurchaseProcessing.ts";
import {
  GooglePlayPaymentProviderConfigurationNotFoundError,
  GooglePlayPaymentProviderProductNotMappedError,
  GooglePlayPaymentProviderProjectNotFoundError,
  GooglePlayPaymentProviderServiceError,
} from "./errors.ts";
import {
  type DecodedNotification,
  PubSubMessage,
  categorizeNotification,
  decodeNotificationFromBase64,
} from "./notifications.ts";
import type { GooglePlayNormalizedPurchase } from "./helpers.ts";
import { GooglePlayPaymentProvider } from "./payment-provider.ts";
import { GooglePlayPaymentProviderServiceQueries } from "./payment-provider-service-queries.ts";
import type { GooglePlaySdkContext } from "./sdk-context.ts";
import { GooglePlayPurchaseVerifier } from "./purchase-verifier.ts";

const ParkedGooglePlaySdkPurchase = Schema.Struct({
  distinctId: Schema.String,
  productId: Schema.String,
  purchaseToken: Schema.String,
  receivedAt: Schema.String,
});

const truncateResultNote = (note: string): string => note.slice(0, 500);

/**
 * SDK errors that are terminal for the fetch — retrying won't help, so we ack
 * (with a failed ledger row) instead of looping Pub/Sub. "Not found" means the
 * token is gone/invalid; an invalid-request (400) means a permanently
 * malformed token.
 */
const TERMINAL_FETCH_TAGS = new Set<string>([
  "GooglePlayPurchaseNotFoundError",
  "GooglePlaySubscriptionNotFoundError",
  "GooglePlayProductNotFoundError",
  "GooglePlayInvalidRequestError",
]);

/** Tags that collapse into a terminal record-failure ledger row (ack, don't retry). */
const TERMINAL_RECORD_FAILURE_TAGS = new Set<string>([
  "GooglePlayPaymentProviderTransactionMissingPersonIdentifierError",
  "GooglePlayPurchaseProcessingIdempotencyKeyDerivationError",
  // PurchaseProcessingService's own product-not-mapped guard (distinct from the
  // engine's pre-check); ack rather than loop if it ever fires (e.g. the product
  // mapping is deleted between the engine lookup and the ledger write).
  "PurchaseProcessingProductNotMappedError",
  "InvalidISO4217CurrencyCodeError",
]);

const errorTag = (error: unknown): string | undefined => {
  if (Predicate.hasProperty(error, "_tag") && typeof error._tag === "string") return error._tag;
  return undefined;
};

type AcceptRtdnNotificationResult = {
  readonly accepted: true;
  readonly handled: boolean;
  readonly notificationType: string | undefined;
  readonly notificationUUID: string | undefined;
  readonly subtype: string | undefined;
};

/**
 * Derives a stable wire-dedup key for a Pub/Sub message. Prefers the Pub/Sub
 * `messageId`; falls back to a deterministic composite of the notification's
 * identifying fields when absent. RTDN has no native notification UUID.
 */
const deriveNotificationUuid = (
  messageId: string | undefined,
  decoded: DecodedNotification,
): string => {
  if (messageId) return messageId;
  // Pub/Sub always sends a messageId, so this is a defensive fallback. Fold
  // every distinguishing field (including the voided refundType) into the
  // composite so two distinct events for the same token never collapse to one
  // dedup key (e.g. a refund vs a revoke voided notification).
  const token = notificationPurchaseToken(decoded);
  const subtype = notificationDedupSubtype(decoded);
  return `gp:${decoded.packageName}:${token}:${decoded.eventTimeMillis ?? ""}:${decoded.type}:${subtype}`;
};

/** The purchase token a decoded notification points at (test events carry none). */
const notificationPurchaseToken = (decoded: DecodedNotification): string => {
  if (decoded.type === "test") return "";
  return decoded.purchaseToken;
};

/** The distinguishing sub-discriminator folded into the composite dedup key. */
const notificationDedupSubtype = (decoded: DecodedNotification): string => {
  if (decoded.type === "subscription" || decoded.type === "oneTimeProduct") {
    return String(decoded.notificationType);
  }
  if (decoded.type === "voidedPurchase") return `void:${decoded.refundType ?? ""}`;
  return "";
};

/** The wire-facing event-type label recorded on the ledger row and the span. */
const resolveNotificationType = (decoded: DecodedNotification): string => {
  if (decoded.type === "test") return "TEST";
  if (decoded.type === "voidedPurchase") return `VOIDED:${decoded.refundType ?? 1}`;
  return decoded.notificationTypeName;
};

/**
 * The notification's own event time, falling back to the receive time when the
 * RTDN body omits it or carries an unparseable value.
 */
const resolveEventTime = (eventTimeMillis: string | undefined, receivedAt: Date): Date => {
  if (!eventTimeMillis) return receivedAt;
  const parsed = DateTime.make(Number(eventTimeMillis));
  if (Option.isNone(parsed)) return receivedAt;
  return DateTime.toDateUtc(parsed.value);
};

/**
 * For a voided notification the refund is against the voided order, not the
 * subscription's latest order — override the order id so the refund idempotency
 * key anchors correctly.
 */
const resolveAnchoredPurchase = (
  decoded: DecodedNotification,
  purchase: GooglePlayNormalizedPurchase,
): GooglePlayNormalizedPurchase => {
  if (decoded.type === "voidedPurchase" && decoded.orderId) {
    return { ...purchase, orderId: Option.some(decoded.orderId) };
  }
  return purchase;
};

const GooglePlayPaymentProviderLive = GooglePlayPaymentProvider.layer;

const GooglePlayWebhookHandlerDependenciesLive = Layer.mergeAll(
  GooglePlayPaymentProviderLive,
  GooglePlayPurchaseVerifier.layer.pipe(Layer.provide(GooglePlayPaymentProviderLive)),
);

export class GooglePlayWebhookHandlerService extends Context.Service<GooglePlayWebhookHandlerService>()(
  "GooglePlayWebhookHandlerService",
  {
    make: Effect.gen(function* () {
      const queries = yield* GooglePlayPaymentProviderServiceQueries;
      const googlePlayPaymentProvider = yield* GooglePlayPaymentProvider;
      const purchaseVerifier = yield* GooglePlayPurchaseVerifier;

      const acceptRtdnNotification = Effect.fn("acceptRtdnNotification")(
        function* (input: {
          readonly paymentProviderConfigurationId: string;
          readonly receivedAt: Date;
          readonly pubsubBody: unknown;
          /** Set when re-driving a parked notification through the handler. */
          readonly isReplay?: boolean;
        }) {
          yield* Effect.annotateCurrentSpan(
            "voidhash.payment_provider.configuration_id",
            input.paymentProviderConfigurationId,
          );
          const configuration = yield* queries.findPaymentProviderConfigurationById(
            input.paymentProviderConfigurationId,
          );
          if (!configuration) {
            return yield* new GooglePlayPaymentProviderConfigurationNotFoundError({
              paymentProviderConfigurationId: input.paymentProviderConfigurationId,
            });
          }
          yield* Effect.annotateCurrentSpan(
            "voidhash.payment_provider.id",
            configuration.providerId,
          );

          const project = yield* queries.findProjectById(configuration.projectId);
          if (!project) {
            return yield* new GooglePlayPaymentProviderProjectNotFoundError({
              projectId: configuration.projectId,
            });
          }
          yield* Effect.annotateCurrentSpan("voidhash.project.id", project.id);

          // Decode the Pub/Sub envelope + RTDN body. Parse failures are
          // terminal — ack so Pub/Sub stops redelivering a malformed message.
          const decodeResult = yield* Schema.decodeUnknownEffect(PubSubMessage)(
            input.pubsubBody,
          ).pipe(
            Effect.flatMap((message) =>
              decodeNotificationFromBase64(message.message.data).pipe(
                Effect.flatMap(categorizeNotification),
                Effect.map((decoded) => ({ decoded, messageId: message.message.messageId })),
              ),
            ),
            Effect.match({
              onFailure: (error) => ({ error, ok: constant(false) }),
              onSuccess: (value) => ({ ok: constant(true), value }),
            }),
          );

          if (!decodeResult.ok) {
            yield* Effect.logWarning("Google Play RTDN rejected as undecodable (terminal)", {
              cause: String(decodeResult.error),
              paymentProviderConfigurationId: input.paymentProviderConfigurationId,
            });
            return {
              accepted: true,
              handled: false,
              notificationType: undefined,
              notificationUUID: undefined,
              subtype: undefined,
            } satisfies AcceptRtdnNotificationResult;
          }

          const decoded = decodeResult.value.decoded;
          const notificationUUID = deriveNotificationUuid(decodeResult.value.messageId, decoded);
          const notificationType = resolveNotificationType(decoded);
          const eventTime = resolveEventTime(decoded.eventTimeMillis, input.receivedAt);
          yield* Effect.annotateCurrentSpan(
            "voidhash.payment_provider.event_type",
            notificationType,
          );
          yield* Effect.annotateCurrentSpan("voidhash.webhook.id", notificationUUID);

          const ack = (handled: boolean): AcceptRtdnNotificationResult => ({
            accepted: true,
            handled,
            notificationType,
            notificationUUID,
            subtype: undefined,
          });

          let terminalLedgerResult: "failed" | undefined;
          let terminalLedgerResultNote: string | null = null;

          // Test notifications carry no purchase — ack and record a ledger row.
          if (decoded.type === "test") {
            yield* writeLedgerRow({
              configurationId: input.paymentProviderConfigurationId,
              notificationType,
              notificationUUID,
              result: "ignored",
              resultNote: null,
            });
            return ack(false);
          }

          const sdkContext =
            yield* googlePlayPaymentProvider.buildSdkContextFromConfiguration(configuration);

          // Re-fetch authoritative state for the purchase token. "Not found"
          // fetch errors are terminal (ack so Pub/Sub stops retrying); other
          // SDK errors (rate limit, auth, 5xx) propagate as transient → 5xx.
          const fetched = yield* fetchPurchaseForNotification(sdkContext, decoded).pipe(
            Effect.map(Option.some),
            Effect.catchIf(
              (error) => TERMINAL_FETCH_TAGS.has(errorTag(error) ?? ""),
              (error) =>
                Effect.logWarning("Google Play purchase fetch failed (terminal)", {
                  cause: String(error),
                  purchaseToken: decoded.purchaseToken,
                }).pipe(
                  Effect.as(
                    Option.none<{
                      purchase: GooglePlayNormalizedPurchase;
                      providerEnvironment: ProviderEnvironmentValue;
                    }>(),
                  ),
                ),
            ),
          );

          if (Option.isNone(fetched)) {
            yield* writeLedgerRow({
              configurationId: input.paymentProviderConfigurationId,
              notificationType,
              notificationUUID,
              result: "failed",
              resultNote: "purchase not found for token",
            });
            return ack(false);
          }

          // A voided notification without an orderId cannot be safely anchored:
          // the fetched purchase's latestOrderId may reference a different
          // (later) charge than the one that was refunded. Record a failure and
          // ack rather than refund the wrong order.
          if (decoded.type === "voidedPurchase" && !decoded.orderId) {
            yield* writeLedgerRow({
              configurationId: input.paymentProviderConfigurationId,
              notificationType,
              notificationUUID,
              result: "failed",
              resultNote: "voided notification missing orderId; cannot anchor refund",
            });
            return ack(false);
          }

          // For a voided purchase, the refund is against the voided order, not
          // the subscription's latest order — override the order id so the
          // refund idempotency key anchors correctly.
          const purchase: GooglePlayNormalizedPurchase = resolveAnchoredPurchase(
            decoded,
            fetched.value.purchase,
          );

          const recordInput = {
            configuration,
            eventTime,
            notificationUUID,
            project,
            providerEnvironment: fetched.value.providerEnvironment,
            purchase,
            receivedAt: input.receivedAt,
            source: constant("webhook"),
          };

          const markTerminalRecordFailure = (reason: string) =>
            Effect.gen(function* () {
              terminalLedgerResult = "failed";
              terminalLedgerResultNote = truncateResultNote(reason);
              yield* Effect.logWarning("Google Play notification record failed permanently", {
                notificationType,
                notificationUUID,
                resultNote: terminalLedgerResultNote,
              });
              return ack(false);
            });

          /**
           * Wraps a record call to coerce success into `ack(true)` and intercept
           * product-not-mapped (park the raw payload for replay-on-mapping) and
           * terminal record failures (write a `failed` ledger row). Mirrors the
           * App Store handler's `handled` wrapper.
           */
          const handled = <E, R>(
            recordEffect: Effect.Effect<
              PurchaseProcessingResult,
              E | GooglePlayPaymentProviderProductNotMappedError,
              R
            >,
          ) =>
            recordEffect.pipe(
              Effect.map((result) => ack(!result.isIgnored())),
              Effect.catchIf(
                (error): error is GooglePlayPaymentProviderProductNotMappedError =>
                  errorTag(error) === "GooglePlayPaymentProviderProductNotMappedError",
                (error) =>
                  Effect.gen(function* () {
                    yield* Effect.annotateCurrentSpan(
                      "voidhash.payment_provider.provider_product_key",
                      error.providerProductKey,
                    );
                    // On replay the mapping is still missing — record a failure
                    // instead of re-parking (avoids a self-perpetuating loop).
                    if (input.isReplay) {
                      return ack(false);
                    }
                    yield* Effect.logInfo(
                      "Google Play notification parked: product not yet mapped",
                      {
                        notificationType,
                        notificationUUID,
                        providerProductKey: error.providerProductKey,
                      },
                    );
                    yield* queries.insertNotificationProcessedIfAbsent({
                      id: generateId("paymentProviderNotification"),
                      notificationSubtype: null,
                      notificationType,
                      notificationUuid: notificationUUID,
                      parkedRawPayload: input.pubsubBody,
                      parkedUntilProviderProductKey: error.providerProductKey,
                      paymentProviderConfigurationId: input.paymentProviderConfigurationId,
                      providerId: "google-play",
                      providerOccurredAt: eventTime,
                      result: "parked_pending_product_mapping",
                      resultNote: `product key ${error.providerProductKey} not mapped at notification time`,
                      source: "webhook",
                    });
                    return ack(true);
                  }),
              ),
              Effect.catchIf(
                (error) => TERMINAL_RECORD_FAILURE_TAGS.has(errorTag(error) ?? ""),
                (error) => markTerminalRecordFailure(`record failed: ${String(error)}`),
              ),
            );

          const matchResult: AcceptRtdnNotificationResult = yield* Match.value(decoded).pipe(
            Match.when({ type: "subscription" }, (subscription) =>
              Match.value(subscription.notificationType).pipe(
                // PURCHASED → new subscription.
                Match.when(4, () => handled(googlePlayPaymentProvider.recordPurchase(recordInput))),
                // RENEWED / RECOVERED → successful renewal charge.
                Match.whenOr(2, 1, () =>
                  handled(googlePlayPaymentProvider.recordSubscriptionRenewed(recordInput)),
                ),
                // CANCELED → auto-renew disabled; entitled until expiry.
                Match.when(3, () =>
                  handled(googlePlayPaymentProvider.recordSubscriptionCanceled(recordInput)),
                ),
                // ON_HOLD / IN_GRACE_PERIOD → billing retry.
                Match.whenOr(5, 6, () =>
                  handled(googlePlayPaymentProvider.recordBillingRetry(recordInput)),
                ),
                // RESTARTED → user re-enabled auto-renew.
                Match.when(7, () =>
                  handled(googlePlayPaymentProvider.recordAutoRenewResumed(recordInput)),
                ),
                // PRICE_CHANGE_CONFIRMED → pending price change.
                Match.when(8, () =>
                  handled(googlePlayPaymentProvider.recordPriceIncrease(recordInput)),
                ),
                // DEFERRED → renewal date extended.
                Match.when(9, () =>
                  handled(googlePlayPaymentProvider.recordSubscriptionExtended(recordInput)),
                ),
                // REVOKED → entitlement revoked immediately.
                Match.when(12, () =>
                  handled(googlePlayPaymentProvider.recordEntitlementRevoked(recordInput)),
                ),
                // EXPIRED → subscription ended.
                Match.when(13, () =>
                  handled(googlePlayPaymentProvider.recordSubscriptionExpired(recordInput)),
                ),
                // PAUSED / PAUSE_SCHEDULE_CHANGED (10/11) → no state change.
                Match.orElse(() =>
                  handled(googlePlayPaymentProvider.recordInformationalNotification(recordInput)),
                ),
              ),
            ),
            Match.when({ type: "oneTimeProduct" }, (oneTime) => {
              // PURCHASED (1) → new purchase; anything else is a refund.
              if (oneTime.notificationType === 1) {
                return handled(googlePlayPaymentProvider.recordPurchase(recordInput));
              }
              return handled(googlePlayPaymentProvider.recordRefund(recordInput));
            }),
            Match.when({ type: "voidedPurchase" }, (voided) => {
              // refundType 2 = revoke (entitlement pulled), otherwise a refund.
              if (voided.refundType === 2) {
                return handled(googlePlayPaymentProvider.recordEntitlementRevoked(recordInput));
              }
              return handled(googlePlayPaymentProvider.recordRefund(recordInput));
            }),
            Match.orElse(() => Effect.succeed(ack(false))),
          );

          const ledgerResult =
            terminalLedgerResult ?? pick(matchResult.handled, "applied", "ignored");

          // Wire-level dedup ledger: one row per notificationUUID. The
          // park-write above (when it fires) wins the UNIQUE and this insert is
          // a no-op against it.
          yield* writeLedgerRow({
            configurationId: input.paymentProviderConfigurationId,
            notificationType,
            notificationUUID,
            result: ledgerResult,
            resultNote: terminalLedgerResultNote,
          });

          yield* Effect.annotateCurrentSpan({ "google_play.webhook_result": ledgerResult });
          return matchResult;
        },
        (effect) =>
          effect.pipe(
            Effect.catchIf(Schema.isSchemaError, (error) =>
              Effect.fail(new GooglePlayPaymentProviderServiceError({ cause: String(error) })),
            ),
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(
                  new GooglePlayPaymentProviderServiceError({ cause: String(error.cause) }),
                ),
              PersonServiceError: (error) =>
                Effect.fail(new GooglePlayPaymentProviderServiceError({ cause: error.cause })),
              PurchaseProcessingServiceError: (error) =>
                Effect.fail(new GooglePlayPaymentProviderServiceError({ cause: error.cause })),
            }),
          ),
      );

      /**
       * Fetches authoritative purchase state for a decoded notification.
       * Subscription / voided-subscription → `subscriptions.v2.get`;
       * one-time / voided-product → `products.v2.get`.
       */
      function fetchPurchaseForNotification(
        sdkContext: GooglePlaySdkContext,
        decoded: Exclude<DecodedNotification, { type: "test" }>,
      ) {
        if (decoded.type === "subscription") {
          return googlePlayPaymentProvider.fetchAndNormalizeSubscription(sdkContext, {
            purchaseToken: decoded.purchaseToken,
            subscriptionId: decoded.subscriptionId,
          });
        }
        if (decoded.type === "oneTimeProduct") {
          return googlePlayPaymentProvider.fetchAndNormalizeProduct(sdkContext, {
            purchaseToken: decoded.purchaseToken,
            sku: decoded.sku,
          });
        }
        // Voided purchase: productType 1 = subscription, 2 = one-time.
        if (decoded.productType === 2) {
          return googlePlayPaymentProvider.fetchAndNormalizeProduct(sdkContext, {
            purchaseToken: decoded.purchaseToken,
            sku: "",
          });
        }
        return googlePlayPaymentProvider.fetchAndNormalizeSubscription(sdkContext, {
          purchaseToken: decoded.purchaseToken,
          subscriptionId: "",
        });
      }

      function writeLedgerRow(input: {
        readonly configurationId: string;
        readonly notificationType: string;
        readonly notificationUUID: string;
        readonly result: string;
        readonly resultNote: string | null;
      }) {
        return queries.insertNotificationProcessedIfAbsent({
          id: generateId("paymentProviderNotification"),
          notificationSubtype: null,
          notificationType: input.notificationType,
          notificationUuid: input.notificationUUID,
          parkedRawPayload: null,
          parkedUntilProviderProductKey: null,
          paymentProviderConfigurationId: input.configurationId,
          providerId: "google-play",
          result: input.result,
          resultNote: input.resultNote,
          source: "webhook",
        });
      }

      /**
       * Replays all parked notifications for a `(configurationId,
       * providerProductKey)` mapping. Called after a new product mapping is
       * created. Each parked Pub/Sub body is re-run through
       * `acceptRtdnNotification` with `isReplay: true`; the per-event
       * idempotency gate makes the replay safe against any live event for the
       * same logical transaction.
       */
      const replayParkedNotificationsForProductMapping = Effect.fn(
        "replayParkedNotificationsForProductMapping",
      )(function* (input: {
        readonly paymentProviderConfigurationId: string;
        readonly providerProductKey: string;
      }) {
        const parked = yield* queries.findParkedNotifications({
          paymentProviderConfigurationId: input.paymentProviderConfigurationId,
          providerProductKey: input.providerProductKey,
        });
        let appliedCount = 0;
        let failedCount = 0;
        for (const row of parked.filter((candidate) => candidate.source === "webhook")) {
          const rawPayload = row.parkedRawPayload;
          if (rawPayload === null || rawPayload === undefined) {
            yield* queries.markParkedNotificationResolved({
              id: row.id,
              result: "failed",
              resultNote: "parked_raw_payload missing",
            });
            failedCount++;
            continue;
          }
          const receivedAt = yield* DateTime.nowAsDate;
          const replayed = yield* acceptRtdnNotification({
            isReplay: true,
            paymentProviderConfigurationId: input.paymentProviderConfigurationId,
            pubsubBody: rawPayload,
            receivedAt,
          }).pipe(
            Effect.match({
              onFailure: (error) => ({ error: String(error), ok: constant(false) }),
              onSuccess: (result) => ({ handled: result.handled, ok: constant(true) }),
            }),
          );
          if (replayed.ok && replayed.handled) {
            yield* queries.markParkedNotificationResolved({
              id: row.id,
              result: "applied",
              resultNote: null,
            });
            appliedCount++;
          } else {
            let resultNote: string;
            if (replayed.ok) resultNote = "replay completed without applying purchase state";
            else resultNote = replayed.error;
            yield* queries.markParkedNotificationAttempted({
              id: row.id,
              resultNote,
            });
            failedCount++;
          }
        }

        for (const row of parked.filter((candidate) => candidate.source === "sdk")) {
          const decoded = yield* Schema.decodeUnknownEffect(ParkedGooglePlaySdkPurchase)(
            row.parkedRawPayload,
          ).pipe(
            Effect.match({
              onFailure: () => ({ _tag: constant("Left") }),
              onSuccess: (right) => ({ _tag: constant("Right"), right }),
            }),
          );
          if (decoded._tag === "Left") {
            yield* queries.markParkedNotificationResolved({
              id: row.id,
              result: "failed",
              resultNote: "parked SDK payload is invalid",
            });
            failedCount++;
            continue;
          }
          const payload = decoded.right;
          const replayed = yield* Effect.gen(function* () {
            const configuration = yield* queries.findPaymentProviderConfigurationById(
              row.paymentProviderConfigurationId,
            );
            if (!configuration) return yield* Effect.fail("configuration not found");
            const project = yield* queries.findProjectById(configuration.projectId);
            if (!project) return yield* Effect.fail("project not found");
            const verified = yield* purchaseVerifier.verify({
              configuration,
              productId: payload.productId,
              purchaseToken: payload.purchaseToken,
            });
            return yield* googlePlayPaymentProvider.recordPurchase({
              configuration,
              distinctId: payload.distinctId,
              eventTime: DateTime.toDateUtc(DateTime.makeUnsafe(payload.receivedAt)),
              project,
              providerEnvironment: verified.providerEnvironment,
              purchase: verified.purchase,
              receivedAt: DateTime.toDateUtc(DateTime.makeUnsafe(payload.receivedAt)),
              source: "sdk",
            });
          }).pipe(
            Effect.match({
              onFailure: (error) => ({ error: String(error), ok: constant(false) }),
              onSuccess: (result) => ({ handled: !result.isIgnored(), ok: constant(true) }),
            }),
          );
          if (replayed.ok && replayed.handled) {
            yield* queries.markParkedNotificationResolved({
              id: row.id,
              result: "applied",
              resultNote: null,
            });
            appliedCount++;
          } else {
            let resultNote: string;
            if (replayed.ok) resultNote = "replay completed without applying purchase state";
            else resultNote = replayed.error;
            yield* queries.markParkedNotificationAttempted({
              id: row.id,
              resultNote,
            });
            failedCount++;
          }
        }
        return { appliedCount, failedCount, totalParked: parked.length };
      });

      return constant({
        acceptRtdnNotification,
        replayParkedNotificationsForProductMapping,
      });
    }),
  },
) {
  static layer = Layer.effect(GooglePlayWebhookHandlerService)(
    GooglePlayWebhookHandlerService.make,
  ).pipe(Layer.provide(GooglePlayWebhookHandlerDependenciesLive));
}

export type { AcceptRtdnNotificationResult };
