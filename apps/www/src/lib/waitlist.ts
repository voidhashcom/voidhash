import { INTERNAL_FEATURE_FLAGS } from "@voidhash/rpc";

/**
 * Whether Voidhash is currently in waitlist mode.
 *
 * Read from the `waitlist` internal feature flag's *code default* rather than
 * from a resolved per-org value, because the marketing pages and the auth
 * screens run before there is any organization (or even a user) to scope a
 * flag lookup to. Per-organization access is still decided by the resolved
 * flag — see {@link isOrganizationWaitlisted}.
 *
 * Flipping `waitlist.defaultEnabled` to `false` in the flag registry turns the
 * whole system off: the CTAs revert to their normal copy and every
 * organization without an explicit override is let straight into Studio.
 */
export const WAITLIST_MODE = INTERNAL_FEATURE_FLAGS.waitlist.defaultEnabled;

/** The CTA label shown in place of a sign-up call to action while in waitlist mode. */
export const WAITLIST_CTA_LABEL = "Join the waitlist";

/**
 * The label for a call to action that leads to sign-up: the waitlist label
 * while in waitlist mode, otherwise the page's own copy.
 *
 * @example
 * <a href="/auth/sign-up">{signUpCtaLabel("Start for free")}</a>
 */
export const signUpCtaLabel = (defaultLabel: string) =>
  WAITLIST_MODE ? WAITLIST_CTA_LABEL : defaultLabel;

/**
 * Whether an organization is being held on the waitlist and must not be let
 * into Studio. Reads the flags resolved onto the `CurrentUser` bootstrap.
 */
export const isOrganizationWaitlisted = (organization: {
  readonly internalFeatureFlags: readonly string[];
}) => organization.internalFeatureFlags.includes(INTERNAL_FEATURE_FLAGS.waitlist.key);
