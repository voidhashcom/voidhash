/**
 * Small language-level helpers that let ordinary TypeScript satisfy the
 * `oxlint-plugin-effect` recommended preset without losing type precision.
 *
 * These are deliberately dependency-free and side-effect-free so they are safe
 * to use from Workers, React, React Native and Node alike.
 */

/**
 * Literal-preserving identity function — the replacement for `x as const`.
 *
 * `satisfies` cannot stand in for a const assertion: it checks a value against a
 * type but still widens the inferred type (`{ mode: "dark" } satisfies Config`
 * infers `mode: string`). A `const` type parameter keeps the literal and readonly
 * tuple inference that `as const` provided, with no assertion.
 *
 * @example
 * const PLANS = constant({ free: "free", pro: "pro" }); // { readonly free: "free"; readonly pro: "pro" }
 * const HOSTS = constant(["pkg.voidha.sh"]);            // readonly ["pkg.voidha.sh"]
 */
export const constant = <const T>(value: T): T => value;

/**
 * Extracts a human-readable message from an unknown caught/`Cause` value.
 *
 * Replaces the `cause instanceof Error ? cause.message : String(cause)` ternary
 * that appears at most error-mapping boundaries.
 */
export const causeMessage = (cause: unknown): string => {
  if (cause instanceof Error) return cause.message;
  return String(cause);
};

/**
 * Returns `value` when it is a string, otherwise `fallback`.
 *
 * Replaces `typeof value === "string" ? value : fallback` when reading untyped
 * environment or JSON boundaries.
 */
export const stringOr = (value: unknown, fallback: string): string => {
  if (typeof value === "string") return value;
  return fallback;
};

/**
 * Returns `value` when it is a finite number, otherwise `fallback`.
 *
 * Replaces `typeof value === "number" ? value : fallback`.
 */
export const numberOr = (value: unknown, fallback: number): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return fallback;
};

/**
 * Selects between two values without a conditional expression.
 *
 * Use only where `&&`/`??` are wrong because the falsy branch is a meaningful
 * value (`0`, `""`, `undefined`, `"none"`) — typically JSX attribute values such
 * as `pointerEvents={pick(visible, "auto", "none")}`.
 */
export const pick = <A, B>(condition: boolean, onTrue: A, onFalse: B): A | B => {
  if (condition) return onTrue;
  return onFalse;
};
