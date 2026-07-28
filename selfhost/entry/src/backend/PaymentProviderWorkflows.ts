import { AppStoreWebhookHandlerService } from "@voidhash/core/services/paymentProviders/appStore/app-store-webhook-handler-service";
import { AppStoreReconciliationService } from "@voidhash/core/services/paymentProviders/appStore/app-store-reconciliation-service";
import { GooglePlayWebhookHandlerService } from "@voidhash/core/services/paymentProviders/googlePlay/webhook-handler-service";
import { StripeWebhookHandlerService } from "@voidhash/core/services/paymentProviders/stripe/stripe-webhook-handler-service";
import { IdentifyDistinctIdCompletionWorkflow } from "@voidhash/core/services/personIdentity/IdentifyDistinctIdCompletionWorkflow";
import { Db } from "@voidhash/db";
import { WorkflowRunner } from "@orbian/sdk/Workflow";
import { Effect, Layer, Schema } from "effect";

import {
  makeAppStoreReconciliationLive,
  makeAppStoreReplayHandlerLive,
  makeGooglePlayReplayHandlerLive,
  makeStripeReplayHandlerLive,
} from "./PaymentWorkflowLayers.ts";
import {
  AppStoreReconcileOriginalTransactionDefinition,
  AppStoreReplayParkedNotificationsDefinition,
  AppStoreReplayParkedSdkNotificationsDefinition,
  GooglePlayReplayParkedNotificationsDefinition,
  StripeReplayParkedNotificationsDefinition,
} from "./WorkflowDefinitions.ts";

/** Registers the durable self-host payment-provider replay and reconciliation jobs. */
export const registerPaymentProviderWorkflows = (
  runner: WorkflowRunner["Service"],
  database: Layer.Layer<Db>,
  completion: IdentifyDistinctIdCompletionWorkflow["Service"],
) => {
  const appStoreReplay = makeAppStoreReplayHandlerLive(database);
  const appStoreReconciliation = makeAppStoreReconciliationLive(database);
  const googlePlayReplay = makeGooglePlayReplayHandlerLive(database);
  const stripeReplay = makeStripeReplayHandlerLive(database);
  const provideCompletion = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    effect.pipe(
      Effect.provideService(IdentifyDistinctIdCompletionWorkflow, completion),
    );

  return Effect.all(
    [
      runner.register(
        AppStoreReplayParkedNotificationsDefinition,
        (input, context) =>
          context.step({
            name: `app-store-replay:${input.paymentProviderConfigurationId}:${input.providerProductKey}`,
            success: Schema.Void,
            execute: provideCompletion(
              Effect.gen(function* () {
                const handler = yield* AppStoreWebhookHandlerService;
                yield* handler.replayParkedNotificationsForProductMapping(input);
              }).pipe(Effect.provide(appStoreReplay)),
            ),
          }),
      ),
      runner.register(
        AppStoreReplayParkedSdkNotificationsDefinition,
        (input, context) =>
          context.step({
            name: `app-store-replay-sdk:${input.paymentProviderConfigurationId}:${input.originalTransactionId}`,
            success: Schema.Void,
            execute: provideCompletion(
              Effect.gen(function* () {
                const handler = yield* AppStoreWebhookHandlerService;
                yield* handler.replayParkedNotificationsForSdkConfirmation(input);
              }).pipe(Effect.provide(appStoreReplay)),
            ),
          }),
      ),
      runner.register(
        AppStoreReconcileOriginalTransactionDefinition,
        (input, context) =>
          context.step({
            name: `app-store-reconcile:${input.paymentProviderConfigurationId}:${input.originalTransactionId}:${input.reason}`,
            success: Schema.Void,
            execute: provideCompletion(
              Effect.gen(function* () {
                const reconciliation = yield* AppStoreReconciliationService;
                yield* reconciliation.reconcileOriginalTransaction({
                  ...input,
                  triggeredAt: new Date(input.triggeredAt),
                });
              }).pipe(Effect.provide(appStoreReconciliation)),
            ),
          }),
      ),
      runner.register(
        GooglePlayReplayParkedNotificationsDefinition,
        (input, context) =>
          context.step({
            name: `google-play-replay:${input.paymentProviderConfigurationId}:${input.providerProductKey}`,
            success: Schema.Void,
            execute: provideCompletion(
              Effect.gen(function* () {
                const handler = yield* GooglePlayWebhookHandlerService;
                yield* handler.replayParkedNotificationsForProductMapping(input);
              }).pipe(Effect.provide(googlePlayReplay)),
            ),
          }),
      ),
      runner.register(
        StripeReplayParkedNotificationsDefinition,
        (input, context) =>
          context.step({
            name: `stripe-replay:${input.paymentProviderConfigurationId}:${input.providerProductKey}`,
            success: Schema.Void,
            execute: provideCompletion(
              Effect.gen(function* () {
                const handler = yield* StripeWebhookHandlerService;
                yield* handler.replayParkedNotificationsForProductMapping(input);
              }).pipe(Effect.provide(stripeReplay)),
            ),
          }),
      ),
    ],
    { concurrency: "unbounded", discard: true },
  );
};
