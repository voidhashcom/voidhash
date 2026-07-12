import { ProductType, type ProductTypeValue } from "@voidhash/lib";

/**
 * Public-facing product type label used by `ProductService` outputs. Matches
 * the API contract literal union; consumers map to richer client types
 * downstream as needed.
 */
export type ProductTypeLabel = "subscription" | "one-time" | "one-time-consumable";

export interface ProductView {
  readonly id: string;
  readonly name: string;
  readonly projectId: string;
  readonly slug: string;
  readonly type: ProductTypeLabel;
}

export const dbProductTypeToLabel = (type: ProductTypeValue): ProductTypeLabel => {
  if (type === ProductType.Subscription) {
    return "subscription";
  }
  if (type === ProductType.OneTime) {
    return "one-time";
  }
  if (type === ProductType.OneTimeConsumable) {
    return "one-time-consumable";
  }
  throw new Error(`Invalid product type: ${type}`);
};
