import { useParams } from "@tanstack/react-router";
import type { InternalFeatureFlagKey } from "@voidhash/rpc";

import { useAuth } from "../components/auth-context";

/**
 * Check whether an internal (voidhash-internal) feature flag is enabled for the
 * organization currently in context. Reads the flags resolved on the
 * `CurrentUser` bootstrap (no extra network call) and scopes them to the active
 * `$organizationSlug` route param.
 *
 * Returns `false` when there is no organization in context.
 *
 * @example
 * if (useInternalFeatureFlag(INTERNAL_FEATURE_FLAGS.notifications.key)) {
 *   // render notification management
 * }
 */
export function useInternalFeatureFlag(key: InternalFeatureFlagKey): boolean {
  const { user } = useAuth();
  const { organizationSlug } = useParams({ strict: false });

  if (!organizationSlug) {
    return false;
  }

  const organization = user.organizations.find((org) => org.slug === organizationSlug);
  return organization?.internalFeatureFlags.includes(key) ?? false;
}
