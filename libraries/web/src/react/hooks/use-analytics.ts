import React from "react";

import type { AnalyticsConsent } from "../../types";
import { useVoidhash } from "./use-voidhash";

/**
 * Analytics helpers bound to the client. `consent` and `enabled` follow
 * `setAnalyticsConsent`, including changes made in another tab.
 * `pauseAnalytics` and `resumeAnalytics` stop and restart recording without
 * changing consent.
 */
export const useAnalytics = () => {
  const { client } = useVoidhash();

  const subscribe = React.useCallback(
    (onChange: () => void) => client.on("analytics-consent-changed", onChange),
    [client],
  );
  // The server and hydration render the configured consent, which both sides
  // know, rather than a choice only the browser has stored; the stored choice
  // takes over right after hydration.
  const consent = React.useSyncExternalStore(
    subscribe,
    () => client.getAnalyticsConsent(),
    () => client.getConfiguredAnalyticsConsent(),
  );

  return React.useMemo(
    () => ({
      consent,
      enabled: consent === "granted",
      flushAnalytics: () => client.flushAnalytics(),
      pauseAnalytics: () => client.pauseAnalytics(),
      resumeAnalytics: () => client.resumeAnalytics(),
      page: (
        pageName?: string,
        properties?: Record<string, unknown>,
        options?: { eventId?: string; sessionId?: string; timestamp?: string },
      ) => client.page(pageName, properties, options),
      setAdDataSharing: (granted: boolean) => client.setAdDataSharing(granted),
      setAnalyticsConsent: (next: AnalyticsConsent) => client.setAnalyticsConsent(next),
      /** Records a product event; returns at once and never throws. See `capture()` on the client. */
      capture: (
        eventName: string,
        properties?: Record<string, unknown>,
        options?: { eventId?: string; sessionId?: string; timestamp?: string },
      ) => client.capture(eventName, properties, options),
      /** @deprecated Use `capture()`, which returns at once and never throws. */
      track: (
        eventName: string,
        properties?: Record<string, unknown>,
        options?: { eventId?: string; sessionId?: string; timestamp?: string },
      ) => client.track(eventName, properties, options),
    }),
    [client, consent],
  );
};
