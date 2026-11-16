/**
 * The Nimbus vocabulary, spelled out once.
 *
 * Every example in this repository — four backends and three apps — uses these
 * exact slugs and event names, so a Studio project configured for one works for
 * all of them.
 */

/** Perk slug that unlocks unlimited notes and export. */
export const PRO_PERK_SLUG = "pro";

/** How many notes a free account may hold. */
export const FREE_NOTE_LIMIT = 3;

/**
 * Analytics events Nimbus captures. The backend emits `note_created` and
 * `export_requested`; the apps emit `paywall_viewed` and `checkout_started` and
 * may forward them through `POST /v1/events`.
 */
export const ANALYTICS_EVENTS = {
  checkoutStarted: "checkout_started",
  exportRequested: "export_requested",
  noteCreated: "note_created",
  paywallViewed: "paywall_viewed",
} as const;
