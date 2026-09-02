import * as Arr from "effect/Array";
import * as P from "effect/Predicate";
import { constant } from "@voidhash/lib/lang";

/**
 * Field-length and shape constraints used by the Advanced Commerce API schemas.
 * Mirrors the validators in Apple's reference Node library so the same inputs
 * accepted upstream pass our schema validation.
 */
export const HelperValidationUtils = constant({
  MAXIMUM_DESCRIPTION_LENGTH: 45,
  MAXIMUM_DISPLAY_NAME_LENGTH: 30,
  MAXIMUM_SKU_LENGTH: 128,
  MIN_PERIOD: 1,
  MAX_PERIOD: 12,

  validateDescription(description: unknown): boolean {
    return (
      P.isString(description) &&
      description.length <= HelperValidationUtils.MAXIMUM_DESCRIPTION_LENGTH
    );
  },

  validateDisplayName(displayName: unknown): boolean {
    return (
      P.isString(displayName) &&
      displayName.length <= HelperValidationUtils.MAXIMUM_DISPLAY_NAME_LENGTH
    );
  },

  validateSku(sku: unknown): boolean {
    return P.isString(sku) && sku.length <= HelperValidationUtils.MAXIMUM_SKU_LENGTH;
  },

  validatePeriodCount(periodCount: unknown): boolean {
    return (
      P.isNumber(periodCount) &&
      periodCount >= HelperValidationUtils.MIN_PERIOD &&
      periodCount <= HelperValidationUtils.MAX_PERIOD
    );
  },

  validateItems(list: unknown): boolean {
    return (
      Array.isArray(list) && Arr.isReadonlyArrayNonEmpty(list) && list.every((item) => item != null)
    );
  },
});
