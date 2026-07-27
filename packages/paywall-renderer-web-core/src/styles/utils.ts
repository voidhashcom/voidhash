/**
 * Converts a numeric value to a pixel string.
 * Returns 0 as "0" (no unit needed), otherwise appends "px".
 */
export function px(value: number): string {
  return value === 0 ? "0" : `${value}px`;
}

/**
 * Converts a numeric value to a pixel string. The explicit `"auto"` literal
 * (hug contents) and absent values pass through as the CSS keyword "auto".
 */
export function pxOrAuto(value: number | "auto" | undefined): string {
  if (value === "auto" || value === undefined) {
    return "auto";
  }
  return px(value);
}
