import { Context, type Effect } from "effect";

/** Identifies the new product mapping whose parked App Store notifications to replay. */
export interface AppStoreReplayParkedNotificationsInput {
  readonly paymentProviderConfigurationId: string;
  readonly paymentProviderProductId: string;
  readonly providerProductKey: string;
}

/**
 * Abstract workflow for replaying parked App Store notifications. `dispatch`
 * runs fire-and-forget when a new `(configuration, providerProduct)` mapping
 * appears; the concrete adapter (a Cloudflare Workflow) is wired at the
 * application root, keeping the infrastructure dependency out of
 * `packages/core`.
 */
export class AppStoreReplayParkedNotificationsWorkflow extends Context.Service<
  AppStoreReplayParkedNotificationsWorkflow,
  {
    readonly dispatch: (input: AppStoreReplayParkedNotificationsInput) => Effect.Effect<void>;
  }
>()("AppStoreReplayParkedNotificationsWorkflow") {}
