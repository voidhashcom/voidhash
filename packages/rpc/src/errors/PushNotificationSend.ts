/**
 * Push-notification-send errors — typed errors returned by the read-only
 * push-notification *send* RPCs (the studio "sent notifications" activity
 * surface). Kept separate from the config errors so the send-history read path
 * and the credential CRUD path evolve independently, and namespaced with
 * `Rpc` / `Rpc/` like the rest of the wire contract.
 */
import * as Schema from "effect/Schema";

/** A send (or its parent send for a deliveries lookup) was not found. */
export class RpcPushNotificationSendNotFoundError extends Schema.TaggedErrorClass<RpcPushNotificationSendNotFoundError>(
  "RpcPushNotificationSendNotFoundError",
)("Rpc/PushNotificationSendNotFoundError", { message: Schema.String }) {}

/**
 * Catch-all push-notification-send service error. Wraps infrastructural
 * failures (DB query errors) at the public-method boundary.
 */
export class RpcPushNotificationSendServiceError extends Schema.TaggedErrorClass<RpcPushNotificationSendServiceError>(
  "RpcPushNotificationSendServiceError",
)("Rpc/PushNotificationSendServiceError", { cause: Schema.String }) {}
