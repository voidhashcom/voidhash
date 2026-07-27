import { Context, type Effect } from "effect";

/** Identifies the new product mapping whose parked Stripe events to replay. */
export interface StripeReplayParkedNotificationsInput {
  readonly paymentProviderConfigurationId: string;
  readonly paymentProviderProductId: string;
  readonly providerProductKey: string;
}

/**
 * Abstract workflow for replaying parked Stripe webhook events. `dispatch` runs
 * fire-and-forget when a new `(configuration, providerProduct)` mapping appears;
 * the concrete adapter (a Cloudflare Workflow) is wired at the application root,
 * keeping the infrastructure dependency out of `packages/core`. Mirrors
 * {@link AppStoreReplayParkedNotificationsWorkflow}.
 */
export class StripeReplayParkedNotificationsWorkflow extends Context.Service<
  StripeReplayParkedNotificationsWorkflow,
  {
    readonly dispatch: (input: StripeReplayParkedNotificationsInput) => Effect.Effect<void>;
  }
>()("StripeReplayParkedNotificationsWorkflow") {}
