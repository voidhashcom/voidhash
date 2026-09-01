import * as WorkflowRegistration from "@voidhash/platform/WorkflowRegistration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import { AppStoreWebhookHandlerService } from "../providers/app-store/app-store-webhook-handler-service.ts";
import { AppStoreReplayParkedNotifications } from "@voidhash/core-v2";
import { appStore } from "./paymentDependencies.ts";

const ReplayResult = Schema.Struct({
  appliedCount: Schema.Number,
  failedCount: Schema.Number,
  totalParked: Schema.Number,
});

/** Durable step name for one App Store product-mapping replay activity. */
export const appStoreReplayParkedStepName = (input: {
  readonly paymentProviderConfigurationId: string;
  readonly providerProductKey: string;
}) => `app-store-replay-parked:${input.paymentProviderConfigurationId}:${input.providerProductKey}`;

/** App Store product-mapping replay registration. */
export const AppStoreReplayParkedNotificationsRegistration = WorkflowRegistration.make(
  AppStoreReplayParkedNotifications,
  {
    dependencies: AppStoreWebhookHandlerService.layer.pipe(Layer.provide(appStore)),
    run: (input, ctx) =>
      ctx.step({
        name: appStoreReplayParkedStepName(input),
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
