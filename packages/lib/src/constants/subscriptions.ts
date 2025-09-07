export const SubscriptionStatus = {
  Active: 1,
  Canceled: 2
} as const;

export type SubscriptionStatusValue =
  (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];
