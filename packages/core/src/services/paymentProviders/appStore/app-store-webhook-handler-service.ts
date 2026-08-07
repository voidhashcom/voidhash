import {
  Environment,
  type JWSRenewalInfoDecodedPayload,
  NotificationTypeV2,
} from "@voidhash/app-store-server-sdk";
import { generateId } from "../../../utils/index.ts";
import { ProviderEnvironment } from "@voidhash/db";
import { constant, pick, stringOr } from "@voidhash/lib/lang";
import { DateTime, Effect, Layer, Match, Option, Predicate, Schema, Context } from "effect";

import {
  AppStorePaymentProviderConfigurationNotFoundError,
  AppStorePaymentProviderProductNotMappedError,
  AppStorePaymentProviderProjectNotFoundError,
  AppStorePaymentProviderServiceError,
} from "./errors.ts";
import { AppStorePaymentProvider, globalConfigurationSchema } from "./payment-provider.ts";
import { AppStorePaymentProviderServiceQueries } from "./payment-provider-service-queries.ts";

const truncateResultNote = (note: string): string => note.slice(0, 500);

const optionSpanAttribute = <A>(
  value: Option.Option<A>,
  map: (value: A) => unknown = (some) => some,
): unknown =>
  Option.match(value, { onNone: () => undefined, onSome: (some) => map(some) });

const hasErrorTag = <TTag extends string>(
  error: unknown,
  tag: TTag,
): error is { readonly _tag: TTag } =>
  Predicate.hasProperty(error, "_tag") && error._tag === tag;

/** Reads `key` off an unknown error as a string, or `fallback` when absent. */
const errorProperty = (error: unknown, key: string, fallback: string): string => {
  if (Predicate.hasProperty(error, key)) {
    return String(error[key]);
  }
  return fallback;
};

const verificationStatus = (error: unknown): string => errorProperty(error, "status", "unknown");

/** Tags `handled` collapses into a terminal record-failure ledger row. */
const TERMINAL_RECORD_FAILURE_TAGS = new Set<string>([
  "AppStorePaymentProviderTransactionMissingPersonIdentifierError",
  "AppStorePurchaseProcessingIdempotencyKeyDerivationError",
  "InvalidISO4217CurrencyCodeError",
]);

const isTerminalRecordFailure = (error: unknown): boolean =>
  Predicate.hasProperty(error, "_tag") &&
  typeof error._tag === "string" &&
  TERMINAL_RECORD_FAILURE_TAGS.has(error._tag);

/**
 * Builds the terminal-failure ledger note for the record errors `handled`
 * collapses. Reads tag-specific fields defensively (the catch narrows by
 * predicate only, so the concrete field set isn't statically known) so no cast
 * is needed.
 */
const describeTransactionSuffix = (error: unknown): string => {
  if (!Predicate.hasProperty(error, "providerTransactionId")) return "";
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
  readonly notificationType: string | undefined;
  readonly notificationUUID: string | undefined;
  readonly subtype: string | undefined;
};

export class AppStoreWebhookHandlerService extends Context.Service<AppStoreWebhookHandlerService>()(
  "AppStoreWebhookHandlerService",
  {
    make: Effect.gen(function* () {
      const queries = yield* AppStorePaymentProviderServiceQueries;
      const appStorePaymentProvider = yield* AppStorePaymentProvider;

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
           * `trackNewPurchasesFromAppleServerNotifications` flag is available
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
              yield* Effect.logWarning(
                "App Store notification rejected as terminal verification failure",
                {
                  paymentProviderConfigurationId: input.paymentProviderConfigurationId,
                  status: verificationStatus(error),
                },
              );
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

          let terminalLedgerResult: "failed" | undefined;
          let terminalLedgerResultNote: string | null = null;

          const markTerminalRecordFailure = (reason: string) =>
            Effect.gen(function* () {
              terminalLedgerResult = "failed";
              terminalLedgerResultNote = truncateResultNote(reason);
              yield* Effect.annotateCurrentSpan({
                "app_store.webhook_result": "failed",
              });
              yield* Effect.logWarning("App Store notification record failed permanently", {
                notificationType,
                notificationUUID,
                paymentProviderConfigurationId: input.paymentProviderConfigurationId,
                resultNote: terminalLedgerResultNote,
                subtype,
              });
              return ack(false);
            });

          const writeTerminalFailure = (reason: string) =>
            Effect.gen(function* () {
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
            });

          if (!notificationType) {
            return ack(false);
          }

          const signedTransactionInfo = Option.getOrUndefined(
            Option.flatMap(notification.data, (data) => data.signedTransactionInfo),
          );

          /**
           * Notification kinds that carry purchase state require a signed
           * transaction; only test pings legitimately arrive without one.
           */
          if (!signedTransactionInfo) {
            if (notificationType === NotificationTypeV2.TEST) {
              yield* Effect.annotateCurrentSpan({
                "app_store.webhook_result": "test_without_transaction",
              });
              return ack(true);
            }
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
           * When `trackNewPurchasesFromAppleServerNotifications` is `false`,
           * webhooks must not create purchases on their own — the tenant
           * tracks only the SDK-confirmed subset. To avoid losing notifications
           * that race ahead of the SDK call, we park them keyed on
           * `originalTransactionId` and replay them in arrival order once
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
            !parsedGlobalConfiguration.trackNewPurchasesFromAppleServerNotifications;
          const originalTransactionId = Option.getOrUndefined(
            decodedTransaction.originalTransactionId,
          );
          if (!input.isReplay && deferReplay && originalTransactionId && notificationUUID) {
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
                notificationUuid: notificationUUID,
                parkedRawPayload: input.signedPayload,
                parkedUntilOriginalTransactionId: originalTransactionId,
                parkedUntilProviderProductKey: null,
                paymentProviderConfigurationId: input.paymentProviderConfigurationId,
                providerId: "apple-app-store",
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
          const handled = <A, E, R>(
            recordEffect: Effect.Effect<A, E | AppStorePaymentProviderProductNotMappedError, R>,
          ) =>
            recordEffect.pipe(
              Effect.as(ack(true)),
              // `handled` is generic over the record method's error channel `E`,
              // so `catchTag`/`catchTags` can't prove these tags are members of
              // it (and would need an `any` widening that poisons every caller's
              // inferred `R` to `unknown`). Narrow with tag guards instead — same
              // runtime behaviour, precise types.
              Effect.catchIf(
                (error): error is AppStorePaymentProviderProductNotMappedError =>
                  Predicate.hasProperty(error, "_tag") &&
                  error._tag === "AppStorePaymentProviderProductNotMappedError",
                (error) =>
                  Effect.gen(function* () {
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
                    if (notificationUUID) {
                      yield* queries.insertNotificationProcessedIfAbsent({
                        id: generateId("paymentProviderNotification"),
                        notificationSubtype: subtype ?? null,
                        notificationType,
                        notificationUuid: notificationUUID,
                        parkedRawPayload: input.signedPayload,
                        parkedUntilProviderProductKey: error.providerProductKey,
                        paymentProviderConfigurationId: input.paymentProviderConfigurationId,
                        providerId: "apple-app-store",
                        result: "parked_pending_product_mapping",
                        resultNote: `product key ${error.providerProductKey} not mapped at notification time`,
                        source: "webhook",
                      });
                    }
                    return ack(true);
                  }),
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

            /** Test ping triggered via `requestTestNotification`. */
            Match.when(NotificationTypeV2.TEST, () => Effect.succeed(ack(true))),

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
          if (notificationUUID) {
            yield* queries.insertNotificationProcessedIfAbsent({
              id: generateId("paymentProviderNotification"),
              notificationSubtype: subtype ?? null,
              notificationType,
              notificationUuid: notificationUUID,
              parkedRawPayload: null,
              parkedUntilProviderProductKey: null,
              paymentProviderConfigurationId: input.paymentProviderConfigurationId,
              providerId: "apple-app-store",
              result: terminalLedgerResult ?? pick(matchResult.handled, "applied", "ignored"),
              resultNote: terminalLedgerResultNote,
              source: "webhook",
            });
          }

          yield* Effect.annotateCurrentSpan({
            "app_store.webhook_result":
              terminalLedgerResult ?? pick(matchResult.handled, "applied", "ignored"),
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
       * After replay, the parked row is marked `"applied"` (or `"failed"` if
       * processing surfaced an error) and its parked-state columns cleared.
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
        let appliedCount = 0;
        let failedCount = 0;
        for (const row of parked) {
          const rawPayload = row.parkedRawPayload;
          if (typeof rawPayload !== "string") {
            yield* queries.markParkedNotificationResolved({
              id: row.id,
              result: "failed",
              resultNote: "parked_raw_payload missing or not a string",
            });
            failedCount++;
            continue;
          }
          const replayed = yield* acceptServerNotification({
            isReplay: true,
            paymentProviderConfigurationId: input.paymentProviderConfigurationId,
            receivedAt: yield* DateTime.nowAsDate,
            signedPayload: rawPayload,
          }).pipe(
            Effect.match({
              onFailure: (error) => ({ ok: constant(false), error: String(error) }),
              onSuccess: () => ({ ok: constant(true) }),
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
        yield* Effect.annotateCurrentSpan({
          "app_store.failed_count": failedCount,
          "app_store.total_count": parked.length,
        });
        return { appliedCount, failedCount, totalParked: parked.length };
      });

      /**
       * Replays all notifications parked waiting for the SDK to confirm a
       * given `originalTransactionId`. Triggered by
       * `AppStoreReplayParkedSdkNotificationsWorkflow` from
       * `processSdkTransaction` after a successful `recordPurchase`.
       *
       * Walks parked rows in `processedAt ASC` order to reproduce wire
       * arrival order — out-of-order safety is also guaranteed by the
       * watermark guards on `subscription.last_event_occurred_at` and
       * `transaction.last_event_occurred_at`, but reproducing wire order
       * keeps the analytics/event stream faithful to what Apple actually
       * delivered. Each row is re-dispatched through `acceptServerNotification`
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
        let appliedCount = 0;
        let failedCount = 0;
        for (const row of parked) {
          const rawPayload = row.parkedRawPayload;
          if (typeof rawPayload !== "string") {
            yield* queries.markParkedNotificationResolved({
              id: row.id,
              result: "failed",
              resultNote: "parked_raw_payload missing or not a string",
            });
            failedCount++;
            continue;
          }
          const replayed = yield* acceptServerNotification({
            isReplay: true,
            paymentProviderConfigurationId: input.paymentProviderConfigurationId,
            receivedAt: yield* DateTime.nowAsDate,
            signedPayload: rawPayload,
          }).pipe(
            Effect.match({
              onFailure: (error) => ({ ok: constant(false), error: String(error) }),
              onSuccess: () => ({ ok: constant(true) }),
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
        yield* Effect.annotateCurrentSpan({
          "app_store.failed_count": failedCount,
          "app_store.total_count": parked.length,
        });
        return { appliedCount, failedCount, totalParked: parked.length };
      });

      return constant({
        acceptServerNotification,
        replayParkedNotificationsForProductMapping,
        replayParkedNotificationsForSdkConfirmation,
      });
    }),
  },
) {
  static layer = Layer.effect(AppStoreWebhookHandlerService)(
    AppStoreWebhookHandlerService.make,
  ).pipe(Layer.provideMerge(AppStorePaymentProvider.layer));
}

export type { AcceptServerNotificationResult };
