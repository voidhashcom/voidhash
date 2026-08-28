import * as WorkflowRegistration from "@voidhash/platform/WorkflowRegistration";
import { Effect, Layer, Schema } from "effect";

import { AppStoreWebhookHandlerService } from "../providers/app-store/app-store-webhook-handler-service.ts";
import { AppStoreReplayParkedSdkNotifications } from "@voidhash/core-v2";
import { appStore } from "./paymentDependencies.ts";

const ReplayResult = Schema.Struct({
  appliedCount: Schema.Number,
  failedCount: Schema.Number,
  totalParked: Schema.Number,
});

/** Durable step name for one App Store SDK-confirmation replay activity. */
export const appStoreReplayParkedSdkStepName = (input: {
  readonly originalTransactionId: string;
  readonly paymentProviderConfigurationId: string;
}) =>
  `app-store-replay-parked-sdk:${input.paymentProviderConfigurationId}:${input.originalTransactionId}`;

/** App Store SDK-confirmation replay registration. */
export const AppStoreReplayParkedSdkNotificationsRegistration = WorkflowRegistration.make(
  AppStoreReplayParkedSdkNotifications,
  {
    dependencies: AppStoreWebhookHandlerService.layer.pipe(Layer.provide(appStore)),
    run: (input, ctx) =>
      ctx.step({
        name: appStoreReplayParkedSdkStepName(input),
        success: ReplayResult,
        execute: Effect.gen(function* () {
          const handler = yield* AppStoreWebhookHandlerService;
          return yield* handler.replayParkedNotificationsForSdkConfirmation({
            originalTransactionId: input.originalTransactionId,
            paymentProviderConfigurationId: input.paymentProviderConfigurationId,
          });
        }),
      }),
  },
);
