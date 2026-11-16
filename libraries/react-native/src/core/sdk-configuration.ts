/**
 * Whether the end user agreed to usage analytics. `denied` and `pending` act
 * the same: nothing analytics-related is captured, stored or sent. Purchases,
 * restores, entitlements, identity, flags and paywalls are unaffected.
 */
export type AnalyticsConsent = "granted" | "denied" | "pending";

/** Whether `value` is one of the {@link AnalyticsConsent} values. */
export const isAnalyticsConsent = (value: unknown): value is AnalyticsConsent =>
  value === "granted" || value === "denied" || value === "pending";

/** What happens to analytics captured while consent is `"pending"`. */
export type AnalyticsWhilePending = "drop" | "buffer";
