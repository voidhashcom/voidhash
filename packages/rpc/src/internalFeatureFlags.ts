/**
 * Internal feature flags — our own (voidhash-internal) gates for unreleased
 * product features, rolled out per-organization to internal teams and select
 * external orgs from overwatch.
 *
 * This is the single source of truth for *which* flags exist and their *code
 * default*. Per-organization on/off overrides are stored in the database
 * (`internal_feature_flag_override`) and layered on top of these defaults by
 * `InternalFeatureFlagService` in `@voidhash/core`.
 *
 * This module is intentionally dependency-free so it can be imported from the
 * frontend (`apps/www`), the backend, and `@voidhash/core` without
 * pulling in any runtime.
 *
 * ⚠️ Not to be confused with the customer-facing feature-flag *product*
 * (`FeatureFlagRpcsDef` / `featureFlags` table / SDK `evaluate-flags`), which
 * voidhash sells to its customers. That system is project-scoped and evaluated
 * per end-user; this one is org-scoped and gates our own product surface.
 */

/** A single internal feature flag definition. */
export interface InternalFeatureFlagDefinition {
  /** Stable wire key, persisted in overrides and checked at call-sites. */
  readonly key: string;
  /** Human-readable name shown in the overwatch admin UI. */
  readonly name: string;
  /** Short description of what the flag gates, shown in overwatch. */
  readonly description: string;
  /**
   * The value used when an organization has no explicit override. Flip to
   * `true` to ship a flag to everyone, then delete the flag once it is fully
   * launched and removed from all call-sites.
   */
  readonly defaultEnabled: boolean;
}

/**
 * The registry of available internal feature flags. Add an entry here to make
 * a new flag toggleable in overwatch and checkable on the server/frontend.
 */
export const INTERNAL_FEATURE_FLAGS = {
  notifications: {
    key: "notifications",
    name: "Notifications",
    description: "Enable push notification configuration, device registration, and delivery.",
    defaultEnabled: false,
  },
  voidqlQuery: {
    key: "voidql_query",
    name: "VoidQL Query",
    description:
      "The analytics → Query page: run read-only VoidQL queries against the project's analytics.",
    defaultEnabled: false,
  },
  experimentation: {
    key: "experimentation",
    name: "Experimentation",
    description:
      "The Experimentation suite in the studio sidebar: the Feature Flags product and A/B Tests.",
    defaultEnabled: false,
  },
  voidhashAi: {
    key: "voidhash_ai",
    name: "Voidhash AI",
    description:
      "The Voidhash AI agent: the chat panel in the paywall designer that can edit code components and paywall composition.",
    defaultEnabled: false,
  },
} as const satisfies Record<string, InternalFeatureFlagDefinition>;

/** All internal feature flag definitions as a list (e.g. for admin listings). */
export const INTERNAL_FEATURE_FLAG_LIST: readonly InternalFeatureFlagDefinition[] =
  Object.values(INTERNAL_FEATURE_FLAGS);

/** The union of valid internal feature flag keys (for type-safe checks). */
export type InternalFeatureFlagKey =
  (typeof INTERNAL_FEATURE_FLAGS)[keyof typeof INTERNAL_FEATURE_FLAGS]["key"];

/** Whether a string is a known internal feature flag key. */
export const isInternalFeatureFlagKey = (key: string): key is InternalFeatureFlagKey =>
  INTERNAL_FEATURE_FLAG_LIST.some((flag) => flag.key === key);
