import type { ProductType } from "@voidhash/api-spec";
import {
  ProductType as ProductTypeEnum,
  type ProductTypeValue,
} from "@voidhash/lib";

export function dbProductTypeToApiProductType(
  type: ProductTypeValue
): typeof ProductType.Type {
  if (type === ProductTypeEnum.Subscription) {
    return "subscription";
  }
  if (type === ProductTypeEnum.OneTime) {
    return "one-time";
  }
  if (type === ProductTypeEnum.OneTimeConsumable) {
    return "one-time-consumable";
  }

  throw new Error(`Invalid product type: ${type}`);
}
