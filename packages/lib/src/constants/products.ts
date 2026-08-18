import { constant } from "../lang/index.ts";

export const ProductType = constant({
  OneTime: 2,
  OneTimeConsumable: 3,
  Subscription: 1,
});

export type ProductTypeValue = (typeof ProductType)[keyof typeof ProductType];

export const ProductTypeLabels: Record<ProductTypeValue, string> = {
  [ProductType.Subscription]: "Subscription",
  [ProductType.OneTime]: "Non-consumable",
  [ProductType.OneTimeConsumable]: "Consumable",
};

export const SubscriptionDuration = constant({
  Weekly: 1,
  Monthly: 2,
  Quarterly: 3,
  SemiAnnual: 4,
  Annual: 5,
});

export type SubscriptionDurationValue =
  (typeof SubscriptionDuration)[keyof typeof SubscriptionDuration];

export const SubscriptionDurationLabels: Record<SubscriptionDurationValue, string> = {
  [SubscriptionDuration.Weekly]: "Weekly",
  [SubscriptionDuration.Monthly]: "Monthly",
  [SubscriptionDuration.Quarterly]: "Quarterly",
  [SubscriptionDuration.SemiAnnual]: "Every six months",
  [SubscriptionDuration.Annual]: "Annual",
};
