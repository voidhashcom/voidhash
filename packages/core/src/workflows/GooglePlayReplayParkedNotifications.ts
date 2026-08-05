import * as WorkflowRegistration from "@voidhash/platform/WorkflowRegistration";
import { Effect, Layer, Schema } from "effect";

import { GooglePlayWebhookHandlerService } from "../services/paymentProviders/googlePlay/webhook-handler-service.ts";
import { GooglePlayReplayParkedNotifications } from "./definitions.ts";
import { googlePlay } from "./paymentDependencies.ts";

const ReplayResult = Schema.Struct({
  appliedCount: Schema.Number,
  failedCount: Schema.Number,
  totalParked: Schema.Number,
});

/** Google Play product-mapping replay registration. */
export const GooglePlayReplayParkedNotificationsRegistration = WorkflowRegistration.make(
  GooglePlayReplayParkedNotifications,
  {
    dependencies: GooglePlayWebhookHandlerService.layer.pipe(Layer.provide(googlePlay)),
    run: (input, ctx) =>
      ctx.step({
        name: `google-play-replay-parked:${input.paymentProviderConfigurationId}:${input.providerProductKey}`,
        success: ReplayResult,
        execute: Effect.gen(function* () {
          const handler = yield* GooglePlayWebhookHandlerService;
          return yield* handler.replayParkedNotificationsForProductMapping({
            paymentProviderConfigurationId: input.paymentProviderConfigurationId,
            providerProductKey: input.providerProductKey,
          });
        }),
      }),
  },
);
