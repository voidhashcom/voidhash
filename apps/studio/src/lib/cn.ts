/** Joins truthy class names. A dependency-free stand-in for `clsx`. */
export const cn = (
  ...classes: Array<string | false | null | undefined>
): string => classes.filter(Boolean).join(" ");
