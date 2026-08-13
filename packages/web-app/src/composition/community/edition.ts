export {
  isOrganizationWaitlisted,
  signUpCtaLabel,
  WAITLIST_CTA_LABEL,
  WAITLIST_MODE,
} from "../../lib/waitlist";
export {
  organizationSettingsNavItems,
  type OrganizationNavItem,
  type OrganizationNavSlotContext,
} from "../../features/studio/enterprise/organization-nav-slot";
export { PaywallThumbnailAdminSlot } from "../../features/studio/paywalls/designer/dev-mode/paywall-thumbnail-admin-slot";

/** Community exposes only the built-in PostgreSQL analytics pages. */
export const advancedAnalyticsAvailable = false;

/**
 * Where published documentation pages live. The docs site itself is hosted-only,
 * so community deployments link out to the public site rather than to a local
 * route; guide content still renders in-app from the bundled MDX collection.
 */
export const docsSiteUrl = "https://voidhash.com/docs";
