import * as WorkflowRegistration from "@voidhash/platform/WorkflowRegistration";
import { Effect, Layer, Schema } from "effect";

import { StripeWebhookHandlerService } from "../services/paymentProviders/stripe/stripe-webhook-handler-service.ts";
import { StripeReplayParkedNotifications } from "./definitions.ts";
import { stripe } from "./paymentDependencies.ts";

const ReplayResult = Schema.Struct({
  appliedCount: Schema.Number,
  failedCount: Schema.Number,
  totalParked: Schema.Number,
});

/** Stripe product-mapping replay registration. */
export const StripeReplayParkedNotificationsRegistration = WorkflowRegistration.make(
  StripeReplayParkedNotifications,
  {
    dependencies: StripeWebhookHandlerService.layer.pipe(Layer.provide(stripe)),
    run: (input, ctx) =>
      ctx.step({
        name: `stripe-replay-parked:${input.paymentProviderConfigurationId}:${input.providerProductKey}`,
        success: ReplayResult,
        execute: Effect.gen(function* () {
          const handler = yield* StripeWebhookHandlerService;
          return yield* handler.replayParkedNotificationsForProductMapping({
            paymentProviderConfigurationId: input.paymentProviderConfigurationId,
            providerProductKey: input.providerProductKey,
          });
        }),
      }),
  },
);
