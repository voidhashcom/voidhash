/** Canonical measurement evidence type identifiers. */
export const MEASUREMENT_RECORD_TYPES = {
  INSTALLATION_CREATED: "installation.created.v1",
  INSTALLATION_UPDATED: "installation.updated.v1",
  SESSION_STARTED: "session.started.v1",
  SESSION_ENDED: "session.ended.v1",
  IDENTITY_CHANGED: "identity.changed.v1",
  CONSENT_CHANGED: "consent.changed.v1",
  LINK_RECEIVED: "link.received.v1",
  LINK_RESOLVED: "link.resolved.v1",
  LINK_ROUTED: "link.routed.v1",
  ANDROID_INSTALL_REFERRER: "android.install_referrer.v1",
  ANDROID_PREINSTALL: "android.preinstall.v1",
  IOS_ADSERVICES: "ios.adservices.v1",
  IOS_ATT_CHANGED: "ios.att.changed.v1",
  IDENTIFIER_OBSERVED: "identifier.observed.v1",
  PUSH_TOKEN: "push.token.v1",
  PUSH_RECEIVED: "push.received.v1",
  PUSH_OPENED: "push.opened.v1",
  AD_REVENUE: "revenue.ad_impression.v1",
  PURCHASE_OBSERVED: "purchase.observed.v1",
  PURCHASE_VALIDATION_REQUESTED: "purchase.validation_requested.v1",
  PURCHASE_VALIDATION_RESULT: "purchase.validation_result.v1",
  DIAGNOSTIC_CAPABILITY: "diagnostic.capability.v1",
  PARTNER_CONTEXT_CHANGED: "partner.context_changed.v1",
} as const;

/** Standard event aliases routed exclusively through `client.capture`. */
export const STANDARD_EVENTS = {
  ADD_PAYMENT_INFO: "add payment info",
  ADD_TO_CART: "add to cart",
  ADD_TO_WISHLIST: "add to wishlist",
  COMPLETE_REGISTRATION: "complete registration",
  INITIATED_CHECKOUT: "initiated checkout",
  INVITE_SHARED: "invite shared",
  LEVEL_ACHIEVED: "level achieved",
  LOCATION: "location",
  LOGIN: "login",
  PURCHASE: "purchase",
  RATE: "rate",
  SEARCH: "search",
  SHARE: "share",
  SPENT_CREDITS: "spent credits",
  SUBSCRIBE: "subscribe",
  TUTORIAL_COMPLETION: "tutorial completion",
  UNLOCK_ACHIEVEMENT: "unlock achievement",
  VIEWED_CONTENT: "viewed content",
  /** Captured automatically by the notifications namespace on user open. */
  OPENED_FROM_PUSH_NOTIFICATION: "opened from push notification",
} as const;

/** Standard aliases applications may emit themselves. */
export const APP_EMITTABLE_STANDARD_EVENTS = Object.freeze(
  Object.fromEntries(
    Object.entries(STANDARD_EVENTS).filter(([key]) => key !== "OPENED_FROM_PUSH_NOTIFICATION"),
  ) as Omit<typeof STANDARD_EVENTS, "OPENED_FROM_PUSH_NOTIFICATION">,
);

/** Evidence types which may never be evicted for low-priority analytics. */
export const NON_EVICTABLE_RECORD_TYPES = new Set<string>([
  MEASUREMENT_RECORD_TYPES.INSTALLATION_CREATED,
  MEASUREMENT_RECORD_TYPES.INSTALLATION_UPDATED,
  MEASUREMENT_RECORD_TYPES.CONSENT_CHANGED,
  MEASUREMENT_RECORD_TYPES.LINK_RECEIVED,
  MEASUREMENT_RECORD_TYPES.LINK_RESOLVED,
  MEASUREMENT_RECORD_TYPES.ANDROID_INSTALL_REFERRER,
  MEASUREMENT_RECORD_TYPES.PURCHASE_OBSERVED,
  MEASUREMENT_RECORD_TYPES.PURCHASE_VALIDATION_REQUESTED,
  MEASUREMENT_RECORD_TYPES.PURCHASE_VALIDATION_RESULT,
]);
