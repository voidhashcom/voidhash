import { Context, type Effect } from "effect";

/** Identifies the new product mapping whose parked Google Play notifications to replay. */
export interface GooglePlayReplayParkedNotificationsInput {
  readonly paymentProviderConfigurationId: string;
  readonly paymentProviderProductId: string;
  readonly providerProductKey: string;
}

/**
 * Abstract workflow for replaying parked Google Play notifications. `dispatch`
 * runs fire-and-forget when a new `(configuration, providerProduct)` mapping
 * appears; the concrete adapter (a Cloudflare Workflow) is wired at the
 * application root, keeping the infrastructure dependency out of
 * `packages/core`.
 */
export class GooglePlayReplayParkedNotificationsWorkflow extends Context.Service<
  GooglePlayReplayParkedNotificationsWorkflow,
  {
    readonly dispatch: (input: GooglePlayReplayParkedNotificationsInput) => Effect.Effect<void>;
  }
>()("GooglePlayReplayParkedNotificationsWorkflow") {}
