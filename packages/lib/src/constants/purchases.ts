export const PurchaseType = {
  OneTime: 1,
  OneTimeConsumable: 2,
} as const;

export type PurchaseTypeValue =
  (typeof PurchaseType)[keyof typeof PurchaseType];
