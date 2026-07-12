export type FlagType = "boolean" | "multivariant" | "json";

export function deriveFlagType(variants: readonly { payload?: unknown }[]): FlagType {
  if (variants.length === 0) {
    return "boolean";
  }
  if (
    variants.length === 1 &&
    variants[0]?.payload !== null &&
    variants[0]?.payload !== undefined
  ) {
    return "json";
  }
  return "multivariant";
}

export function deriveFlagTypeFromCount(variantCount: number): FlagType {
  if (variantCount === 0) {
    return "boolean";
  }
  return "multivariant";
}

export const FLAG_TYPE_LABELS: Record<FlagType, string> = {
  boolean: "Boolean",
  json: "JSON",
  multivariant: "Multi-variant",
};
