import * as Schema from "effect/Schema";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi";

import {
  ApiActionForbiddenError,
  ApiAuthServiceError,
  ApiPushDeviceValidationError,
  ApiPushNotificationSendNotFoundError,
  ApiPushNotificationSendServiceError,
  ApiPushSendNotEnabledError,
  ApiPushSendServiceError,
} from "../errors/index.ts";
import { AuthMiddleware } from "../Middlewares.ts";
import { paginated } from "../Pagination.ts";
import { SendNotificationBody, SendNotificationResponse } from "../Schema.ts";
import {
  ListNotificationDeliveriesQuery,
  ListNotificationSendsQuery,
  NotificationIdempotencyHeaders,
  PushNotificationDelivery,
  PushNotificationSend,
} from "../schemas/providers.ts";

export const NotificationsGroup = HttpApiGroup.make("notifications")
  /**
   * Server-to-server push dispatch. The send record is the resource, and 202
   * is the honest status for an asynchronous fan-out — the response carries a
   * `pushNotificationSendId` whose progress is readable through
   * `GET /notification-sends/:sendId/deliveries`.
   *
   * Secret-key or user credential only: a publishable key ships inside client
   * bundles, so it must never be able to push to arbitrary persons. Also gated
   * by the `notifications` internal feature flag.
   *
   * Accepts the idempotency key as an `Idempotency-Key` header or, for
   * clients that cannot set headers, as a body field.
   */
  .add(
    HttpApiEndpoint.post("createNotification", "/", {
      headers: NotificationIdempotencyHeaders,
      payload: SendNotificationBody,
      success: SendNotificationResponse.pipe(HttpApiSchema.status(202)),
      error: [
        ApiActionForbiddenError,
        ApiAuthServiceError,
        ApiPushDeviceValidationError,
        ApiPushSendNotEnabledError,
        ApiPushSendServiceError,
      ],
    }),
  )
  .middleware(AuthMiddleware)
  .prefix("/notifications");

/**
 * Read-only send history — what was dispatched, to how many devices, and why a
 * given device failed. Makes the `202` from `POST /notifications` actionable.
 * Secret-key or user credential; publishable keys are rejected.
 */
export const NotificationSendsGroup = HttpApiGroup.make("notification_sends")
  .add(
    HttpApiEndpoint.get("listNotificationSends", "/", {
      query: ListNotificationSendsQuery,
      success: paginated(PushNotificationSend),
      error: [ApiActionForbiddenError, ApiPushNotificationSendServiceError],
    }),
  )
  .add(
    // Per-device delivery trail for one send, optionally narrowed to a single
    // delivery status (e.g. `failed`).
    HttpApiEndpoint.get("listNotificationSendDeliveries", "/:sendId/deliveries", {
      params: { sendId: Schema.String },
      query: ListNotificationDeliveriesQuery,
      success: paginated(PushNotificationDelivery),
      error: [
        ApiActionForbiddenError,
        ApiPushNotificationSendNotFoundError,
        ApiPushNotificationSendServiceError,
      ],
    }),
  )
  .middleware(AuthMiddleware)
  .prefix("/notification-sends");
