import * as WorkflowRegistration from "@voidhash/platform/WorkflowRegistration";
import { Effect, Layer, Schema } from "effect";

import { AppStoreWebhookHandlerService } from "../services/paymentProviders/appStore/app-store-webhook-handler-service.ts";
import { AppStoreReplayParkedSdkNotifications } from "./definitions.ts";
import { appStore } from "./paymentDependencies.ts";

const ReplayResult = Schema.Struct({
  appliedCount: Schema.Number,
  failedCount: Schema.Number,
  totalParked: Schema.Number,
});

/** App Store SDK-confirmation replay registration. */
export const AppStoreReplayParkedSdkNotificationsRegistration = WorkflowRegistration.make(
  AppStoreReplayParkedSdkNotifications,
  {
    dependencies: AppStoreWebhookHandlerService.layer.pipe(Layer.provide(appStore)),
    run: (input, ctx) =>
      ctx.step({
        name: `app-store-replay-parked-sdk:${input.paymentProviderConfigurationId}:${input.originalTransactionId}`,
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
