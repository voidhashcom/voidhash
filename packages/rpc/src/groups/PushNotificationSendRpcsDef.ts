import { Rpc, RpcGroup } from "effect/unstable/rpc";
import * as Schema from "effect/Schema";

import { RpcActionForbiddenError } from "../errors/common.ts";
import {
  RpcPushNotificationSendNotFoundError,
  RpcPushNotificationSendServiceError,
} from "../errors/PushNotificationSend.ts";
import { AuthMiddleware } from "../middlewares.ts";

/**
 * Wire DTO for a push-notification *send* — the parent record of a fan-out to
 * one or more devices, shown in the studio "sent notifications" activity list.
 *
 * `status` is the human-readable label (e.g. `"partial_failed"`), not the raw
 * numeric enum, so the browser never has to know the enum encoding. `message`
 * is the notification payload and is PII-at-rest: it is TTL-purged, so it can be
 * an empty object once `messagePurged` is `true`.
 */
export const PushNotificationSend = Schema.Struct({
  completedAt: Schema.NullOr(Schema.Date),
  createdAt: Schema.Date,
  deviceCount: Schema.Number,
  failedCount: Schema.Number,
  id: Schema.String,
  idempotencyKey: Schema.NullOr(Schema.String),
  message: Schema.Record(Schema.String, Schema.Unknown),
  isMessagePurged: Schema.Boolean,
  requestedDistinctIdCount: Schema.Number,
  requestedPersonCount: Schema.Number,
  skippedCount: Schema.Number,
  status: Schema.String,
  succeededCount: Schema.Number,
  unresolvedDistinctIds: Schema.Array(Schema.String),
}).pipe(Schema.encodeKeys({ isMessagePurged: "messagePurged" }));
export type PushNotificationSend = typeof PushNotificationSend.Type;
export type PushNotificationSendType = typeof PushNotificationSend.Type;

/**
 * Wire DTO for a single per-(send, device) delivery — the drill-down rows shown
 * when a send is selected. `status` is the human-readable label, `provider` is
 * the routed channel (`"fcm"` / `"apns"`), and `lastError` / `providerMessageId`
 * carry the per-device debugging signal.
 */
export const PushNotificationDelivery = Schema.Struct({
  attemptCount: Schema.Number,
  completedAt: Schema.NullOr(Schema.Date),
  createdAt: Schema.Date,
  id: Schema.String,
  lastError: Schema.NullOr(Schema.String),
  maxAttempts: Schema.Number,
  nextAttemptAt: Schema.NullOr(Schema.Date),
  personId: Schema.String,
  provider: Schema.String,
  providerMessageId: Schema.NullOr(Schema.String),
  status: Schema.String,
});
export type PushNotificationDelivery = typeof PushNotificationDelivery.Type;
export type PushNotificationDeliveryType = typeof PushNotificationDelivery.Type;

export const ListPushNotificationSendsRequest = Schema.Struct({
  limit: Schema.optional(Schema.Number),
  projectId: Schema.String,
});
export type ListPushNotificationSendsRequest = typeof ListPushNotificationSendsRequest.Type;
export type ListPushNotificationSendsRequestType = typeof ListPushNotificationSendsRequest.Type;

export const ListPushNotificationSendsResponse = Schema.Struct({
  hasMore: Schema.Boolean,
  sends: Schema.Array(PushNotificationSend),
});
export type ListPushNotificationSendsResponse = typeof ListPushNotificationSendsResponse.Type;
export type ListPushNotificationSendsResponseType = typeof ListPushNotificationSendsResponse.Type;

export const GetPushNotificationSendDeliveriesRequest = Schema.Struct({
  projectId: Schema.String,
  sendId: Schema.String,
});
export type GetPushNotificationSendDeliveriesRequest =
  typeof GetPushNotificationSendDeliveriesRequest.Type;
export type GetPushNotificationSendDeliveriesRequestType =
  typeof GetPushNotificationSendDeliveriesRequest.Type;

export const GetPushNotificationSendDeliveriesResponse = Schema.Struct({
  deliveries: Schema.Array(PushNotificationDelivery),
});
export type GetPushNotificationSendDeliveriesResponse =
  typeof GetPushNotificationSendDeliveriesResponse.Type;
export type GetPushNotificationSendDeliveriesResponseType =
  typeof GetPushNotificationSendDeliveriesResponse.Type;

/**
 * Read-only RPC surface for push-notification send history — the studio
 * "sent notifications" activity page. Distinct from
 * {@link PushNotificationConfigurationRpcsDef} (credential CRUD): this group
 * only reads the `push_notification_send` / `push_notification_delivery` tables
 * so customers can debug what was sent, to whom, and why a delivery failed.
 */
export class PushNotificationSendRpcsDef extends RpcGroup.make(
  Rpc.make("ListPushNotificationSends", {
    error: Schema.Union([RpcActionForbiddenError, RpcPushNotificationSendServiceError]),
    payload: ListPushNotificationSendsRequest,
    success: ListPushNotificationSendsResponse,
  }),
  Rpc.make("GetPushNotificationSendDeliveries", {
    error: Schema.Union([
      RpcActionForbiddenError,
      RpcPushNotificationSendServiceError,
      RpcPushNotificationSendNotFoundError,
    ]),
    payload: GetPushNotificationSendDeliveriesRequest,
    success: GetPushNotificationSendDeliveriesResponse,
  }),
).middleware(AuthMiddleware) {}
