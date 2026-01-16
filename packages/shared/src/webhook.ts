import { Schema } from "effect";

export class WebhookServiceError extends Schema.TaggedError<WebhookServiceError>()(
  "WebhookServiceError",
  {
    cause: Schema.String,
  }
) {}

export class WebhookEndpointNotFoundError extends Schema.TaggedError<WebhookEndpointNotFoundError>()(
  "WebhookEndpointNotFoundError",
  {
    endpointId: Schema.String,
  }
) {}

export class WebhookDeliveryNotFoundError extends Schema.TaggedError<WebhookDeliveryNotFoundError>()(
  "WebhookDeliveryNotFoundError",
  {
    deliveryId: Schema.String,
  }
) {}

export class WebhookValidationError extends Schema.TaggedError<WebhookValidationError>()(
  "WebhookValidationError",
  {
    message: Schema.String,
  }
) {}
