import { SubscriptionStatus } from "@voidhash/lib";

import { ProviderEnvironment } from "@voidhash/db";

export const providerEnvironmentLabel = (environment: number): string => {
  if (environment === ProviderEnvironment.Development) {
    return "development";
  }
  if (environment === ProviderEnvironment.Sandbox) {
    return "sandbox";
  }
  return "production";
};

export const subscriptionStatusForInactiveEvent = () => SubscriptionStatus.Canceled;
