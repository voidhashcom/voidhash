import {
  Db,
  and,
  eq,
  inArray,
  isNotNull,
  paymentProviderConfigurationProducts,
  paymentProviderNotificationProcessed,
  subscriptions,
  transactions,
} from "@voidhash/db";
import * as WorkflowRegistration from "@voidhash/platform/WorkflowRegistration";
import { DateTime, Effect, Layer, Match, Schema } from "effect";

import { AppStoreWebhookHandlerService } from "../services/paymentProviders/appStore/app-store-webhook-handler-service.ts";
import { GooglePlayWebhookHandlerService } from "../services/paymentProviders/googlePlay/webhook-handler-service.ts";
import { googlePlayMappingMatchesProviderProductKey } from "../services/paymentProviders/googlePlay/helpers.ts";
import { StripeWebhookHandlerService } from "../services/paymentProviders/stripe/stripe-webhook-handler-service.ts";
import { PendingRevenueReplaySweep } from "./definitions.ts";
import { appStore, googlePlay, stripe } from "./paymentDependencies.ts";

const SweepResult = Schema.Struct({
  appliedCount: Schema.Number,
  candidateCount: Schema.Number,
  failedCount: Schema.Number,
  totalParked: Schema.Number,
});

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
          let candidateCount = productCandidates.length;
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
            const [subscriptionDependency, transactionDependency] = yield* Effect.all(
              [
                db
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
                  .limit(1),
                db
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
                  .limit(1),
              ],
              { concurrency: "unbounded" },
            );
            if (subscriptionDependency.length === 0 && transactionDependency.length === 0) {
              continue;
            }
            candidateCount++;
            const result = yield* appStoreHandler.replayParkedNotificationsForSdkConfirmation({
              originalTransactionId,
              paymentProviderConfigurationId: candidate.paymentProviderConfigurationId,
            });
            appliedCount += result.appliedCount;
            failedCount += result.failedCount;
            totalParked += result.totalParked;
          }

          const productStripeConfigurations = new Set(
            productCandidates
              .filter((candidate) => candidate.providerId === "stripe")
              .map((candidate) => candidate.paymentProviderConfigurationId),
          );
          for (const candidate of transactionCandidates) {
            if (productStripeConfigurations.has(candidate.paymentProviderConfigurationId)) continue;
            candidateCount++;
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
