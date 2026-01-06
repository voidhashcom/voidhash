/**
 * Converts a numeric value to a pixel string.
 * Returns 0 as "0" (no unit needed), otherwise appends "px".
 */
export function px(value: number): string {
  return value === 0 ? '0' : `${value}px`;
}

/**
 * Converts a numeric value to a pixel string, or returns 'auto' if null/undefined.
 */
export function pxOrAuto(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return 'auto';
  }
  return px(value);
}
