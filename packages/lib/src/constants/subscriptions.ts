export const SUBSCRIPTION_STATUSES = ["active", "canceled"] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];
