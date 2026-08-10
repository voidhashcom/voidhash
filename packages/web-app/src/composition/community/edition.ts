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
