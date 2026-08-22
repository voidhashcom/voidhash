import type { VoidhashNodeClient } from "@voidhash/node";

import type { AppConfig } from "./config";

export type CaptureInput = {
  readonly distinctId: string;
  readonly event: string;
  readonly properties?: Record<string, unknown>;
};

export type PersonAttributesInput = {
  readonly distinctId: string;
  readonly traits: Record<string, string | number | boolean | null>;
};

export type Analytics = {
  /**
   * Queues one event. Fire-and-forget on purpose: analytics must never add
   * latency to — or fail — the request that produced it.
   */
  readonly capture: (input: CaptureInput) => void;
  /**
   * Queues a person-attribute write, with the same fire-and-forget contract as
   * {@link Analytics.capture}.
   */
  readonly setAttributes: (input: PersonAttributesInput) => void;
};

/**
 * Analytics over the SDK.
 *
 * Two different credentials are in play, which is the thing worth noticing:
 *
 * - `analytics.capture` posts to event ingest, which authenticates on the
 *   **publishable** key. Capture is disabled when it is unset.
 * - `persons.setPersonAttributes` is a server-to-server write on the
 *   **secret** key. Traits describe the person and persist, so facts like the
 *   current plan go here rather than being repeated on every event.
 */
export const createAnalytics = (config: AppConfig, voidhash: VoidhashNodeClient): Analytics => {
  if (config.publishableKey === undefined) {
    console.warn(
      "[voidhash] VOIDHASH_PUBLISHABLE_KEY is not set — analytics capture is disabled.",
    );
  }

  const forget = (what: string, work: Promise<unknown>): void => {
    void work.catch((error: unknown) => {
      console.warn(`[voidhash] ${what} failed.`, error);
    });
  };

  return {
    capture: (input) => {
      if (config.publishableKey === undefined) {
        return;
      }

      forget(
        `capture of "${input.event}"`,
        voidhash.analytics.capture({
          distinctId: input.distinctId,
          event: input.event,
          properties: input.properties,
        }),
      );
    },
    setAttributes: (input) => {
      forget(
        `attribute write for "${input.distinctId}"`,
        voidhash.persons.setPersonAttributes({
          payload: { distinctId: input.distinctId, traits: input.traits },
        }),
      );
    },
  };
};
