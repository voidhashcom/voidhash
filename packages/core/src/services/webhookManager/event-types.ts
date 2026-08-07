import { constant } from "@voidhash/lib/lang";

export const WebhookEventTypes = constant({
  "person.created": "person.created",
  "person.updated": "person.updated",
  "person.deleted": "person.deleted",
  "subscription.created": "subscription.created",
  "subscription.renewed": "subscription.renewed",
  "subscription.cancelled": "subscription.cancelled",
  "subscription.expired": "subscription.expired",
  "purchase.completed": "purchase.completed",
  "purchase.refunded": "purchase.refunded",
});

export type WebhookEventType = (typeof WebhookEventTypes)[keyof typeof WebhookEventTypes];

export const ALL_WEBHOOK_EVENTS = Object.values(WebhookEventTypes);

export const isValidWebhookEvent = (event: string): event is WebhookEventType =>
  ALL_WEBHOOK_EVENTS.some((known) => known === event);
