/**
 * Internal language-level helpers. Deliberately not re-exported from
 * `src/index.ts` — they exist so ordinary TypeScript in this package can stay
 * free of type assertions without widening the public API.
 */

/**
 * Literal-preserving identity function — the assertion-free replacement for
 * `x as const`. A `const` type parameter keeps the literal and readonly-tuple
 * inference that a const assertion provided; `satisfies` would widen it.
 */
export const constant = <const T>(value: T): T => value;

/**
 * Strips `readonly` so a value can be assembled field by field before being
 * returned in its readonly shape.
 */
export type Mutable<T> = { -readonly [K in keyof T]: T[K] };
