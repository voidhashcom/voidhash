import {
  Db,
  and,
  eq,
  gte,
  inArray,
  isNotNull,
  lt,
  or,
  paymentProviderConfigurationProducts,
  paymentProviderNotificationProcessed,
  sql,
  subscriptions,
  transactions,
} from "@voidhash/db";
import * as WorkflowRegistration from "@voidhash/platform/WorkflowRegistration";
import { DateTime, Effect, Layer, Match, Schema } from "effect";

import { AppStoreWebhookHandlerService } from "../providers/app-store/app-store-webhook-handler-service.ts";
import { GooglePlayWebhookHandlerService } from "../providers/google-play/webhook-handler-service.ts";
import { googlePlayMappingMatchesProviderProductKey } from "../providers/google-play/helpers.ts";
import { StripeWebhookHandlerService } from "../providers/stripe/stripe-webhook-handler-service.ts";
import { PendingRevenueReplaySweep } from "@voidhash/core-v2";
import { appStore, googlePlay, stripe } from "./paymentDependencies.ts";

const SweepResult = Schema.Struct({
  appliedCount: Schema.Number,
  candidateCount: Schema.Number,
  failedCount: Schema.Number,
  totalParked: Schema.Number,
});

/**
 * Retention bounds for product-mapping / transaction parks (the
 * sdk-confirmation flavor has its own daily expiry workflow). Without them a
 * permanently failing row would be retried by this 5-minute sweep forever.
 * The attempt counter only advances when a replay actually runs and fails, so
 * the cap trips on persistent replay failures, not on waiting for a mapping.
 */
const PARKED_TTL_DAYS = 90;
const PARKED_MAX_ATTEMPTS = 100;
const dayMillis = 24 * 60 * 60 * 1_000;

interface ProductReplayCandidateIdentity {
  readonly paymentProviderConfigurationId: string;
  readonly providerId: string;
}

interface TransactionReplayCandidate {
  readonly paymentProviderConfigurationId: string;
}

/** Builds the sweep's stable candidate count and removes Stripe transaction replays already covered by a product replay. */
export const makePendingRevenueReplayCandidatePlan = (
  productCandidates: ReadonlyArray<ProductReplayCandidateIdentity>,
  sdkConfirmationCandidateCount: number,
  transactionCandidates: ReadonlyArray<TransactionReplayCandidate>,
) => {
  const productStripeConfigurations = new Set(
    productCandidates
      .filter((candidate) => candidate.providerId === "stripe")
      .map((candidate) => candidate.paymentProviderConfigurationId),
  );
  const standaloneTransactionCandidates = transactionCandidates.filter(
    (candidate) => !productStripeConfigurations.has(candidate.paymentProviderConfigurationId),
  );
  return {
    candidateCount:
      productCandidates.length +
      sdkConfirmationCandidateCount +
      standaloneTransactionCandidates.length,
    transactionCandidates: standaloneTransactionCandidates,
  };
};

const dependencies = Layer.mergeAll(
  AppStoreWebhookHandlerService.layer.pipe(Layer.provide(appStore)),
  GooglePlayWebhookHandlerService.layer.pipe(Layer.provide(googlePlay)),
  StripeWebhookHandlerService.layer.pipe(Layer.provide(stripe)),
);

/** Periodic safety net for replay dispatch failures and late transaction dependencies. */
export const PendingRevenueReplaySweepRegistration = WorkflowRegistration.make(
  PendingRevenueReplaySweep,
  {
    dependencies,
    cron: {
      schedule: "*/5 * * * *",
      payload: (scheduledTime) => ({ runId: scheduledTime.toISOString() }),
    },
    run: (input, ctx) =>
      ctx.step({
        name: `pending-revenue-replay-sweep:${input.runId}`,
        success: SweepResult,
        execute: Effect.gen(function* () {
          const db = yield* Db;
          const appStoreHandler = yield* AppStoreWebhookHandlerService;
          const googlePlayHandler = yield* GooglePlayWebhookHandlerService;
          const stripeHandler = yield* StripeWebhookHandlerService;

          // Age out parked rows past the TTL or the attempt cap before
          // selecting candidates, so a poisoned row cannot be retried forever.
          const nowMillis = DateTime.toEpochMillis(yield* DateTime.now);
          const parkedOlderThan = DateTime.toDateUtc(
            DateTime.makeUnsafe(nowMillis - PARKED_TTL_DAYS * dayMillis),
          );
          const expiredRows = yield* db
            .update(paymentProviderNotificationProcessed)
            .set({
              parkedRawPayload: null,
              parkedUntilOriginalTransactionId: null,
              parkedUntilProviderProductKey: null,
              processedAt: sql`NOW()`,
              result: "expired",
              resultNote: `auto-expired parked row (${PARKED_TTL_DAYS}d TTL or ${PARKED_MAX_ATTEMPTS}-attempt cap exceeded)`,
            })
            .where(
              and(
                inArray(paymentProviderNotificationProcessed.result, [
                  "parked_pending_product_mapping",
                  "parked_pending_transaction",
                ]),
                or(
                  lt(paymentProviderNotificationProcessed.processedAt, parkedOlderThan),
                  gte(paymentProviderNotificationProcessed.attemptCount, PARKED_MAX_ATTEMPTS),
                ),
              ),
            )
            .returning({ id: paymentProviderNotificationProcessed.id });
          if (expiredRows.length > 0) {
            yield* Effect.logWarning("Pending revenue replay sweep expired parked rows", {
              expiredCount: expiredRows.length,
            });
          }
          yield* Effect.annotateCurrentSpan(
            "voidhash.pending_revenue.expired_count",
            expiredRows.length,
          );

          const parkedProductGroups = yield* db
            .select({
              paymentProviderConfigurationId:
                paymentProviderNotificationProcessed.paymentProviderConfigurationId,
              providerId: paymentProviderNotificationProcessed.providerId,
              providerProductKey:
                paymentProviderNotificationProcessed.parkedUntilProviderProductKey,
            })
            .from(paymentProviderNotificationProcessed)
            .where(
              eq(paymentProviderNotificationProcessed.result, "parked_pending_product_mapping"),
            )
            .groupBy(
              paymentProviderNotificationProcessed.paymentProviderConfigurationId,
              paymentProviderNotificationProcessed.providerId,
              paymentProviderNotificationProcessed.parkedUntilProviderProductKey,
            );

          const activeMappings = yield* db
            .select({
              paymentProviderConfigurationId:
                paymentProviderConfigurationProducts.paymentProviderConfigurationId,
              providerProductKey: paymentProviderConfigurationProducts.providerProductKey,
            })
            .from(paymentProviderConfigurationProducts)
            .where(eq(paymentProviderConfigurationProducts.isActive, true));

          const mappingKeysByConfiguration = new Map<string, string[]>();
          for (const mapping of activeMappings) {
            const keys = mappingKeysByConfiguration.get(mapping.paymentProviderConfigurationId);
            if (keys) keys.push(mapping.providerProductKey);
            else
              mappingKeysByConfiguration.set(mapping.paymentProviderConfigurationId, [
                mapping.providerProductKey,
              ]);
          }

          const productCandidatesByKey = new Map<
            string,
            {
              readonly paymentProviderConfigurationId: string;
              readonly providerId: string;
              readonly providerProductKey: string;
            }
          >();
          for (const parked of parkedProductGroups) {
            const parkedKey = parked.providerProductKey;
            if (!parkedKey) continue;
            const mappingKeys =
              mappingKeysByConfiguration.get(parked.paymentProviderConfigurationId) ?? [];
            let replayKey = mappingKeys.find((key) => key === parkedKey);
            if (!replayKey && parked.providerId === "google-play") {
              replayKey = mappingKeys.find((key) =>
                googlePlayMappingMatchesProviderProductKey(key, parkedKey),
              );
            }
            if (!replayKey) continue;
            const candidate = {
              paymentProviderConfigurationId: parked.paymentProviderConfigurationId,
              providerId: parked.providerId,
              providerProductKey: replayKey,
            };
            productCandidatesByKey.set(
              `${candidate.paymentProviderConfigurationId}\u0000${candidate.providerId}\u0000${replayKey}`,
              candidate,
            );
          }
          const productCandidates = [...productCandidatesByKey.values()];

          const transactionCandidates = yield* db
            .select({
              paymentProviderConfigurationId:
                paymentProviderNotificationProcessed.paymentProviderConfigurationId,
            })
            .from(paymentProviderNotificationProcessed)
            .where(eq(paymentProviderNotificationProcessed.result, "parked_pending_transaction"))
            .groupBy(paymentProviderNotificationProcessed.paymentProviderConfigurationId);

          const sdkConfirmationGroups = yield* db
            .select({
              originalTransactionId:
                paymentProviderNotificationProcessed.parkedUntilOriginalTransactionId,
              paymentProviderConfigurationId:
                paymentProviderNotificationProcessed.paymentProviderConfigurationId,
            })
            .from(paymentProviderNotificationProcessed)
            .where(
              and(
                eq(paymentProviderNotificationProcessed.providerId, "apple-app-store"),
                eq(paymentProviderNotificationProcessed.result, "parked_pending_sdk_confirmation"),
                isNotNull(paymentProviderNotificationProcessed.parkedUntilOriginalTransactionId),
              ),
            )
            .groupBy(
              paymentProviderNotificationProcessed.paymentProviderConfigurationId,
              paymentProviderNotificationProcessed.parkedUntilOriginalTransactionId,
            );

          let appliedCount = 0;
          let sdkConfirmationCandidateCount = 0;
          let failedCount = 0;
          let totalParked = 0;
          for (const candidate of productCandidates) {
            const providerProductKey = candidate.providerProductKey;
            if (!providerProductKey) continue;
            const result = yield* Match.value(candidate.providerId).pipe(
              Match.when("apple-app-store", () =>
                appStoreHandler.replayParkedNotificationsForProductMapping({
                  paymentProviderConfigurationId: candidate.paymentProviderConfigurationId,
                  providerProductKey,
                }),
              ),
              Match.when("google-play", () =>
                googlePlayHandler.replayParkedNotificationsForProductMapping({
                  paymentProviderConfigurationId: candidate.paymentProviderConfigurationId,
                  providerProductKey,
                }),
              ),
              Match.when("stripe", () =>
                stripeHandler.replayParkedNotificationsForProductMapping({
                  paymentProviderConfigurationId: candidate.paymentProviderConfigurationId,
                  providerProductKey,
                }),
              ),
              Match.orElse(() =>
                Effect.succeed({ appliedCount: 0, failedCount: 0, totalParked: 0 }),
              ),
            );
            appliedCount += result.appliedCount;
            failedCount += result.failedCount;
            totalParked += result.totalParked;
          }

          for (const candidate of sdkConfirmationGroups) {
            const originalTransactionId = candidate.originalTransactionId;
            if (!originalTransactionId) continue;
            const subscriptionDependency = yield* db
              .select({ id: subscriptions.id })
              .from(subscriptions)
              .innerJoin(
                paymentProviderConfigurationProducts,
                eq(
                  subscriptions.paymentProviderConfigurationProductId,
                  paymentProviderConfigurationProducts.id,
                ),
              )
              .where(
                and(
                  eq(
                    paymentProviderConfigurationProducts.paymentProviderConfigurationId,
                    candidate.paymentProviderConfigurationId,
                  ),
                  eq(subscriptions.storeSubscriptionId, originalTransactionId),
                ),
              )
              .limit(1);
            const transactionDependency = yield* db
              .select({ id: transactions.id })
              .from(transactions)
              .innerJoin(
                paymentProviderConfigurationProducts,
                eq(
                  transactions.paymentProviderConfigurationProductId,
                  paymentProviderConfigurationProducts.id,
                ),
              )
              .where(
                and(
                  eq(
                    paymentProviderConfigurationProducts.paymentProviderConfigurationId,
                    candidate.paymentProviderConfigurationId,
                  ),
                  eq(transactions.storeTransactionId, originalTransactionId),
                ),
              )
              .limit(1);
            if (subscriptionDependency.length === 0 && transactionDependency.length === 0) {
              continue;
            }
            sdkConfirmationCandidateCount++;
            const result = yield* appStoreHandler.replayParkedNotificationsForSdkConfirmation({
              originalTransactionId,
              paymentProviderConfigurationId: candidate.paymentProviderConfigurationId,
            });
            appliedCount += result.appliedCount;
            failedCount += result.failedCount;
            totalParked += result.totalParked;
          }

          const candidatePlan = makePendingRevenueReplayCandidatePlan(
            productCandidates,
            sdkConfirmationCandidateCount,
            transactionCandidates,
          );
          const candidateCount = candidatePlan.candidateCount;
          for (const candidate of candidatePlan.transactionCandidates) {
            const result = yield* stripeHandler.replayParkedTransactionNotifications(candidate);
            appliedCount += result.appliedCount;
            failedCount += result.failedCount;
            totalParked += result.totalParked;
          }

          const remainingBacklog = yield* db
            .select({
              attemptCount: paymentProviderNotificationProcessed.attemptCount,
              paymentProviderConfigurationId:
                paymentProviderNotificationProcessed.paymentProviderConfigurationId,
              processedAt: paymentProviderNotificationProcessed.processedAt,
              providerId: paymentProviderNotificationProcessed.providerId,
              providerOccurredAt: paymentProviderNotificationProcessed.providerOccurredAt,
              providerProductKey:
                paymentProviderNotificationProcessed.parkedUntilProviderProductKey,
              result: paymentProviderNotificationProcessed.result,
            })
            .from(paymentProviderNotificationProcessed)
            .where(
              inArray(paymentProviderNotificationProcessed.result, [
                "parked_pending_product_mapping",
                "parked_pending_sdk_confirmation",
                "parked_pending_transaction",
              ]),
            );
          const now = DateTime.toEpochMillis(yield* DateTime.now);
          const oldestOccurredAt = remainingBacklog.reduce(
            (oldest, row) =>
              Math.min(oldest, (row.providerOccurredAt ?? row.processedAt).getTime()),
            now,
          );
          let oldestAgeSeconds = 0;
          if (remainingBacklog.length > 0) {
            oldestAgeSeconds = Math.max(0, (now - oldestOccurredAt) / 1_000);
          }
          const maxAttemptCount = remainingBacklog.reduce(
            (maximum, row) => Math.max(maximum, row.attemptCount),
            0,
          );
          yield* Effect.annotateCurrentSpan({
            "voidhash.pending_revenue.applied_count": appliedCount,
            "voidhash.pending_revenue.backlog_count": remainingBacklog.length,
            "voidhash.pending_revenue.failed_count": failedCount,
            "voidhash.pending_revenue.max_attempt_count": maxAttemptCount,
            "voidhash.pending_revenue.oldest_age_seconds": oldestAgeSeconds,
          });
          const summary = {
            appliedCount,
            candidateCount,
            failedCount,
            maxAttemptCount,
            oldestAgeSeconds,
            remainingBacklogCount: remainingBacklog.length,
          };
          yield* Effect.logInfo("Pending revenue replay sweep complete", summary);
          if (remainingBacklog.length > 0) {
            const groups = new Map<string, number>();
            for (const row of remainingBacklog) {
              const key = [
                row.providerId,
                row.paymentProviderConfigurationId,
                row.providerProductKey ?? "",
                row.result,
              ].join(":");
              groups.set(key, (groups.get(key) ?? 0) + 1);
            }
            yield* Effect.logWarning("Pending revenue replay backlog remains", {
              ...summary,
              groups: [...groups].map(([key, count]) => ({ count, key })),
            });
          }

          return {
            appliedCount,
            candidateCount,
            failedCount,
            totalParked,
          };
        }),
      }),
  },
);
