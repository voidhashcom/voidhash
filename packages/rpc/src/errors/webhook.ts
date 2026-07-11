/**
 * Webhook errors — typed errors returned by webhook RPCs (webhook endpoint
 * / delivery not found, validation) plus the catch-all service error. Class
 * names and `_tag` values are namespaced with `Rpc` / `Rpc/`.
 */
import { Schema } from "effect";

/** Webhook endpoint row not found. */
export class RpcWebhookEndpointNotFoundError extends Schema.TaggedErrorClass<RpcWebhookEndpointNotFoundError>(
  "RpcWebhookEndpointNotFoundError",
)("Rpc/WebhookEndpointNotFoundError", { endpointId: Schema.String }) {}

/** Webhook delivery row not found. */
export class RpcWebhookDeliveryNotFoundError extends Schema.TaggedErrorClass<RpcWebhookDeliveryNotFoundError>(
  "RpcWebhookDeliveryNotFoundError",
)("Rpc/WebhookDeliveryNotFoundError", { deliveryId: Schema.String }) {}

/** Webhook input failed validation (URL shape, header limits, etc.). */
export class RpcWebhookValidationError extends Schema.TaggedErrorClass<RpcWebhookValidationError>(
  "RpcWebhookValidationError",
)("Rpc/WebhookValidationError", { message: Schema.String }) {}

/**
 * Catch-all webhook service error. Wraps `DatabaseError` and other
 * infrastructural failures at the public-method boundary so callers see one
 * stable error tag.
 */
export class RpcWebhookServiceError extends Schema.TaggedErrorClass<RpcWebhookServiceError>(
  "RpcWebhookServiceError",
)("Rpc/WebhookServiceError", { cause: Schema.String }) {}
