export type FlagType = "boolean" | "string" | "number" | "json";

export const FLAG_TYPE_LABELS: Record<FlagType, string> = {
  boolean: "Boolean",
  json: "JSON",
  number: "Number",
  string: "String",
};

/**
 * Type name as it reads mid-sentence ("Enter a valid JSON value"). Lowercasing
 * the display label would turn the JSON initialism into "json".
 */
export const FLAG_TYPE_NOUNS: Record<FlagType, string> = {
  boolean: "boolean",
  json: "JSON",
  number: "number",
  string: "string",
};
