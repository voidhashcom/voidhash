import { constant } from "../lang/index.ts";

export const SubscriptionStatus = constant({
  Active: 1,
  Canceled: 2,
});

export type SubscriptionStatusValue = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];
