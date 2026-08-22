/**
 * The names Nimbus shares with every other Voidhash example and with the
 * dashboard. Keeping them in one file is the point: a slug typed inline in
 * three screens is a slug that eventually disagrees with the server.
 */

/** Perk that unlocks unlimited notes and export. */
export const PRO_PERK = "pro";

/** Paywall location the Notes screen presents. */
export const ONBOARDING_LOCATION = "onboarding";

/** Feature flag the Account screen reads. */
export const NEW_ONBOARDING_FLAG = "nimbus-new-onboarding";

/** Products offered on the Upgrade screen, in display order. */
export const PRO_PRODUCT_SLUGS = ["pro-monthly", "pro-annual", "pro-lifetime"] as const;

/** Notes a free account may keep. */
export const FREE_NOTE_LIMIT = 3;

/** Analytics events Nimbus captures. */
export const EVENTS = {
  checkoutStarted: "checkout_started",
  exportRequested: "export_requested",
  noteCreated: "note_created",
  paywallViewed: "paywall_viewed",
} as const;
