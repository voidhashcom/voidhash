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
