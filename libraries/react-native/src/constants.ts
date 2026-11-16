/**
 * Prefix of the anonymous ids the SDK creates, `vh_anon_<uuid>`: only letters,
 * digits, `_` and `-`, so the id fits any payment provider's field.
 */
export const ANONYMOUS_DISTINCT_ID_PREFIX = "vh_anon_";

/** Prefix of the anonymous ids earlier SDK builds created, which a stored id may still carry. */
export const LEGACY_ANONYMOUS_DISTINCT_ID_PREFIX = "vh:anon:";

/**
 * Whether a distinct id is one the SDK made for an anonymous end user: `vh_anon_<uuid>`, or the
 * `vh:anon:` form a device may still hold from an earlier SDK build. Use it instead of checking a
 * prefix, for example to sign out only an identified person.
 */
export const isAnonymousDistinctId = (distinctId: string): boolean =>
  distinctId.startsWith(ANONYMOUS_DISTINCT_ID_PREFIX) ||
  distinctId.startsWith(LEGACY_ANONYMOUS_DISTINCT_ID_PREFIX);
