/**
 * `AppStoreReconciliationService` walks Apple's authoritative transaction
 * history + subscription status for a given `originalTransactionId` and
 * replays each event through the existing `record*` methods on
 * `AppStorePaymentProvider`. Two callers:
 *
 *  1. **Lazy backfill** — fired from {@link AppStorePaymentProviderService.processSdkTransaction}
 *     on first-seen `originalTransactionId`. Imports the customer's prior
 *     history without waiting for a webhook to arrive (covers RevenueCat
 *     migration and offline-then-reopen scenarios).
 *
 *  2. **Admin RPC repair** — manually triggered when ops needs to recover
 *     a user whose state drifted (rare, but the path needs to exist).
 *
 * Idempotency: every replayed event flows through the same per-event
 * idempotency key as the live webhook would produce
 * (see {@link getAppStorePurchaseProcessingIdempotencyKey}), so a
 * reconciliation collides with any live event already processed via the
 * UNIQUE on `purchase_ledger.idempotency_key`. The watermark guard on
 * `subscription.last_event_occurred_at` ensures a reconciliation that
 * arrives after a fresher live event doesn't regress the projection.
 *
 * All `record*` calls pass `source: "reconciliation"` so ops can tell
 * reconciliation-driven rows from webhook-driven rows in
 * `payment_provider_notification_processed` and `purchase_ledger.source`.
 */
import {
  type GetTransactionHistoryVersion,
  type JWSRenewalInfoDecodedPayload,
  Order,
  ProductType,
  Status,
  TransactionReason,
} from "@voidhash/app-store-server-sdk";
import {
  type PaymentProviderConfiguration as DbPaymentProviderConfiguration,
  type Project as DbProject,
  ProviderEnvironment,
  type ProviderEnvironmentValue,
} from "@voidhash/db";
import { Effect, Layer, Option, Schema, Context } from "effect";

import { constant } from "@voidhash/lib/lang";

import {
  AppStorePaymentProviderProductNotMappedError,
  AppStorePaymentProviderServiceError,
} from "./errors.ts";
import { classifyAppStoreRevocation } from "./helpers.ts";
import { AppStorePaymentProvider } from "./payment-provider.ts";
import { AppStorePaymentProviderServiceQueries } from "./payment-provider-service-queries.ts";
import { generateId } from "@voidhash/core/utils/generate-id";

/**
 * Why we reconciled. Drives logging/telemetry; logic doesn't branch on it.
 */
export type ReconciliationReason = "first_seen" | "admin_repair" | "install_backfill";

export interface ReconciliationReport {
  readonly transactionsProcessed: number;
  readonly statusesProcessed: number;
  readonly eventsApplied: number;
  readonly eventsSkippedIdempotent: number;
  readonly eventsFailed: number;
}

export interface ReconcileOriginalTransactionInput {
  readonly paymentProviderConfigurationId: string;
  readonly originalTransactionId: string;
  readonly triggeredAt: Date;
  readonly reason: ReconciliationReason;
}

export class AppStoreReconciliationServiceError extends Schema.TaggedErrorClass<AppStoreReconciliationServiceError>(
  "AppStoreReconciliationServiceError",
)("AppStoreReconciliationServiceError", { cause: Schema.String }) {}

export class AppStoreReconciliationConfigurationNotFoundError extends Schema.TaggedErrorClass<AppStoreReconciliationConfigurationNotFoundError>(
  "AppStoreReconciliationConfigurationNotFoundError",
)("AppStoreReconciliationConfigurationNotFoundError", {
  paymentProviderConfigurationId: Schema.String,
}) {}

const make = Effect.gen(function* () {
  const queries = yield* AppStorePaymentProviderServiceQueries;
  const appStorePaymentProvider = yield* AppStorePaymentProvider;

  /**
   * Routes a decoded historical transaction to the matching record method.
   * Mirrors the webhook handler's dispatch decisions; lives here separately
   * so reconciliation doesn't depend on the webhook handler's HTTP-shaped
   * `acceptServerNotification` API.
   */
  const _replayHistoricalTransaction = Effect.fn("_replayHistoricalTransaction")(function* (input: {
    readonly configuration: DbPaymentProviderConfiguration;
    readonly project: DbProject;
    readonly providerEnvironment: ProviderEnvironmentValue;
    readonly receivedAt: Date;
    readonly decodedTransaction: Parameters<
      typeof appStorePaymentProvider.recordPurchase
    >[0]["decodedTransaction"];
  }) {
    const recordInput = {
      configuration: input.configuration,
      decodedRenewalInfo: Option.none<JWSRenewalInfoDecodedPayload>(),
      decodedTransaction: input.decodedTransaction,
      notificationUUID: undefined,
      project: input.project,
      providerEnvironment: input.providerEnvironment,
      receivedAt: input.receivedAt,
      source: constant("reconciliation"),
      subtype: undefined,
    };
    const revocationDate = Option.getOrUndefined(input.decodedTransaction.revocationDate);
    if (revocationDate !== undefined) {
      /**
       * Apple uses `revocationDate` for both refunds and Family Sharing
       * revokes. They have opposite revenue semantics, so we discriminate
       * via `revocationType` (with an `inAppOwnershipType` fallback for
       * pre-`revocationType` history) before dispatching.
       */
      const kind = classifyAppStoreRevocation(input.decodedTransaction);
      if (kind === "family_revoke") {
        return yield* appStorePaymentProvider.recordEntitlementRevoked(recordInput);
      }
      return yield* appStorePaymentProvider.recordRefund(recordInput);
    }
    if (Option.getOrUndefined(input.decodedTransaction.type) === ProductType.AUTO_RENEWABLE) {
      const reason = Option.getOrUndefined(input.decodedTransaction.transactionReason);
      if (reason === TransactionReason.RENEWAL) {
        return yield* appStorePaymentProvider.recordSubscriptionRenewed(recordInput);
      }
      return yield* appStorePaymentProvider.recordPurchase(recordInput);
    }
    return yield* appStorePaymentProvider.recordPurchase(recordInput);
  });

  /**
   * Routes a subscription `lastTransactions` status snapshot to the matching
   * record method. The decoded transaction has been verified+decoded by the
   * caller; the `status` integer drives the dispatch.
   */
  const _replayStatusSnapshot = Effect.fn("_replayStatusSnapshot")(function* (input: {
    readonly configuration: DbPaymentProviderConfiguration;
    readonly project: DbProject;
    readonly providerEnvironment: ProviderEnvironmentValue;
    readonly receivedAt: Date;
    readonly status: number;
    readonly decodedTransaction: Parameters<
      typeof appStorePaymentProvider.recordPurchase
    >[0]["decodedTransaction"];
    readonly decodedRenewalInfo: Option.Option<JWSRenewalInfoDecodedPayload>;
  }) {
    const recordInput = {
      configuration: input.configuration,
      decodedRenewalInfo: input.decodedRenewalInfo,
      decodedTransaction: input.decodedTransaction,
      notificationUUID: undefined,
      project: input.project,
      providerEnvironment: input.providerEnvironment,
      receivedAt: input.receivedAt,
      source: constant("reconciliation"),
      subtype: undefined,
    };
    if (input.status === Status.EXPIRED) {
      return yield* appStorePaymentProvider.recordSubscriptionExpired(recordInput);
    }
    if (input.status === Status.REVOKED) {
      return yield* appStorePaymentProvider.recordEntitlementRevoked(recordInput);
    }
    if (input.status === Status.BILLING_RETRY || input.status === Status.BILLING_GRACE_PERIOD) {
      return yield* appStorePaymentProvider.recordBillingRetry(recordInput);
    }
    // Status === ACTIVE: the transaction history walk has already captured
    // every renewal, so nothing to add at the status layer. Auto-renew-off
    // would be a cancel, but the decoded transaction alone doesn't expose
    // that — it lives on the renewal info (which would need a separate
    // `decodeSignedRenewalInfo` call). Out of scope for the on-demand
    // reconciliation path; the live webhook covers it.
    return undefined;
  });

  /**
   * Reconciles a single `originalTransactionId` by walking the full transaction
   * history (ascending, including revoked) and the current subscription
   * status snapshot, replaying each through the existing `record*` methods.
   * Idempotent against any live events already processed for the same logical
   * transactions.
   */
  const reconcileOriginalTransaction = Effect.fn("reconcileOriginalTransaction")(function* (
    input: ReconcileOriginalTransactionInput,
  ) {
    yield* Effect.annotateCurrentSpan(
      "voidhash.transaction.original_id",
      input.originalTransactionId,
    );
    yield* Effect.annotateCurrentSpan(
      "voidhash.payment_provider.configuration_id",
      input.paymentProviderConfigurationId,
    );
    yield* Effect.annotateCurrentSpan({
      "app_store.reconciliation_reason": input.reason,
    });
    const configuration = yield* queries.findPaymentProviderConfigurationById(
      input.paymentProviderConfigurationId,
    );
    if (!configuration) {
      return yield* new AppStoreReconciliationConfigurationNotFoundError({
        paymentProviderConfigurationId: input.paymentProviderConfigurationId,
      });
    }
    const project = yield* queries.findProjectById(configuration.projectId);
    if (!project) {
      return yield* new AppStorePaymentProviderServiceError({
        cause: `Project ${configuration.projectId} not found for configuration ${configuration.id}`,
      });
    }
    yield* Effect.annotateCurrentSpan("voidhash.project.id", project.id);
    yield* Effect.annotateCurrentSpan("voidhash.payment_provider.id", configuration.providerId);
    const sdkContext =
      yield* appStorePaymentProvider.buildSdkContextFromConfiguration(configuration);

    yield* Effect.logInfo("App Store reconciliation: starting", {
      originalTransactionId: input.originalTransactionId,
      paymentProviderConfigurationId: input.paymentProviderConfigurationId,
      reason: input.reason,
    });

    const report = {
      eventsApplied: 0,
      eventsFailed: 0,
      eventsSkippedIdempotent: 0,
      statusesProcessed: 0,
      transactionsProcessed: 0,
    };

    const parkPendingProductMapping = (error: AppStorePaymentProviderProductNotMappedError) =>
      queries.insertNotificationProcessedIfAbsent({
        id: generateId("paymentProviderNotification"),
        notificationSubtype: null,
        notificationType: "RECONCILIATION",
        notificationUuid:
          `reconciliation:${input.originalTransactionId}:${error.providerProductKey}`.slice(0, 255),
        parkedRawPayload: {
          originalTransactionId: input.originalTransactionId,
          reason: input.reason,
          triggeredAt: input.triggeredAt.toISOString(),
        },
        parkedUntilOriginalTransactionId: input.originalTransactionId,
        parkedUntilProviderProductKey: error.providerProductKey,
        paymentProviderConfigurationId: input.paymentProviderConfigurationId,
        providerId: "apple-app-store",
        providerOccurredAt: input.triggeredAt,
        result: "parked_pending_product_mapping",
        resultNote: `reconciliation waiting for product key ${error.providerProductKey}`,
        source: "reconciliation",
      });

    /**
     * Paginate through the full transaction history. Apple's
     * `hasMore=true` continues the walk via `revision`; we follow the chain
     * until the server signals end-of-stream. ASCENDING + `revoked: true`
     * means we see every transaction in original chronological order
     * (including refunded / revoked ones) — that's what reconciliation needs
     * to converge on the same state the live event stream would have built.
     */
    let revision = Option.none<string>();
    let hasMore = true;
    let resolvedEnvironment: ProviderEnvironmentValue = ProviderEnvironment.Production;

    while (hasMore) {
      const { environment, historyResponse } =
        yield* sdkContext.getTransactionHistoryWithEnvironmentFallback(
          input.originalTransactionId,
          revision,
          {
            endDate: Option.none(),
            inAppOwnershipType: Option.none(),
            productIds: Option.none(),
            productTypes: Option.none(),
            revoked: Option.some(true),
            sort: Option.some(Order.ASCENDING),
            startDate: Option.none(),
            subscriptionGroupIdentifiers: Option.none(),
          },
          Option.none<
            (typeof GetTransactionHistoryVersion)[keyof typeof GetTransactionHistoryVersion]
          >(),
        );
      resolvedEnvironment = providerEnvironmentFor(environment);

      const signedTransactions = Option.getOrElse(
        historyResponse.signedTransactions,
        () => noSignedTransactions,
      );
      for (const signed of signedTransactions) {
        const decoded = yield* sdkContext
          .decodeSignedTransaction(signed, environment)
          .pipe(Effect.option);
        if (Option.isNone(decoded)) {
          report.eventsFailed++;
          continue;
        }
        const outcome = yield* _replayHistoricalTransaction({
          configuration,
          decodedTransaction: decoded.value,
          project,
          providerEnvironment: resolvedEnvironment,
          receivedAt: input.triggeredAt,
        }).pipe(
          Effect.match({
            onFailure: (error) => ({
              ok: constant(false),
              error,
            }),
            onSuccess: (result) => ({
              idempotent: result.idempotent,
              ok: constant(true),
            }),
          }),
        );
        report.transactionsProcessed++;
        if (outcome.ok) {
          if (outcome.idempotent) {
            report.eventsSkippedIdempotent++;
          } else {
            report.eventsApplied++;
          }
        } else {
          report.eventsFailed++;
          if (outcome.error instanceof AppStorePaymentProviderProductNotMappedError) {
            yield* parkPendingProductMapping(outcome.error);
          }
          yield* Effect.logWarning("App Store reconciliation: history transaction replay failed", {
            error: String(outcome.error),
            originalTransactionId: input.originalTransactionId,
          });
        }
      }
      hasMore = Option.getOrElse(historyResponse.hasMore, () => false);
      revision = historyResponse.revision;
    }

    /**
     * Subscription status snapshot — the authoritative source for the
     * current `Status` (ACTIVE / EXPIRED / BILLING_RETRY / GRACE / REVOKED)
     * and for AUTO_RENEW state. The transaction history walk above doesn't
     * surface these (status is a separate Apple resource).
     */
    const { environment: statusEnvironment, statusResponse } =
      yield* sdkContext.getAllSubscriptionStatusesWithEnvironmentFallback(
        input.originalTransactionId,
        Option.none<Status[]>(),
      );
    const statusProviderEnvironment = providerEnvironmentFor(statusEnvironment);

    const subscriptionGroups = Option.getOrElse(statusResponse.data, () => []);
    for (const group of subscriptionGroups) {
      const lastTransactions = Option.getOrElse(group.lastTransactions, () => []);
      for (const item of lastTransactions) {
        if (Option.isNone(item.status)) continue;
        const status = item.status.value;
        if (Option.isNone(item.signedTransactionInfo)) continue;
        const signedTransactionInfo = item.signedTransactionInfo.value;
        const decoded = yield* sdkContext
          .decodeSignedTransaction(signedTransactionInfo, statusEnvironment)
          .pipe(Effect.option);
        if (Option.isNone(decoded)) {
          report.eventsFailed++;
          continue;
        }
        /**
         * Best-effort decode of the per-status `signedRenewalInfo` so the
         * reconciliation path can populate grace-period / price-increase
         * fields that live only on renewal info. A failed decode is logged
         * and replaced with `Option.none()` so the snapshot replay still
         * progresses.
         */
        let decodedRenewalInfo = Option.none<JWSRenewalInfoDecodedPayload>();
        if (Option.isSome(item.signedRenewalInfo)) {
          decodedRenewalInfo = yield* sdkContext
            .decodeSignedRenewalInfo(item.signedRenewalInfo.value, statusEnvironment)
            .pipe(
              Effect.map(Option.some),
              Effect.catch((error: unknown) =>
                Effect.logWarning("App Store reconciliation: failed to decode signedRenewalInfo", {
                  cause: error,
                  originalTransactionId: input.originalTransactionId,
                }).pipe(Effect.as(Option.none<JWSRenewalInfoDecodedPayload>())),
              ),
            );
        }
        const outcome = yield* _replayStatusSnapshot({
          configuration,
          decodedRenewalInfo,
          decodedTransaction: decoded.value,
          project,
          providerEnvironment: statusProviderEnvironment,
          receivedAt: input.triggeredAt,
          status,
        }).pipe(
          Effect.match({
            onFailure: (error) => ({
              ok: constant(false),
              error,
            }),
            onSuccess: (result) => {
              // ACTIVE status is a no-op (the history walk covers renewals)
              // — _replayStatusSnapshot returns undefined for it, which we
              // count as already-up-to-date for telemetry purposes.
              const idempotent = idempotentFlag(result);
              return { idempotent, ok: constant(true) };
            },
          }),
        );
        report.statusesProcessed++;
        if (outcome.ok) {
          if (outcome.idempotent) {
            report.eventsSkippedIdempotent++;
          } else {
            report.eventsApplied++;
          }
        } else {
          report.eventsFailed++;
          if (outcome.error instanceof AppStorePaymentProviderProductNotMappedError) {
            yield* parkPendingProductMapping(outcome.error);
          }
          yield* Effect.logWarning("App Store reconciliation: status snapshot replay failed", {
            error: String(outcome.error),
            originalTransactionId: input.originalTransactionId,
          });
        }
      }
      /**
       * `AutoRenewStatus` is decoded above when `signedRenewalInfo` is
       * present (Option.some(...) in `decodedRenewalInfo`). Mapping it
       * onto cancel / resume mutations would require new record paths in
       * `_replayStatusSnapshot`; the live `DID_CHANGE_RENEWAL_STATUS`
       * webhook still covers it today.
       */
    }

    yield* Effect.logInfo("App Store reconciliation: complete", {
      ...report,
      originalTransactionId: input.originalTransactionId,
      paymentProviderConfigurationId: input.paymentProviderConfigurationId,
    });

    const finalReport: ReconciliationReport = report;
    yield* Effect.annotateCurrentSpan({
      "app_store.applied_count": finalReport.eventsApplied,
      "app_store.failed_count": finalReport.eventsFailed,
    });
    return finalReport;
  });

  return constant({
    reconcileOriginalTransaction,
  });
});

/** Empty history page, typed so `Option.getOrElse` keeps its element type. */
const noSignedTransactions: ReadonlyArray<string> = [];

/** Maps Apple's environment label onto our stored provider environment. */
const providerEnvironmentFor = (environment: string): ProviderEnvironmentValue => {
  if (environment === "Sandbox") return ProviderEnvironment.Sandbox;
  return ProviderEnvironment.Production;
};

/**
 * ACTIVE status is a no-op (the history walk covers renewals) — the replay
 * returns nothing for it, which counts as already-up-to-date for telemetry.
 */
const idempotentFlag = (result: { readonly idempotent?: boolean } | null | undefined): boolean =>
  result?.idempotent ?? true;

export class AppStoreReconciliationService extends Context.Service<AppStoreReconciliationService>()(
  "@voidhash/backend/purchases/AppStoreReconciliationService",
  { make },
) {
  static readonly layer = Layer.effect(AppStoreReconciliationService)(
    AppStoreReconciliationService.make,
  ).pipe(Layer.provideMerge(AppStorePaymentProviderServiceQueries.layer));
}
