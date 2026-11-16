import type { VoidhashWebClient } from "./client";

/**
 * The client methods an app may call before `initialize()`. In a browser they
 * wait for it and then run in the order they were called; on a server, where
 * the client cannot start, they reject. `setAnalyticsConsent` applies at once,
 * also before `initialize()`. The script-tag loader queues the same calls
 * before the SDK file arrives.
 */
export const METHODS_BEFORE_INITIALIZE = [
  "capture",
  "group",
  "identify",
  "page",
  "reset",
  "resetGroups",
  "setAdDataSharing",
  "setGroups",
  "setPersonAttributes",
  "signOut",
  "track",
] as const satisfies ReadonlyArray<keyof VoidhashWebClient>;

export type MethodBeforeInitialize = (typeof METHODS_BEFORE_INITIALIZE)[number];
