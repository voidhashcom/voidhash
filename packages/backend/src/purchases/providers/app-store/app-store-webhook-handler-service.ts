import {
  Environment,
  type JWSRenewalInfoDecodedPayload,
  NotificationTypeV2,
} from "@voidhash/app-store-server-sdk";
import { generateId } from "@voidhash/core/utils";
import {
  ProviderEnvironment,
  type PaymentProviderNotificationProcessed as DbPaymentProviderNotificationProcessed,
} from "@voidhash/db";
import { constant, pick, stringOr } from "@voidhash/lib/lang";
import * as Arr from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import * as Schema from "effect/Schema";
import * as Context from "effect/Context";
import { createHash } from "@voidhash/core/services/apiKeys/create-hash";

import type { PurchaseProcessingResult } from "@voidhash/core-v2";
import {
  AppStorePaymentProviderConfigurationNotFoundError,
  AppStorePaymentProviderProductNotMappedError,
  AppStorePaymentProviderProjectNotFoundError,
  AppStorePaymentProviderServiceError,
} from "./errors.ts";
import { AppStorePaymentProvider, globalConfigurationSchema } from "./payment-provider.ts";
import { AppStorePaymentProviderServiceQueries } from "./payment-provider-service-queries.ts";
import { AppStoreTransactionVerifier } from "./transaction-verifier.ts";
import { AppStoreReconciliationService } from "./app-store-reconciliation-service.ts";
import { MutableSet } from "../../../collection-boundary.ts";
import { hasTag } from "../../../runtime-boundary.ts";

const ParkedAppStoreSdkPurchase = Schema.Struct({
  distinctId: Schema.String,
  receivedAt: Schema.String,
  transactionId: Schema.String,
});

const ParkedAppStoreReconciliation = Schema.Struct({
  originalTransactionId: Schema.String,
  reason: Schema.Literals(["first_seen", "admin_repair", "install_backfill"]),
  triggeredAt: Schema.String,
});

const truncateResultNote = (note: string): string => note.slice(0, 500);

/** Lowercase hex sha256 over a UTF-8 string (WebCrypto via `uncrypto`, workerd-safe). */
const sha256Hex = (value: string): Effect.Effect<string> =>
  Effect.tryPromise({ try: () => createHash("SHA-256", "hex").digest(value), catch: (cause) => cause }).pipe(Effect.orDie);

const optionSpanAttribute = <A>(
  value: Option.Option<A>,
  map: (value: A) => unknown = (some) => some,
): unknown => Option.match(value, { onNone: () => undefined, onSome: (some) => map(some) });

const hasErrorTag = <TTag extends string>(
  error: unknown,
  tag: TTag,
): error is { readonly _tag: TTag } => P.hasProperty(error, "_tag") && error._tag === tag;

/** Reads `key` off an unknown error as a string, or `fallback` when absent. */
const errorProperty = (error: unknown, key: string, fallback: string): string => {
  if (P.hasProperty(error, key)) {
    return String(error[key]);
  }
  return fallback;
};

const verificationStatus = (error: unknown): string => errorProperty(error, "status", "unknown");

const replayErrorNote = (error: unknown): string => {
  const rendered = String(error);
  const tag = errorProperty(error, "_tag", "");
  if (tag === "" || rendered.includes(tag)) return rendered;
  if (rendered === "") return tag;
  return `${tag}: ${rendered}`;
};

/** Tags `handled` collapses into a terminal record-failure ledger row. */
const TERMINAL_RECORD_FAILURE_TAGS = new MutableSet<string>([
  "AppStorePaymentProviderTransactionMissingPersonIdentifierError",
  "AppStorePurchaseProcessingIdempotencyKeyDerivationError",
  "InvalidISO4217CurrencyCodeError",
]);

const isTerminalRecordFailure = (error: unknown): boolean =>
  P.hasProperty(error, "_tag") &&
  P.isString(error._tag) &&
  TERMINAL_RECORD_FAILURE_TAGS.has(error._tag);

/**
 * Builds the terminal-failure ledger note for the record errors `handled`
 * collapses. Reads tag-specific fields defensively (the catch narrows by
 * predicate only, so the concrete field set isn't statically known) so no cast
 * is needed.
 */
const describeTransactionSuffix = (error: unknown): string => {
  if (!P.hasProperty(error, "providerTransactionId")) return "";
  const transactionId = stringOr(error.providerTransactionId, "");
  if (transactionId === "") return "";
  return ` (transaction ${transactionId})`;
};

const describeRecordFailure = (error: unknown): string => {
  const tag = errorProperty(error, "_tag", "");
  if (tag === "AppStorePaymentProviderTransactionMissingPersonIdentifierError") {
    const transactionId = errorProperty(error, "providerTransactionId", "unknown");
    return `missing person identifier for App Store transaction ${transactionId}`;
  }
  if (tag === "AppStorePurchaseProcessingIdempotencyKeyDerivationError") {
    const eventType = errorProperty(error, "eventType", "unknown");
    const missingField = errorProperty(error, "missingField", "unknown");
    const transaction = describeTransactionSuffix(error);
    return `idempotency key derivation failed for ${eventType}: missing ${missingField}${transaction}`;
  }
  return `invalid ISO 4217 currency code: ${String(error)}`;
};

/**
 * Result returned to the webhook ingress. `accepted` reflects whether we
 * verified Apple's signature and parsed the payload (i.e. whether Apple should
 * stop retrying); `handled` reflects whether we actually mutated purchase
 * state beyond acknowledging receipt.
 */
type AcceptServerNotificationResult = {
  readonly accepted: true;
  readonly handled: boolean;
  readonly notificationType: string | typeof Schema.Undefined.Type;
  readonly notificationUUID: string | typeof Schema.Undefined.Type;
  readonly subtype: string | typeof Schema.Undefined.Type;
};

const AppStorePaymentProviderLive = AppStorePaymentProvider.layer;

const AppStoreWebhookHandlerDependenciesLive = Layer.mergeAll(
  AppStorePaymentProviderLive,
  AppStoreTransactionVerifier.layer.pipe(Layer.provide(AppStorePaymentProviderLive)),
  AppStoreReconciliationService.layer.pipe(Layer.provide(AppStorePaymentProviderLive)),
);

export class AppStoreWebhookHandlerService extends Context.Service<AppStoreWebhookHandlerService>()(
  "@voidhash/backend/purchases/AppStoreWebhookHandlerService",
  {
    make: Effect.gen(function* () {
      const queries = yield* AppStorePaymentProviderServiceQueries;
      const appStorePaymentProvider = yield* AppStorePaymentProvider;
      const transactionVerifier = yield* AppStoreTransactionVerifier;
      const reconciliationService = yield* AppStoreReconciliationService;

      /**
       * Entry point invoked by the webhook HTTP route. Verifies Apple's
       * signature, decodes the signed transaction once, and dispatches the
       * notification to the matching `record*` method on
       * `AppStorePaymentProvider`. Branches without a downstream
       * purchase-processing equivalent ack-without-handling so Apple stops
       * retrying.
       */
      const acceptServerNotification = Effect.fn("acceptServerNotification")(
        function* (input: {
          readonly paymentProviderConfigurationId: string;
          readonly signedPayload: string;
          readonly receivedAt: Date;
          /**
           * Set to `true` by the SDK-confirmation replay activity so the outer
           * "park until SDK confirms" gate is bypassed. Live (un-parked)
           * deliveries leave it unset; the gate only ever runs on first
           * arrival. Without this flag, replayed payloads could be re-parked
           * if the gate's `hasAnyAppStoreRecordForOriginalTransactionId`
           * lookup hadn't seen the SDK write yet (replication / read-after-
           * write race), creating a self-perpetuating park loop.
           */
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
            return yield* new AppStorePaymentProviderConfigurationNotFoundError({
              paymentProviderConfigurationId: input.paymentProviderConfigurationId,
            });
          }

          yield* Effect.annotateCurrentSpan(
            "voidhash.payment_provider.id",
            configuration.providerId,
          );
          const project = yield* queries.findProjectById(configuration.projectId);
          if (!project) {
            return yield* new AppStorePaymentProviderProjectNotFoundError({
              projectId: configuration.projectId,
            });
          }
          yield* Effect.annotateCurrentSpan("voidhash.project.id", project.id);

          const sdkContext =
            yield* appStorePaymentProvider.buildSdkContextFromConfiguration(configuration);

          /**
           * Decode the configuration once at the entry point so the per-tenant
           * `shouldTrackNewPurchasesFromAppleServerNotifications` flag is available
           * for the SUBSCRIBED / ONE_TIME_CHARGE gating below.
           */
          const parsedGlobalConfiguration = yield* Schema.decodeUnknownEffect(
            globalConfigurationSchema,
          )(configuration.configuration);

          const notificationDecodeResult = yield* sdkContext
            .decodeNotification(input.signedPayload)
            .pipe(
              Effect.match({
                onFailure: (error) => ({ error, ok: constant(false) }),
                onSuccess: (value) => ({ ok: constant(true), value }),
              }),
            );

          if (!notificationDecodeResult.ok) {
            const error = notificationDecodeResult.error;
            if (hasErrorTag(error, "VerificationError")) {
              yield* Effect.annotateCurrentSpan({
                "app_store.webhook_result": "verification_rejected",
              });
              yield* Effect.logWarning(
                "App Store notification rejected as terminal verification failure",
                {
                  paymentProviderConfigurationId: input.paymentProviderConfigurationId,
                  status: verificationStatus(error),
                },
              );
              // Audit even the invalid-JWS ack: keyed by a hash of the signed
              // payload so a redelivery of the same bad payload dedupes onto
              // one ledger row instead of leaving no trace at all.
              const payloadHash = yield* sha256Hex(input.signedPayload);
              yield* queries.insertNotificationProcessedIfAbsent({
                id: generateId("paymentProviderNotification"),
                notificationSubtype: null,
                notificationType: "INVALID_PAYLOAD",
                notificationUuid: `invalid:${payloadHash}`,
                parkedRawPayload: null,
                parkedUntilProviderProductKey: null,
                paymentProviderConfigurationId: input.paymentProviderConfigurationId,
                providerId: "apple-app-store",
                result: "failed",
                resultNote: truncateResultNote(
                  `JWS verification failed: ${verificationStatus(error)}`,
                ),
                source: "webhook",
              });
              return {
                accepted: true,
                handled: false,
                notificationType: undefined,
                notificationUUID: undefined,
                subtype: undefined,
              };
            }
            return yield* Effect.fail(error);
          }

          const notification = notificationDecodeResult.value;

          const notificationType = Option.getOrUndefined(notification.notificationType);
          const subtype = Option.getOrUndefined(notification.subtype);
          const notificationUUID = Option.getOrUndefined(notification.notificationUUID);
          const notificationOccurredAt = Option.match(notification.signedDate, {
            onNone: () => input.receivedAt,
            onSome: (milliseconds) => DateTime.toDateUtc(DateTime.makeUnsafe(milliseconds)),
          });
          if (notificationType) {
            yield* Effect.annotateCurrentSpan(
              "voidhash.payment_provider.event_type",
              notificationType,
            );
          }
          if (notificationUUID) {
            yield* Effect.annotateCurrentSpan("voidhash.webhook.id", notificationUUID);
          }

          const ack = (handled: boolean): AcceptServerNotificationResult => ({
            accepted: true,
            handled,
            notificationType,
            notificationUUID,
            subtype,
          });

          const terminalLedger: {
            result: "failed" | typeof Schema.Undefined.Type;
            resultNote: string | typeof Schema.Null.Type;
          } = { result: undefined, resultNote: null };

          const markTerminalRecordFailure = (reason: string) =>
            Effect.fn("markTerminalRecordFailure")(function* () {
              terminalLedger.result = "failed";
              terminalLedger.resultNote = truncateResultNote(reason);
              yield* Effect.annotateCurrentSpan({
                "app_store.webhook_result": "failed",
              });
              yield* Effect.logWarning("App Store notification record failed permanently", {
                notificationType,
                notificationUUID,
                paymentProviderConfigurationId: input.paymentProviderConfigurationId,
                resultNote: terminalLedger.resultNote,
                subtype,
              });
              return ack(false);
            })();

          const writeTerminalFailure = (reason: string) =>
            Effect.fn("writeTerminalFailure")(function* () {
              const resultNote = truncateResultNote(reason);
              yield* Effect.annotateCurrentSpan({
                "app_store.webhook_result": "failed",
              });
              yield* Effect.logWarning("App Store notification failed permanently", {
                notificationType,
                notificationUUID,
                paymentProviderConfigurationId: input.paymentProviderConfigurationId,
                resultNote,
                subtype,
              });
              if (notificationUUID && notificationType) {
                yield* queries.insertNotificationProcessedIfAbsent({
                  id: generateId("paymentProviderNotification"),
                  notificationSubtype: subtype ?? null,
                  notificationType,
                  notificationUuid: notificationUUID,
                  parkedRawPayload: null,
                  parkedUntilProviderProductKey: null,
                  paymentProviderConfigurationId: input.paymentProviderConfigurationId,
                  providerId: "apple-app-store",
                  result: "failed",
                  resultNote,
                  source: "webhook",
                });
              }
            })();

          if (!notificationType) {
            return ack(false);
          }

          /**
           * `TEST` is Apple's connectivity check (`requestTestNotification`). It
           * never carries actionable purchase state, so it short-circuits ahead
           * of the signed-transaction requirement and the dispatch table — even
           * when Apple attaches a `signedTransactionInfo` — leaving only an
           * `ignored` audit row. The wire-dedup key still makes a redelivered
           * ping a no-op insert.
           */
          if (notificationType === NotificationTypeV2.TEST) {
            const effectiveTestUuid =
              notificationUUID ??
              `apple:${notificationType}:${subtype ?? ""}:${notificationOccurredAt.getTime()}`;
            yield* queries.insertNotificationProcessedIfAbsent({
              id: generateId("paymentProviderNotification"),
              notificationSubtype: subtype ?? null,
              notificationType,
              notificationUuid: effectiveTestUuid.slice(0, 255),
              parkedRawPayload: null,
              parkedUntilProviderProductKey: null,
              paymentProviderConfigurationId: input.paymentProviderConfigurationId,
              providerId: "apple-app-store",
              providerOccurredAt: notificationOccurredAt,
              result: "ignored",
              resultNote: null,
              source: "webhook",
            });
            yield* Effect.annotateCurrentSpan({
              "app_store.webhook_result": "ignored",
            });
            return ack(false);
          }

          const signedTransactionInfo = Option.getOrUndefined(
            Option.flatMap(notification.data, (data) => data.signedTransactionInfo),
          );

          /**
           * Every remaining notification kind carries purchase state and
           * therefore requires a signed transaction.
           */
          if (!signedTransactionInfo) {
            yield* writeTerminalFailure("signedTransactionInfo missing from non-TEST notification");
            return ack(false);
          }

          const notificationEnvironment = Option.getOrUndefined(
            Option.flatMap(notification.data, (data) => data.environment),
          );
          const transactionEnvironment = pick(
            notificationEnvironment === Environment.SANDBOX,
            Environment.SANDBOX,
            Environment.PRODUCTION,
          );
          const providerEnvironment = pick(
            transactionEnvironment === Environment.SANDBOX,
            ProviderEnvironment.Sandbox,
            ProviderEnvironment.Production,
          );

          const decodedTransactionResult = yield* sdkContext
            .decodeSignedTransaction(signedTransactionInfo, transactionEnvironment)
            .pipe(
              Effect.match({
                onFailure: (error) => ({ error, ok: constant(false) }),
                onSuccess: (value) => ({ ok: constant(true), value }),
              }),
            );

          if (!decodedTransactionResult.ok) {
            const error = decodedTransactionResult.error;
            if (hasErrorTag(error, "VerificationError")) {
              yield* writeTerminalFailure(
                `signedTransactionInfo verification failed (${verificationStatus(error)})`,
              );
              return ack(false);
            }
            return yield* Effect.fail(error);
          }

          const decodedTransaction = decodedTransactionResult.value;
          const originalTransactionIdAttr = optionSpanAttribute(
            decodedTransaction.originalTransactionId,
          );
          if (originalTransactionIdAttr !== undefined) {
            yield* Effect.annotateCurrentSpan(
              "voidhash.transaction.original_id",
              originalTransactionIdAttr,
            );
          }
          const providerProductKeyAttr = optionSpanAttribute(decodedTransaction.productId);
          if (providerProductKeyAttr !== undefined) {
            yield* Effect.annotateCurrentSpan(
              "voidhash.payment_provider.provider_product_key",
              providerProductKeyAttr,
            );
          }
          const transactionIdAttr = optionSpanAttribute(decodedTransaction.transactionId);
          if (transactionIdAttr !== undefined) {
            yield* Effect.annotateCurrentSpan(
              "voidhash.transaction.provider_transaction_id",
              transactionIdAttr,
            );
          }

          /**
           * `signedRenewalInfo` is optional and only present on auto-renewable
           * subscription notifications. Decode best-effort — if verification
           * fails we log and continue without it rather than dropping the
           * whole notification, since renewal info is supplementary to the
           * authoritative `signedTransactionInfo` decoded above.
           */
          const decodedRenewalInfo = yield* Option.match(
            Option.flatMap(notification.data, (data) => data.signedRenewalInfo),
            {
              onNone: () => Effect.succeed(Option.none<JWSRenewalInfoDecodedPayload>()),
              onSome: (signedRenewalInfo) =>
                sdkContext.decodeSignedRenewalInfo(signedRenewalInfo, transactionEnvironment).pipe(
                  Effect.map(Option.some),
                  Effect.catch((error: unknown) =>
                    Effect.logWarning("Failed to decode App Store signedRenewalInfo", {
                      cause: error,
                      notificationType,
                      notificationUUID,
                    }).pipe(Effect.as(Option.none<JWSRenewalInfoDecodedPayload>())),
                  ),
                ),
            },
          );

          /**
           * Per-tenant deferred-replay gate.
           *
           * When `shouldTrackNewPurchasesFromAppleServerNotifications` is `false`,
           * webhooks must not create purchases on their own — the tenant
           * tracks only the SDK-confirmed subset. To avoid losing notifications
           * that race ahead of the SDK call, we park them keyed on
           * `originalTransactionId` and replay them in provider occurrence order once
           * `processSdkTransaction` succeeds for the series (see
           * `AppStoreReplayParkedSdkNotificationsWorkflow`).
           *
           * Applies to ALL notification kinds (initial purchase + lifecycle):
           * a `DID_RENEW` or `EXPIRED` that arrives before SDK confirmation
           * has no `subscription` row to update, so deferring it is the only
           * way to keep state consistent.
           *
           * Skipped when `isReplay` is set — the replay activity calls us
           * back with the stored payload, and re-parking it would loop.
           */
          const deferReplay =
            !parsedGlobalConfiguration.shouldTrackNewPurchasesFromAppleServerNotifications;
          const originalTransactionId = Option.getOrUndefined(
            decodedTransaction.originalTransactionId,
          );
          const providerOccurredAt = notificationOccurredAt;
          const transactionAnchor = Option.getOrElse(
            decodedTransaction.transactionId,
            () => originalTransactionId ?? "unknown",
          );
          const effectiveNotificationUuid =
            notificationUUID ??
            `apple:${notificationType}:${subtype ?? ""}:${transactionAnchor}:${providerOccurredAt.getTime()}`.slice(
              0,
              255,
            );
          if (!input.isReplay && deferReplay && originalTransactionId) {
            const sdkConfirmed = yield* queries.hasAnyAppStoreRecordForOriginalTransactionId({
              originalTransactionId,
            });
            if (!sdkConfirmed) {
              yield* Effect.annotateCurrentSpan({
                "app_store.webhook_result": "parked_pending_sdk_confirmation",
              });
              yield* Effect.logInfo("App Store notification parked: SDK confirmation pending", {
                notificationType,
                notificationUUID,
                originalTransactionId,
                paymentProviderConfigurationId: input.paymentProviderConfigurationId,
              });
              yield* queries.insertNotificationProcessedIfAbsent({
                id: generateId("paymentProviderNotification"),
                notificationSubtype: subtype ?? null,
                notificationType,
                notificationUuid: effectiveNotificationUuid,
                parkedRawPayload: input.signedPayload,
                parkedUntilOriginalTransactionId: originalTransactionId,
                parkedUntilProviderProductKey: null,
                paymentProviderConfigurationId: input.paymentProviderConfigurationId,
                providerId: "apple-app-store",
                providerOccurredAt,
                result: "parked_pending_sdk_confirmation",
                resultNote: null,
                source: "webhook",
              });
              return ack(true);
            }
          }

          const recordInput = {
            configuration,
            decodedRenewalInfo,
            decodedTransaction,
            notificationUUID,
            project,
            providerEnvironment,
            receivedAt: input.receivedAt,
            source: constant("webhook"),
            subtype,
          };

          /**
           * Wraps a record-method call to (a) coerce the success into
           * `ack(true)` and (b) intercept `AppStorePaymentProviderProductNotMappedError`
           * — when the customer hasn't mapped this product yet, we park the
           * raw signed payload in the notification ledger so the
           * replay-on-product-creation task can re-process it later, then ack
           * so Apple stops retrying. Closes over `notificationType`,
           * `notificationUUID`, `subtype`, and `input.signedPayload` from the
           * enclosing scope. Generic in the record method's success/error/
           * requirements so it works with every `record*` shape uniformly.
           */
          const handled = <E, R>(
            recordEffect: Effect.Effect<
              PurchaseProcessingResult,
              E | AppStorePaymentProviderProductNotMappedError,
              R
            >,
          ) =>
            recordEffect.pipe(
              Effect.map((result) => ack(!result.isIgnored())),
              // `handled` is generic over the record method's error channel `E`,
              // so `catchTag`/`catchTags` can't prove these tags are members of
              // it (and would need an `any` widening that poisons every caller's
              // inferred `R` to `unknown`). Narrow with tag guards instead — same
              // runtime behaviour, precise types.
              Effect.catchIf(
                (error): error is AppStorePaymentProviderProductNotMappedError =>
                  P.hasProperty(error, "_tag") &&
                  hasTag(error, "AppStorePaymentProviderProductNotMappedError"),
                (error) =>
                  Effect.fn("handled")(function* () {
                    yield* Effect.annotateCurrentSpan(
                      "voidhash.payment_provider.provider_product_key",
                      error.providerProductKey,
                    );
                    yield* Effect.annotateCurrentSpan({
                      "app_store.webhook_result": "parked_pending_product_mapping",
                    });
                    yield* Effect.logInfo("App Store notification parked: product not yet mapped", {
                      notificationType,
                      notificationUUID,
                      paymentProviderConfigurationId: error.paymentProviderConfigurationId,
                      providerProductKey: error.providerProductKey,
                    });
                    if (input.isReplay) {
                      return ack(false);
                    }
                    yield* queries.insertNotificationProcessedIfAbsent({
                      id: generateId("paymentProviderNotification"),
                      notificationSubtype: subtype ?? null,
                      notificationType,
                      notificationUuid: effectiveNotificationUuid,
                      parkedRawPayload: input.signedPayload,
                      parkedUntilProviderProductKey: error.providerProductKey,
                      paymentProviderConfigurationId: input.paymentProviderConfigurationId,
                      providerId: "apple-app-store",
                      providerOccurredAt,
                      result: "parked_pending_product_mapping",
                      resultNote: `product key ${error.providerProductKey} not mapped at notification time`,
                      source: "webhook",
                    });
                    return ack(true);
                  })(),
              ),
              Effect.catchIf(isTerminalRecordFailure, (error) =>
                markTerminalRecordFailure(describeRecordFailure(error)),
              ),
            );

          /**
           * The per-tenant kill switch for new-purchase webhooks now lives in
           * the outer `deferReplay` gate above — when it parks, control never
           * reaches this match. Lifecycle events (renew, expire, refund,
           * etc.) follow the same gate: they too are parked until the SDK
           * confirms the series.
           */
          const matchResult: AcceptServerNotificationResult = yield* Match.value(
            notificationType,
          ).pipe(
            /**
             * New subscription (subtypes `INITIAL_BUY`, `RESUBSCRIBE`) or a
             * one-time charge / non-renewing purchase.
             */
            Match.when(NotificationTypeV2.SUBSCRIBED, () =>
              handled(appStorePaymentProvider.recordPurchase(recordInput)),
            ),
            Match.when(NotificationTypeV2.ONE_TIME_CHARGE, () =>
              handled(appStorePaymentProvider.recordPurchase(recordInput)),
            ),

            /** Auto-renewable subscription renewed (incl. `BILLING_RECOVERY`). */
            Match.when(NotificationTypeV2.DID_RENEW, () =>
              handled(appStorePaymentProvider.recordSubscriptionRenewed(recordInput)),
            ),

            /** Subscription expired or grace period elapsed without recovery. */
            Match.when(NotificationTypeV2.EXPIRED, () =>
              handled(appStorePaymentProvider.recordSubscriptionExpired(recordInput)),
            ),
            Match.when(NotificationTypeV2.GRACE_PERIOD_EXPIRED, () =>
              handled(appStorePaymentProvider.recordSubscriptionExpired(recordInput)),
            ),

            /**
             * User toggled auto-renew. AUTO_RENEW_DISABLED → cancel-at-period-end;
             * AUTO_RENEW_ENABLED → resume (clear cancel flags + re-sync perks).
             */
            Match.when(NotificationTypeV2.DID_CHANGE_RENEWAL_STATUS, () => {
              if (subtype === "AUTO_RENEW_DISABLED") {
                return handled(
                  appStorePaymentProvider.recordSubscriptionCanceled({
                    ...recordInput,
                    cancelAtPeriodEnd: true,
                  }),
                );
              }
              if (subtype === "AUTO_RENEW_ENABLED") {
                return handled(appStorePaymentProvider.recordAutoRenewResumed(recordInput));
              }
              return Effect.succeed(ack(false));
            }),

            /** Apple refunded a transaction. */
            Match.when(NotificationTypeV2.REFUND, () =>
              handled(appStorePaymentProvider.recordRefund(recordInput)),
            ),

            /** Family Sharing entitlement revoked. */
            Match.when(NotificationTypeV2.REVOKE, () =>
              handled(appStorePaymentProvider.recordEntitlementRevoked(recordInput)),
            ),

            /** Apple reversed a prior refund — re-grant the entitlement. */
            Match.when(NotificationTypeV2.REFUND_REVERSED, () =>
              handled(appStorePaymentProvider.recordRefundReversed(recordInput)),
            ),

            /** Subscription entered the billing-retry loop. */
            Match.when(NotificationTypeV2.DID_FAIL_TO_RENEW, () =>
              handled(appStorePaymentProvider.recordBillingRetry(recordInput)),
            ),

            /** Service-issued period extension. */
            Match.when(NotificationTypeV2.RENEWAL_EXTENDED, () =>
              handled(appStorePaymentProvider.recordSubscriptionExtended(recordInput)),
            ),
            Match.when(NotificationTypeV2.RENEWAL_EXTENSION, () =>
              handled(appStorePaymentProvider.recordSubscriptionExtended(recordInput)),
            ),

            /** Customer changed the product for the next billing cycle. */
            Match.when(NotificationTypeV2.DID_CHANGE_RENEWAL_PREF, () =>
              handled(appStorePaymentProvider.recordRenewalPreferenceChange(recordInput)),
            ),

            /** Promotional / introductory / win-back offer redeemed. */
            Match.when(NotificationTypeV2.OFFER_REDEEMED, () =>
              handled(appStorePaymentProvider.recordOfferRedeemed(recordInput)),
            ),

            /** Apple has scheduled a price change for the next renewal. */
            Match.when(NotificationTypeV2.PRICE_INCREASE, () =>
              handled(appStorePaymentProvider.recordPriceIncrease(recordInput)),
            ),

            /**
             * Informational notifications — ingested into the per-notification
             * ledger (written below the match) for audit, but no purchase
             * state changes. `CONSUMPTION_REQUEST` requires a write-back call
             * (`sendConsumptionInformation`) which is out of scope for this
             * phase; `EXTERNAL_PURCHASE_TOKEN` requires token-reporting which
             * is also out of scope.
             */
            /**
             * Informational notifications collapsed into one branch. They
             * carry no purchase state — the per-notification ledger row
             * (written below the match) is the durable record. Note: Apple
             * does not currently emit a `METADATA_UPDATE` notification, but
             * if added in the future it can land here without changes.
             */
            Match.whenOr(
              NotificationTypeV2.REFUND_DECLINED,
              NotificationTypeV2.RESCIND_CONSENT,
              NotificationTypeV2.CONSUMPTION_REQUEST,
              NotificationTypeV2.EXTERNAL_PURCHASE_TOKEN,
              () => handled(appStorePaymentProvider.recordInformationalNotification(recordInput)),
            ),

            /**
             * `TEST` never reaches here — it is short-circuited to an `ignored`
             * ledger row above, before the signed-transaction requirement.
             */

            /** Any other notification type still gets a notification-ledger row but is ignored. */
            Match.orElse(() => Effect.succeed(ack(false))),
          );

          /**
           * Wire-level dedup ledger: one row per Apple notificationUUID,
           * regardless of whether we routed it to a record method or just
           * ack-without-handling. Lets ops answer "did we receive this
           * notification?" independently of the per-event idempotency gate
           * on `purchase_ledger`. UNIQUE on (configurationId, notificationUUID)
           * makes a duplicate webhook delivery a no-op insert — and is also
           * what makes the parked-row write above survive: this second insert
           * collides on the UNIQUE and leaves the parked row's `result`
           * untouched.
           */
          yield* queries.insertNotificationProcessedIfAbsent({
            id: generateId("paymentProviderNotification"),
            notificationSubtype: subtype ?? null,
            notificationType,
            notificationUuid: effectiveNotificationUuid,
            parkedRawPayload: null,
            parkedUntilProviderProductKey: null,
            paymentProviderConfigurationId: input.paymentProviderConfigurationId,
            providerId: "apple-app-store",
            providerOccurredAt,
            result: terminalLedger.result ?? pick(matchResult.handled, "applied", "ignored"),
            resultNote: terminalLedger.resultNote,
            source: "webhook",
          });

          yield* Effect.annotateCurrentSpan({
            "app_store.webhook_result":
              terminalLedger.result ?? pick(matchResult.handled, "applied", "ignored"),
          });
          return matchResult;
        },
        (effect) =>
          effect.pipe(
            /**
             * Product-not-mapped is caught inside the match block above and
             * permanent payload/mapping failures are converted to failed
             * notification ledger rows, so neither reaches this outer pipe.
             */
            Effect.catchIf(Schema.isSchemaError, (error) =>
              Effect.fail(new AppStorePaymentProviderServiceError({ cause: String(error) })),
            ),
            // `InvalidISO4217CurrencyCodeError` and `VerificationError` are
            // already collapsed upstream (in the match block / `handled` and the
            // `Schema.isSchemaError` catch above), so they never reach this outer
            // pipe — TS confirms they're absent from the error union here.
            Effect.catchTags({
              CertificateError: (error) =>
                Effect.fail(new AppStorePaymentProviderServiceError({ cause: error.message })),
              EffectDrizzleQueryError: (error) =>
                Effect.fail(
                  new AppStorePaymentProviderServiceError({ cause: String(error.cause) }),
                ),
              PersonServiceError: (error) =>
                Effect.fail(new AppStorePaymentProviderServiceError({ cause: error.cause })),
              PurchaseProcessingServiceError: (error) =>
                Effect.fail(new AppStorePaymentProviderServiceError({ cause: error.cause })),
            }),
          ),
      );

      const replayWebhookRows = Effect.fn("replayAppStoreWebhookRows")(function* (
        parked: ReadonlyArray<DbPaymentProviderNotificationProcessed>,
      ) {
        const results = yield* Effect.forEach(
          parked,
          Effect.fn("replayAppStoreWebhookRow")(function* (row) {
          const rawPayload = row.parkedRawPayload;
          if (!P.isString(rawPayload)) {
            yield* queries.markParkedNotificationResolved({
              id: row.id,
              result: "failed",
              resultNote: "parked_raw_payload missing or not a string",
            });
            return { appliedCount: 0, failedCount: 1 };
          }
          const replayed = yield* acceptServerNotification({
            isReplay: true,
            paymentProviderConfigurationId: row.paymentProviderConfigurationId,
            receivedAt: yield* DateTime.nowAsDate,
            signedPayload: rawPayload,
          }).pipe(
            Effect.match({
              onFailure: (error) => ({ ok: constant(false), error: replayErrorNote(error) }),
              onSuccess: (result) => ({ handled: result.handled, ok: constant(true) }),
            }),
          );
          if (replayed.ok && replayed.handled) {
            yield* queries.markParkedNotificationResolved({
              id: row.id,
              result: "applied",
              resultNote: null,
            });
            return { appliedCount: 1, failedCount: 0 };
          } else {
            const resultNote = replayed.ok ? "replay completed without applying purchase state" : replayed.error;
            yield* queries.markParkedNotificationAttempted({
              id: row.id,
              resultNote,
            });
            return { appliedCount: 0, failedCount: 1 };
          }
          }),
          { concurrency: 1 },
        );
        return {
          appliedCount: Arr.reduce(results, 0, (count, result) => count + result.appliedCount),
          failedCount: Arr.reduce(results, 0, (count, result) => count + result.failedCount),
          totalParked: Arr.length(parked),
        };
      });

      /**
       * Replays all parked notifications for a `(configurationId,
       * providerProductKey)` mapping. Called after a new
       * `payment_provider_configuration_product` row is created — any
       * notifications that arrived before the mapping existed get re-processed
       * with the now-available mapping.
       *
       * Each parked row's `signedPayload` is run through
       * `acceptServerNotification` (so the full webhook flow applies: decode,
       * verify, dispatch to the right `record*` method). The per-event
       * idempotency gate on `purchase_ledger` makes the replay safe against
       * any live event for the same logical transaction that already arrived.
       * Only an applied state transition clears the parked row. Retryable
       * failures and deliberate no-ops remain pending with attempt metadata.
       *
       * Returns counts so the caller can log a summary.
       */
      const replayParkedNotificationsForProductMapping = Effect.fn(
        "replayParkedNotificationsForProductMapping",
      )(function* (input: {
        readonly paymentProviderConfigurationId: string;
        readonly providerProductKey: string;
      }) {
        yield* Effect.annotateCurrentSpan(
          "voidhash.payment_provider.configuration_id",
          input.paymentProviderConfigurationId,
        );
        yield* Effect.annotateCurrentSpan(
          "voidhash.payment_provider.provider_product_key",
          input.providerProductKey,
        );
        const parked = yield* queries.findParkedNotifications({
          paymentProviderConfigurationId: input.paymentProviderConfigurationId,
          providerProductKey: input.providerProductKey,
        });
        const webhookResult = yield* replayWebhookRows(
          parked.filter((row) => row.source === "webhook"),
        );
        const sdkResults = yield* Effect.forEach(
          parked.filter((candidate) => candidate.source === "sdk"),
          Effect.fn("replayParkedSdkNotification")(function* (row) {
          const decoded = yield* Schema.decodeUnknownEffect(ParkedAppStoreSdkPurchase)(
            row.parkedRawPayload,
          ).pipe(
            Effect.match({
              onFailure: () => ({ _tag: constant("Left") }),
              onSuccess: (right) => ({ _tag: constant("Right"), right }),
            }),
          );
          if (hasTag(decoded, "Left")) {
            yield* queries.markParkedNotificationResolved({
              id: row.id,
              result: "failed",
              resultNote: "parked SDK payload is invalid",
            });
            return { appliedCount: 0, failedCount: 1, totalParked: 1 };
          }
          const payload = decoded.right;
          const replayed = yield* Effect.fn("replayed")(function* () {
            const configuration = yield* queries.findPaymentProviderConfigurationById(
              row.paymentProviderConfigurationId,
            );
            if (!configuration) return yield* Effect.fail("configuration not found");
            const project = yield* queries.findProjectById(configuration.projectId);
            if (!project) return yield* Effect.fail("project not found");
            const verified = yield* transactionVerifier.verify({
              configuration,
              transactionId: payload.transactionId,
            });
            const result = yield* appStorePaymentProvider.recordPurchase({
              configuration,
              decodedRenewalInfo: Option.none(),
              decodedTransaction: verified.decodedTransaction,
              distinctId: payload.distinctId,
              project,
              providerEnvironment: verified.providerEnvironment,
              receivedAt: DateTime.toDateUtc(DateTime.makeUnsafe(payload.receivedAt)),
              sdkTransactionId: payload.transactionId,
              source: "sdk",
            });
            return {
              handled: !result.isIgnored(),
              originalTransactionId: Option.getOrUndefined(
                verified.decodedTransaction.originalTransactionId,
              ),
            };
          })().pipe(
            Effect.match({
              onFailure: (error) => ({ ok: constant(false), error: replayErrorNote(error) }),
              onSuccess: (result) => ({ ok: constant(true), value: result }),
            }),
          );
          if (replayed.ok && replayed.value.handled) {
            yield* queries.markParkedNotificationResolved({
              id: row.id,
              result: "applied",
              resultNote: null,
            });
            if (replayed.value.originalTransactionId) {
              const sdkConfirmationRows =
                yield* queries.findParkedNotificationsByOriginalTransactionId({
                  originalTransactionId: replayed.value.originalTransactionId,
                  paymentProviderConfigurationId: row.paymentProviderConfigurationId,
                });
              const sdkConfirmationResult = yield* replayWebhookRows(sdkConfirmationRows);
              return {
                appliedCount: 1 + sdkConfirmationResult.appliedCount,
                failedCount: sdkConfirmationResult.failedCount,
                totalParked: 1 + sdkConfirmationResult.totalParked,
              };
            }
            return { appliedCount: 1, failedCount: 0, totalParked: 1 };
          } else {
            const resultNote = replayed.ok ? "replay completed without applying purchase state" : replayed.error;
            yield* queries.markParkedNotificationAttempted({
              id: row.id,
              resultNote,
            });
            return { appliedCount: 0, failedCount: 1, totalParked: 1 };
          }
          }),
          { concurrency: 1 },
        );

        const reconciliationResults = yield* Effect.forEach(
          parked.filter((candidate) => candidate.source === "reconciliation"),
          Effect.fn("replayParkedReconciliation")(function* (row) {
          const decoded = yield* Schema.decodeUnknownEffect(ParkedAppStoreReconciliation)(
            row.parkedRawPayload,
          ).pipe(
            Effect.match({
              onFailure: () => ({ _tag: constant("Left") }),
              onSuccess: (right) => ({ _tag: constant("Right"), right }),
            }),
          );
          if (hasTag(decoded, "Left")) {
            yield* queries.markParkedNotificationResolved({
              id: row.id,
              result: "failed",
              resultNote: "parked reconciliation payload is invalid",
            });
            return { appliedCount: 0, failedCount: 1, totalParked: 1 };
          }
          const payload = decoded.right;
          const replayed = yield* reconciliationService
            .reconcileOriginalTransaction({
              originalTransactionId: payload.originalTransactionId,
              paymentProviderConfigurationId: row.paymentProviderConfigurationId,
              reason: payload.reason,
              triggeredAt: DateTime.toDateUtc(DateTime.makeUnsafe(payload.triggeredAt)),
            })
            .pipe(
              Effect.match({
                onFailure: (error) => ({ error: replayErrorNote(error), ok: constant(false) }),
                onSuccess: (report) => ({ ok: constant(true), report }),
              }),
            );
          if (replayed.ok && replayed.report.eventsFailed === 0) {
            yield* queries.markParkedNotificationResolved({
              id: row.id,
              result: "applied",
              resultNote: null,
            });
            return { appliedCount: 1, failedCount: 0, totalParked: 1 };
          } else {
            const resultNote = replayed.ok
              ? `reconciliation still has ${replayed.report.eventsFailed} failed events`
              : replayed.error;
            yield* queries.markParkedNotificationAttempted({
              id: row.id,
              resultNote,
            });
            return { appliedCount: 0, failedCount: 1, totalParked: 1 };
          }
          }),
          { concurrency: 1 },
        );
        const allResults = [
          webhookResult,
          ...sdkResults,
          ...reconciliationResults,
        ];
        const appliedCount = Arr.reduce(
          allResults,
          0,
          (count, result) => count + result.appliedCount,
        );
        const failedCount = Arr.reduce(
          allResults,
          0,
          (count, result) => count + result.failedCount,
        );
        const totalParked = Arr.reduce(
          allResults,
          0,
          (count, result) => count + result.totalParked,
        );
        yield* Effect.annotateCurrentSpan({
          "app_store.failed_count": failedCount,
          "app_store.total_count": totalParked,
        });
        return { appliedCount, failedCount, totalParked };
      });

      /**
       * Replays all notifications parked waiting for the SDK to confirm a
       * given `originalTransactionId`. Triggered by
       * `AppStoreReplayParkedSdkNotificationsWorkflow` from
       * `processSdkTransaction` after a successful `recordPurchase`.
       *
       * Walks parked rows in provider occurrence order to preserve the
       * provider lifecycle — out-of-order safety is also guaranteed by the
       * watermark guards on `subscription.last_event_occurred_at` and
       * `transaction.last_event_occurred_at`. Each row is re-dispatched through
       * `acceptServerNotification`
       * with `isReplay: true` so the SDK-confirmation gate above is bypassed.
       * Per-event idempotency on `purchase_ledger.idempotency_key` makes the
       * replay safe against any live event for the same logical transaction
       * that already arrived (e.g. the SDK call itself).
       */
      const replayParkedNotificationsForSdkConfirmation = Effect.fn(
        "replayParkedNotificationsForSdkConfirmation",
      )(function* (input: {
        readonly paymentProviderConfigurationId: string;
        readonly originalTransactionId: string;
      }) {
        yield* Effect.annotateCurrentSpan(
          "voidhash.transaction.original_id",
          input.originalTransactionId,
        );
        yield* Effect.annotateCurrentSpan(
          "voidhash.payment_provider.configuration_id",
          input.paymentProviderConfigurationId,
        );
        const parked = yield* queries.findParkedNotificationsByOriginalTransactionId({
          originalTransactionId: input.originalTransactionId,
          paymentProviderConfigurationId: input.paymentProviderConfigurationId,
        });
        const result = yield* replayWebhookRows(parked);
        yield* Effect.annotateCurrentSpan({
          "app_store.failed_count": result.failedCount,
          "app_store.total_count": result.totalParked,
        });
        return result;
      });

      return constant({
        acceptServerNotification,
        replayParkedNotificationsForProductMapping,
        replayParkedNotificationsForSdkConfirmation,
      });
    }),
  },
) {
  /** Builds the handler from explicit provider, verifier, and reconciliation services. */
  static layerWithDependencies = Layer.effect(AppStoreWebhookHandlerService)(
    AppStoreWebhookHandlerService.make,
  ).pipe(Layer.provideMerge(AppStorePaymentProviderServiceQueries.layer));

  static layer = AppStoreWebhookHandlerService.layerWithDependencies.pipe(
    Layer.provide(AppStoreWebhookHandlerDependenciesLive),
  );
}

export type { AcceptServerNotificationResult };
