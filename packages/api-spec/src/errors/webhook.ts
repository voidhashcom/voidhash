import { HttpApiSchema } from "@effect/platform";
import { Schema } from "effect";

/** Generic webhook service error */
export class WebhookServiceError extends Schema.TaggedError<WebhookServiceError>()(
  "WebhookServiceError",
  {
    cause: Schema.String,
  },
  HttpApiSchema.annotations({ status: 500 })
) {}

/** Webhook endpoint not found */
export class WebhookEndpointNotFoundError extends Schema.TaggedError<WebhookEndpointNotFoundError>()(
  "WebhookEndpointNotFoundError",
  {
    endpointId: Schema.String,
  },
  HttpApiSchema.annotations({ status: 404 })
) {}

/** Webhook delivery not found */
export class WebhookDeliveryNotFoundError extends Schema.TaggedError<WebhookDeliveryNotFoundError>()(
  "WebhookDeliveryNotFoundError",
  {
    deliveryId: Schema.String,
  },
  HttpApiSchema.annotations({ status: 404 })
) {}

/** Webhook validation error */
export class WebhookValidationError extends Schema.TaggedError<WebhookValidationError>()(
  "WebhookValidationError",
  {
    message: Schema.String,
  },
  HttpApiSchema.annotations({ status: 400 })
) {}
