declare module "virtual:voidhash-web/auth-browser" {
  export {
    AuthProvider,
    resetBrowserAccessToken,
    useBrowserAccessTokenProvider,
  } from "@/composition/community/auth-browser";
}

declare module "virtual:voidhash-web/auth-server" {
  export {
    authRequestMiddleware,
    clearSession,
    getSessionUser,
    performSignOut,
    type SessionUser,
  } from "@/composition/community/auth-server";
}

declare module "virtual:voidhash-web/edition" {
  export {
    advancedAnalyticsAvailable,
    docsSiteUrl,
    isOrganizationWaitlisted,
    organizationSettingsNavItems,
    PaywallThumbnailAdminSlot,
    signUpCtaLabel,
    WAITLIST_CTA_LABEL,
    WAITLIST_MODE,
    type OrganizationNavItem,
    type OrganizationNavSlotContext,
  } from "@/composition/community/edition";
}
