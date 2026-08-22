import { createHash } from "node:crypto";

import type { VoidhashWebhookEvent } from "@voidhash/node";

import type { EntitlementsCache } from "./entitlements-cache";
import type { NoteStore } from "./notes";

const MAX_TRACKED_DELIVERIES = 1_000;

export type WebhookProcessor = {
  /** Applies a verified delivery. Safe to call twice with the same delivery. */
  readonly process: (event: VoidhashWebhookEvent, rawBody: string) => Promise<void>;
};

const stringField = (payload: unknown, field: string): string | undefined => {
  const value = (payload as Record<string, unknown> | null)?.[field];

  return typeof value === "string" ? value : undefined;
};

/**
 * A key that is identical across retries of the same delivery.
 *
 * Voidhash sends the bare payload with no envelope and no delivery id, so the
 * key comes from the payload's own subject (`subscriptionId` / `purchaseId` /
 * `personId`) plus `occurredAt`. When a payload carries none of those — a
 * `test.ping`, or an event type newer than this code — the raw body is hashed
 * instead: a retry re-signs with a fresh timestamp but re-sends the same bytes.
 */
const deliveryKey = (event: VoidhashWebhookEvent, rawBody: string): string => {
  const subject =
    stringField(event.payload, "subscriptionId") ??
    stringField(event.payload, "purchaseId") ??
    stringField(event.payload, "personId");

  if (subject === undefined) {
    return `${event.type}:sha256:${createHash("sha256").update(rawBody).digest("hex")}`;
  }

  return `${event.type}:${subject}:${stringField(event.payload, "occurredAt") ?? ""}`;
};

export type WebhookProcessorOptions = {
  readonly entitlements: EntitlementsCache;
  readonly notes: NoteStore;
};

/**
 * Handles verified webhook deliveries idempotently.
 *
 * Anything slower than 30s (or outside 2xx) is retried four times, so the same
 * delivery does arrive twice in practice. The seen-set below is the whole
 * defence; in a real service it belongs in Redis or a unique index, not in
 * process memory.
 */
export const createWebhookProcessor = (options: WebhookProcessorOptions): WebhookProcessor => {
  const { entitlements, notes } = options;

  // A Set iterates in insertion order, which makes eviction of the oldest key a
  // one-liner and keeps the set from growing without bound.
  const seen = new Set<string>();

  const remember = (key: string): void => {
    seen.add(key);

    if (seen.size > MAX_TRACKED_DELIVERIES) {
      const oldest = seen.values().next().value;

      if (oldest !== undefined) {
        seen.delete(oldest);
      }
    }
  };

  return {
    process: async (event, rawBody) => {
      const key = deliveryKey(event, rawBody);

      if (seen.has(key)) {
        console.log(`[webhook] ${event.type} ${key} already handled — ignoring the retry.`);

        return;
      }

      remember(key);

      const distinctId = stringField(event.payload, "distinctId");

      switch (event.type) {
        case "subscription.created":
        case "subscription.renewed":
        case "subscription.cancelled":
        case "subscription.expired":
        case "purchase.completed":
        case "purchase.refunded": {
          // Access just changed, so the cached answer is wrong. Dropping it is
          // enough — the next request reads through and repopulates it.
          if (distinctId !== undefined) {
            entitlements.invalidate(distinctId);
          }

          console.log(`[webhook] ${event.type} for ${distinctId ?? "unknown person"}.`);
          break;
        }

        case "person.deleted": {
          if (distinctId !== undefined) {
            entitlements.invalidate(distinctId);
            notes.forget(distinctId);
          }

          console.log(`[webhook] ${event.type} — dropped local data for ${distinctId ?? "?"}.`);
          break;
        }

        case "person.created":
        case "person.updated":
        case "test.ping": {
          console.log(`[webhook] ${event.type} received.`);
          break;
        }

        // A newer server can send event names this code has never heard of.
        // Acknowledge them rather than failing the delivery.
        default: {
          console.log(`[webhook] unhandled event type "${event.type}" — acknowledged.`);
        }
      }
    },
  };
};
