/**
 * Waitlist policy for the community build: there is no waitlist.
 *
 * The waitlist is a hosted-cloud growth mechanism — it holds newly created
 * organizations on a screen until we grant access. A self-hosted deployment has
 * no one to grant that access, so gating it behind the `waitlist` internal
 * feature flag (which defaults to *on*, since the flag's polarity is inverted:
 * enabled means blocked) would lock every operator out of their own Studio.
 *
 * Hosts that run a waitlist replace this module — see `apps/www/vite.config.ts`
 * in voidhash-mono, which aliases it to the flag-reading implementation. The
 * exports below are that module's contract.
 */

/** Whether this build is in waitlist mode. Never true for the community build. */
export const WAITLIST_MODE: boolean = false;

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
 * into Studio. Always `false` here: the community build admits every
 * organization, whatever the backend resolved for the `waitlist` flag.
 */
export const isOrganizationWaitlisted = (_organization: {
  readonly internalFeatureFlags: readonly string[];
}): boolean => false;
