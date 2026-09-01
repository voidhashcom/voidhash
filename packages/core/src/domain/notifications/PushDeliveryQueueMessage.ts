import * as Schema from "effect/Schema";

/**
 * The wire message published to `PushDeliveryQueue` — ONE per
 * `(send, device)` delivery row. Deliberately thin: it carries only the delivery
 * id (plus `projectId`/`provider` for span annotation and tenant sanity), and the
 * consumer re-reads the authoritative `push_notification_delivery` row before
 * doing anything. That keeps the queue a transient pointer, never the system of
 * record — the atomic `Pending|Failed -> InProgress` CAS on the DB row is the
 * idempotency guard against redelivery, independent of queue at-least-once.
 *
 * Mirrors `AnalyticsIngestQueueMessage` (a plain `Schema.Struct`).
 */
export const PushDeliveryQueueMessage = Schema.Struct({
  pushNotificationDeliveryId: Schema.String,
  pushNotificationSendId: Schema.String,
  projectId: Schema.String,
  provider: Schema.String,
});
export type PushDeliveryQueueMessage = typeof PushDeliveryQueueMessage.Type;

export type PushDeliveryQueueMessageType = typeof PushDeliveryQueueMessage.Type;
