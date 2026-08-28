import { SubscriptionStatus } from "@voidhash/lib";

export const providerEnvironmentLabel = (environment: number): string => {
  if (environment === 3) {
    return "development";
  }
  if (environment === 2) {
    return "sandbox";
  }
  return "production";
};

export const subscriptionStatusForInactiveEvent = () => SubscriptionStatus.Canceled;
