import { SubscriptionStatus } from "@voidhash/lib";

import { ProviderEnvironment } from "@voidhash/db";

export const providerEnvironmentLabel = (environment: number): string =>
  environment === ProviderEnvironment.Sandbox ? "sandbox" : "production";

export const subscriptionStatusForInactiveEvent = () => SubscriptionStatus.Canceled;
