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
import { Context, Effect, Layer, Match, Option, Predicate, Schema } from "effect";

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

const errorTag = (error: unknown): string | undefined =>
  Predicate.hasProperty(error, "_tag") && typeof error._tag === "string" ? error._tag : undefined;

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
  const token = decoded.type === "test" ? "" : decoded.purchaseToken;
  const subtype =
    decoded.type === "subscription" || decoded.type === "oneTimeProduct"
      ? String(decoded.notificationType)
      : decoded.type === "voidedPurchase"
        ? `void:${decoded.refundType ?? ""}`
        : "";
  return `gp:${decoded.packageName}:${token}:${decoded.eventTimeMillis ?? ""}:${decoded.type}:${subtype}`;
};

export class GooglePlayWebhookHandlerService extends Context.Service<GooglePlayWebhookHandlerService>()(
  "GooglePlayWebhookHandlerService",
  {
    make: Effect.gen(function* () {
      const queries = yield* GooglePlayPaymentProviderServiceQueries;
      const googlePlayPaymentProvider = yield* GooglePlayPaymentProvider;

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
              onFailure: (error) => ({ error, ok: false as const }),
              onSuccess: (value) => ({ ok: true as const, value }),
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
          const notificationType =
            decoded.type === "test"
              ? "TEST"
              : decoded.type === "voidedPurchase"
                ? `VOIDED:${decoded.refundType ?? 1}`
                : decoded.notificationTypeName;
          const parsedEventTime = decoded.eventTimeMillis
            ? new Date(Number(decoded.eventTimeMillis))
            : undefined;
          const eventTime =
            parsedEventTime && !Number.isNaN(parsedEventTime.getTime())
              ? parsedEventTime
              : input.receivedAt;
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
            return ack(true);
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
          const purchase: GooglePlayNormalizedPurchase =
            decoded.type === "voidedPurchase" && decoded.orderId
              ? { ...fetched.value.purchase, orderId: Option.some(decoded.orderId) }
              : fetched.value.purchase;

          const recordInput = {
            configuration,
            eventTime,
            notificationUUID,
            project,
            providerEnvironment: fetched.value.providerEnvironment,
            purchase,
            receivedAt: input.receivedAt,
            source: "webhook" as const,
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
          const handled = <A, E, R>(
            recordEffect: Effect.Effect<A, E | GooglePlayPaymentProviderProductNotMappedError, R>,
          ) =>
            recordEffect.pipe(
              Effect.as(ack(true)),
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
                      return yield* markTerminalRecordFailure(
                        `product key ${error.providerProductKey} still not mapped on replay`,
                      );
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

          const matchResult = (yield* Match.value(decoded).pipe(
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
            Match.when({ type: "oneTimeProduct" }, (oneTime) =>
              oneTime.notificationType === 1
                ? handled(googlePlayPaymentProvider.recordPurchase(recordInput))
                : handled(googlePlayPaymentProvider.recordRefund(recordInput)),
            ),
            Match.when({ type: "voidedPurchase" }, (voided) =>
              voided.refundType === 2
                ? handled(googlePlayPaymentProvider.recordEntitlementRevoked(recordInput))
                : handled(googlePlayPaymentProvider.recordRefund(recordInput)),
            ),
            Match.orElse(() => Effect.succeed(ack(false))),
          )) as AcceptRtdnNotificationResult;

          // Wire-level dedup ledger: one row per notificationUUID. The
          // park-write above (when it fires) wins the UNIQUE and this insert is
          // a no-op against it.
          yield* writeLedgerRow({
            configurationId: input.paymentProviderConfigurationId,
            notificationType,
            notificationUUID,
            result: terminalLedgerResult ?? (matchResult.handled ? "applied" : "ignored"),
            resultNote: terminalLedgerResultNote,
          });

          yield* Effect.annotateCurrentSpan({
            "google_play.webhook_result":
              terminalLedgerResult ?? (matchResult.handled ? "applied" : "ignored"),
          });
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
        return decoded.productType === 2
          ? googlePlayPaymentProvider.fetchAndNormalizeProduct(sdkContext, {
              purchaseToken: decoded.purchaseToken,
              sku: "",
            })
          : googlePlayPaymentProvider.fetchAndNormalizeSubscription(sdkContext, {
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
        for (const row of parked) {
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
          const replayed = yield* acceptRtdnNotification({
            isReplay: true,
            paymentProviderConfigurationId: input.paymentProviderConfigurationId,
            pubsubBody: rawPayload,
            receivedAt: new Date(),
          }).pipe(
            Effect.match({
              onFailure: (error) => ({ error: String(error), ok: false as const }),
              onSuccess: () => ({ ok: true as const }),
            }),
          );
          if (replayed.ok) {
            yield* queries.markParkedNotificationResolved({
              id: row.id,
              result: "applied",
              resultNote: null,
            });
            appliedCount++;
          } else {
            yield* queries.markParkedNotificationResolved({
              id: row.id,
              result: "failed",
              resultNote: replayed.error.slice(0, 500),
            });
            failedCount++;
          }
        }
        return { appliedCount, failedCount, totalParked: parked.length };
      });

      return {
        acceptRtdnNotification,
        replayParkedNotificationsForProductMapping,
      } as const;
    }),
  },
) {
  static layer = Layer.effect(GooglePlayWebhookHandlerService)(
    GooglePlayWebhookHandlerService.make,
  ).pipe(Layer.provideMerge(GooglePlayPaymentProvider.layer));
}

export type { AcceptRtdnNotificationResult };
