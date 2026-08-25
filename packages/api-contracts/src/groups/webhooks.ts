import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi";

import {
  ApiActionForbiddenError,
  ApiWebhookDeliveryNotFoundError,
  ApiWebhookEndpointNotFoundError,
  ApiWebhookServiceError,
  ApiWebhookValidationError,
} from "../errors/index.ts";
import { AuthMiddleware } from "../Middlewares.ts";
import { paginated } from "../Pagination.ts";
import {
  CreateWebhookEndpointBody,
  WebhookDeliveryListParams,
  WebhookEndpointListParams,
  WebhookScopeParams,
} from "../schemas/webhooks.ts";
import {
  UpdateWebhookEndpointBody,
  WebhookDelivery,
  WebhookDeliveryWithAttempts,
  WebhookEndpoint,
  WebhookEndpointWithSecret,
} from "../Schema.ts";

export const WebhooksGroup = HttpApiGroup.make("webhooks")
  /**
   * Registers a webhook endpoint and returns it together with the generated
   * signing secret. This response is the only place the secret is ever shown —
   * reads mask it, and the only way back to a usable secret is a rotation.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.post("createWebhookEndpoint", "/endpoints", {
      payload: CreateWebhookEndpointBody,
      success: WebhookEndpointWithSecret.pipe(HttpApiSchema.status(201)),
      error: [ApiActionForbiddenError, ApiWebhookValidationError, ApiWebhookServiceError],
    }),
  )
  /**
   * Lists the webhook endpoints of one project, without their secrets.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.get("listWebhookEndpoints", "/endpoints", {
      query: WebhookEndpointListParams,
      success: paginated(WebhookEndpoint),
      error: [ApiActionForbiddenError, ApiWebhookServiceError],
    }),
  )
  /**
   * Reads a single webhook endpoint, without its secret.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.get("getWebhookEndpoint", "/endpoints/:endpointId", {
      params: { endpointId: Schema.String },
      query: WebhookScopeParams,
      success: WebhookEndpoint,
      error: [ApiActionForbiddenError, ApiWebhookEndpointNotFoundError, ApiWebhookServiceError],
    }),
  )
  /**
   * Patches the mutable fields of an endpoint. Last-writer-wins: there is no
   * optimistic concurrency, so a concurrent update silently overwrites.
   * Re-activating a `disabled` endpoint also clears its failure counter.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.patch("updateWebhookEndpoint", "/endpoints/:endpointId", {
      params: { endpointId: Schema.String },
      query: WebhookScopeParams,
      payload: UpdateWebhookEndpointBody,
      success: WebhookEndpoint,
      error: [
        ApiActionForbiddenError,
        ApiWebhookEndpointNotFoundError,
        ApiWebhookValidationError,
        ApiWebhookServiceError,
      ],
    }),
  )
  /**
   * Deletes an endpoint. Its delivery history goes with it.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.delete("deleteWebhookEndpoint", "/endpoints/:endpointId", {
      params: { endpointId: Schema.String },
      query: WebhookScopeParams,
      error: [ApiActionForbiddenError, ApiWebhookEndpointNotFoundError, ApiWebhookServiceError],
    }),
  )
  /**
   * Issues a new signing secret and returns it. The previous secret stops
   * verifying immediately, so deploy the new one before rotating.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.post("rotateWebhookSecret", "/endpoints/:endpointId/rotate-secret", {
      params: { endpointId: Schema.String },
      query: WebhookScopeParams,
      success: WebhookEndpointWithSecret,
      error: [ApiActionForbiddenError, ApiWebhookEndpointNotFoundError, ApiWebhookServiceError],
    }),
  )
  /**
   * Sends a synthetic event to the endpoint and returns the resulting delivery
   * record, so a caller can verify signing and connectivity end to end.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.post("testWebhookEndpoint", "/endpoints/:endpointId/test", {
      params: { endpointId: Schema.String },
      query: WebhookScopeParams,
      success: WebhookDelivery,
      error: [ApiActionForbiddenError, ApiWebhookEndpointNotFoundError, ApiWebhookServiceError],
    }),
  )
  /**
   * Lists delivery records newest-first, optionally narrowed to one endpoint.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.get("listWebhookDeliveries", "/deliveries", {
      query: WebhookDeliveryListParams,
      success: paginated(WebhookDelivery),
      error: [ApiActionForbiddenError, ApiWebhookServiceError],
    }),
  )
  /**
   * Reads one delivery together with every attempt made for it, including
   * response bodies and error messages.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.get("getWebhookDelivery", "/deliveries/:deliveryId", {
      params: { deliveryId: Schema.String },
      query: WebhookScopeParams,
      success: WebhookDeliveryWithAttempts,
      error: [ApiActionForbiddenError, ApiWebhookDeliveryNotFoundError, ApiWebhookServiceError],
    }),
  )
  /**
   * Re-queues a failed or exhausted delivery.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.post("retryWebhookDelivery", "/deliveries/:deliveryId/retry", {
      params: { deliveryId: Schema.String },
      query: WebhookScopeParams,
      success: WebhookDelivery,
      error: [
        ApiActionForbiddenError,
        ApiWebhookDeliveryNotFoundError,
        ApiWebhookValidationError,
        ApiWebhookServiceError,
      ],
    }),
  )
  .middleware(AuthMiddleware)
  .prefix("/webhooks");
