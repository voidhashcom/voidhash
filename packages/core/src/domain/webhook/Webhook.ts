/**
 * Webhook domain — typed errors that signal an invariant violation on a
 * webhook endpoint or delivery row. Row data and the `WebhookEndpointStatus`
 * enum live with the schema in `@voidhash/db/schema`.
 */
import { Schema } from "effect";

/** Webhook endpoint row not found. */
export class WebhookEndpointNotFoundError extends Schema.TaggedErrorClass<WebhookEndpointNotFoundError>(
  "WebhookEndpointNotFoundError",
)("WebhookEndpointNotFoundError", { endpointId: Schema.String }) {}

/** Webhook delivery row not found. */
export class WebhookDeliveryNotFoundError extends Schema.TaggedErrorClass<WebhookDeliveryNotFoundError>(
  "WebhookDeliveryNotFoundError",
)("WebhookDeliveryNotFoundError", { deliveryId: Schema.String }) {}

/** Webhook input failed validation (URL shape, header limits, etc.). */
export class WebhookValidationError extends Schema.TaggedErrorClass<WebhookValidationError>(
  "WebhookValidationError",
)("WebhookValidationError", { message: Schema.String }) {}
