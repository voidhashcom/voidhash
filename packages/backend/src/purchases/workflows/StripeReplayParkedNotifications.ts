import * as WorkflowRegistration from "@voidhash/platform/WorkflowRegistration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import { StripeWebhookHandlerService } from "../providers/stripe/stripe-webhook-handler-service.ts";
import { StripeReplayParkedNotifications } from "@voidhash/core-v2";
import { stripe } from "./paymentDependencies.ts";

const ReplayResult = Schema.Struct({
  appliedCount: Schema.Number,
  failedCount: Schema.Number,
  totalParked: Schema.Number,
});

/** Durable step name for one Stripe product-mapping replay activity. */
export const stripeReplayParkedStepName = (input: {
  readonly paymentProviderConfigurationId: string;
  readonly providerProductKey: string;
}) => `stripe-replay-parked:${input.paymentProviderConfigurationId}:${input.providerProductKey}`;

/** Stripe product-mapping replay registration. */
export const StripeReplayParkedNotificationsRegistration = WorkflowRegistration.make(
  StripeReplayParkedNotifications,
  {
    dependencies: StripeWebhookHandlerService.layer.pipe(Layer.provide(stripe)),
    run: (input, ctx) =>
      ctx.step({
        name: stripeReplayParkedStepName(input),
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
