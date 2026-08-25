import type { VoidhashNodeClient } from "@voidhash/node";

import { findPersonByDistinctId } from "./voidhash";

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
 * Two surfaces, one credential — the project secret key:
 *
 * - `eventCapture.capture` posts to event ingest, on its own origin, and
 *   authorizes with the `x-secret-key` header like every other call.
 * - `persons.createPerson` / `persons.updatePerson` are server-to-server
 *   writes on the REST API. Traits describe the person and persist, so facts
 *   like the current plan go here rather than being repeated on every event.
 */
export const createAnalytics = (voidhash: VoidhashNodeClient): Analytics => {
  const forget = (what: string, work: Promise<unknown>): void => {
    void work.catch((error: unknown) => {
      console.warn(`[voidhash] ${what} failed.`, error);
    });
  };

  return {
    capture: (input) => {
      forget(
        `capture of "${input.event}"`,
        voidhash.eventCapture.capture({
          distinctId: input.distinctId,
          event: input.event,
          properties: input.properties,
        }),
      );
    },
    setAttributes: (input) => {
      const update = async () => {
        let person = await findPersonByDistinctId(voidhash, input.distinctId);
        if (person === null) {
          person = await voidhash.persons.createPerson({
            payload: { distinctId: input.distinctId },
          });
        }
        return voidhash.persons.updatePerson({
          params: { personId: person.personId },
          payload: { traits: input.traits },
        });
      };
      forget(
        `attribute write for "${input.distinctId}"`,
        update(),
      );
    },
  };
};
