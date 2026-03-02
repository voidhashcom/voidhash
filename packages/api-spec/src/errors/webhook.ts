import { Schema } from "effect";

/** Generic webhook service error */
export class WebhookServiceError extends Schema.TaggedErrorClass<WebhookServiceError>()(
  "WebhookServiceError",
  {
    cause: Schema.String,
  },
  { httpApiStatus: 500 }
) {}

/** Webhook endpoint not found */
export class WebhookEndpointNotFoundError extends Schema.TaggedErrorClass<WebhookEndpointNotFoundError>()(
  "WebhookEndpointNotFoundError",
  {
    endpointId: Schema.String,
  },
  { httpApiStatus: 404 }
) {}

/** Webhook delivery not found */
export class WebhookDeliveryNotFoundError extends Schema.TaggedErrorClass<WebhookDeliveryNotFoundError>()(
  "WebhookDeliveryNotFoundError",
  {
    deliveryId: Schema.String,
  },
  { httpApiStatus: 404 }
) {}

/** Webhook validation error */
export class WebhookValidationError extends Schema.TaggedErrorClass<WebhookValidationError>()(
  "WebhookValidationError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 400 }
) {}
