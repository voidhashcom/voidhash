import * as WorkflowRegistration from "@voidhash/platform/WorkflowRegistration";
import { Effect, Layer, Schema } from "effect";

import { GooglePlayWebhookHandlerService } from "../providers/google-play/webhook-handler-service.ts";
import { GooglePlayReplayParkedNotifications } from "@voidhash/core-v2";
import { googlePlay } from "./paymentDependencies.ts";

const ReplayResult = Schema.Struct({
  appliedCount: Schema.Number,
  failedCount: Schema.Number,
  totalParked: Schema.Number,
});

/** Durable step name for one Google Play product-mapping replay activity. */
export const googlePlayReplayParkedStepName = (input: {
  readonly paymentProviderConfigurationId: string;
  readonly providerProductKey: string;
}) =>
  `google-play-replay-parked:${input.paymentProviderConfigurationId}:${input.providerProductKey}`;

/** Google Play product-mapping replay registration. */
export const GooglePlayReplayParkedNotificationsRegistration = WorkflowRegistration.make(
  GooglePlayReplayParkedNotifications,
  {
    dependencies: GooglePlayWebhookHandlerService.layer.pipe(Layer.provide(googlePlay)),
    run: (input, ctx) =>
      ctx.step({
        name: googlePlayReplayParkedStepName(input),
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
