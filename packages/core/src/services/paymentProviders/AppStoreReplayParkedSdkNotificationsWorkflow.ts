import { Context, type Effect } from "effect";

/**
 * Identifies the `originalTransactionId` series whose notifications, parked
 * pending SDK confirmation, should now be replayed.
 */
export interface AppStoreReplayParkedSdkNotificationsInput {
  readonly paymentProviderConfigurationId: string;
  readonly originalTransactionId: string;
}

/**
 * Abstract workflow for replaying App Store notifications parked under the
 * per-tenant `trackNewPurchasesFromAppleServerNotifications = false` mode
 * (lifecycle webhooks held back until the SDK confirms the series). `dispatch`
 * runs after `processSdkTransaction` records a purchase; the concrete adapter
 * (a Cloudflare Workflow) is wired at the application root, keeping the
 * infrastructure dependency out of `packages/core`.
 */
export class AppStoreReplayParkedSdkNotificationsWorkflow extends Context.Service<
  AppStoreReplayParkedSdkNotificationsWorkflow,
  {
    readonly dispatch: (input: AppStoreReplayParkedSdkNotificationsInput) => Effect.Effect<void>;
  }
>()("AppStoreReplayParkedSdkNotificationsWorkflow") {}
