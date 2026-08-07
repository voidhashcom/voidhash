import { constant } from "../lang/index.ts";

export const PurchaseType = constant({
  OneTime: 1,
  OneTimeConsumable: 2,
});

export type PurchaseTypeValue = (typeof PurchaseType)[keyof typeof PurchaseType];
