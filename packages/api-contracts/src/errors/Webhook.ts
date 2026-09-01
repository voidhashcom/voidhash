import * as Schema from "effect/Schema";

/** Generic webhook service error */
export class ApiWebhookServiceError extends Schema.TaggedErrorClass<ApiWebhookServiceError>()(
  "Api/WebhookServiceError",
  {
    cause: Schema.String,
  },
  { httpApiStatus: 500 },
) {}

/** Webhook endpoint not found */
export class ApiWebhookEndpointNotFoundError extends Schema.TaggedErrorClass<ApiWebhookEndpointNotFoundError>()(
  "Api/WebhookEndpointNotFoundError",
  {
    endpointId: Schema.String,
  },
  { httpApiStatus: 404 },
) {}

/** Webhook delivery not found */
export class ApiWebhookDeliveryNotFoundError extends Schema.TaggedErrorClass<ApiWebhookDeliveryNotFoundError>()(
  "Api/WebhookDeliveryNotFoundError",
  {
    deliveryId: Schema.String,
  },
  { httpApiStatus: 404 },
) {}

/** Webhook validation error */
export class ApiWebhookValidationError extends Schema.TaggedErrorClass<ApiWebhookValidationError>()(
  "Api/WebhookValidationError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 400 },
) {}
