/**
 * Returns the first argument that is a non-empty string, skipping `null`,
 * `undefined`, and empty strings. Returns `null` when none qualify. Useful for
 * coalescing optional profile fields (e.g. picking an email/name from several
 * candidate sources in priority order).
 */
export const firstDefinedString = (
  ...values: ReadonlyArray<string | null | undefined>
): string | null => {
  for (const value of values) {
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return null;
};
