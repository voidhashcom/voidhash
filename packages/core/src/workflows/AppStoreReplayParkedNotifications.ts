import * as WorkflowRegistration from "@voidhash/platform/WorkflowRegistration";
import { Effect, Layer, Schema } from "effect";

import { AppStoreWebhookHandlerService } from "../services/paymentProviders/appStore/app-store-webhook-handler-service.ts";
import { AppStoreReplayParkedNotifications } from "./definitions.ts";
import { appStore } from "./paymentDependencies.ts";

const ReplayResult = Schema.Struct({
  appliedCount: Schema.Number,
  failedCount: Schema.Number,
  totalParked: Schema.Number,
});

/** App Store product-mapping replay registration. */
export const AppStoreReplayParkedNotificationsRegistration = WorkflowRegistration.make(
  AppStoreReplayParkedNotifications,
  {
    dependencies: AppStoreWebhookHandlerService.layer.pipe(Layer.provide(appStore)),
    run: (input, ctx) =>
      ctx.step({
        name: `app-store-replay-parked:${input.paymentProviderConfigurationId}:${input.providerProductKey}`,
        success: ReplayResult,
        execute: Effect.gen(function* () {
          const handler = yield* AppStoreWebhookHandlerService;
          return yield* handler.replayParkedNotificationsForProductMapping({
            paymentProviderConfigurationId: input.paymentProviderConfigurationId,
            providerProductKey: input.providerProductKey,
          });
        }),
      }),
  },
);
