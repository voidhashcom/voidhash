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
      typeof description === "string" &&
      description.length <= HelperValidationUtils.MAXIMUM_DESCRIPTION_LENGTH
    );
  },

  validateDisplayName(displayName: unknown): boolean {
    return (
      typeof displayName === "string" &&
      displayName.length <= HelperValidationUtils.MAXIMUM_DISPLAY_NAME_LENGTH
    );
  },

  validateSku(sku: unknown): boolean {
    return typeof sku === "string" && sku.length <= HelperValidationUtils.MAXIMUM_SKU_LENGTH;
  },

  validatePeriodCount(periodCount: unknown): boolean {
    return (
      typeof periodCount === "number" &&
      periodCount >= HelperValidationUtils.MIN_PERIOD &&
      periodCount <= HelperValidationUtils.MAX_PERIOD
    );
  },

  validateItems(list: unknown): boolean {
    return Array.isArray(list) && list.length > 0 && list.every((item) => item != null);
  },
});
