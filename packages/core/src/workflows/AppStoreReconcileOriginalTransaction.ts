import * as WorkflowRegistration from "@voidhash/platform/WorkflowRegistration";
import { Effect, Layer, Schema } from "effect";

import { AppStoreReconciliationService } from "../services/paymentProviders/appStore/app-store-reconciliation-service.ts";
import { AppStorePaymentProvider } from "../services/paymentProviders/appStore/payment-provider.ts";
import { AppStoreReconcileOriginalTransaction } from "./definitions.ts";
import { appStore } from "./paymentDependencies.ts";

const ReconciliationResult = Schema.Struct({
  eventsApplied: Schema.Number,
  eventsFailed: Schema.Number,
  eventsSkippedIdempotent: Schema.Number,
  statusesProcessed: Schema.Number,
  transactionsProcessed: Schema.Number,
});

/** App Store authoritative-history reconciliation registration. */
export const AppStoreReconcileOriginalTransactionRegistration = WorkflowRegistration.make(
  AppStoreReconcileOriginalTransaction,
  {
    dependencies: AppStoreReconciliationService.layer.pipe(
      Layer.provide(AppStorePaymentProvider.layer),
      Layer.provide(appStore),
    ),
    run: (input, ctx) =>
      ctx.step({
        name: `app-store-reconcile:${input.paymentProviderConfigurationId}:${input.originalTransactionId}:${input.reason}`,
        success: ReconciliationResult,
        retry: "none",
        execute: Effect.gen(function* () {
          const reconciliation = yield* AppStoreReconciliationService;
          return yield* reconciliation.reconcileOriginalTransaction({
            originalTransactionId: input.originalTransactionId,
            paymentProviderConfigurationId: input.paymentProviderConfigurationId,
            reason: input.reason,
            triggeredAt: new Date(input.triggeredAt),
          });
        }),
      }),
  },
);
