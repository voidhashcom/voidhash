import { WebhookManagerService } from "@voidhash/core/services";
import {
  RpcActionForbiddenError,
  RpcWebhookDeliveryNotFoundError,
  RpcWebhookEndpointNotFoundError,
  RpcWebhookServiceError,
  RpcWebhookValidationError,
  WebhookEndpoint,
  WebhookEndpointWithSecret,
  WebhookRpcsDef,
} from "@voidhash/rpc";
import { Effect } from "effect";

/** Shape the webhook service returns for an endpoint — secret included. */
type ServiceEndpoint = typeof WebhookEndpointWithSecret.Type;

/**
 * Strips the signing secret before an endpoint leaves a read, matching the
 * HTTP surface's `toEndpointResponse`. The service hands back the raw row, so
 * masking has to happen here rather than being an accident of the response
 * schema.
 */
const toEndpointResponse = (endpoint: ServiceEndpoint): typeof WebhookEndpoint.Type => ({
  consecutiveFailures: endpoint.consecutiveFailures,
  createdAt: endpoint.createdAt,
  description: endpoint.description,
  events: endpoint.events,
  id: endpoint.id,
  lastSuccessAt: endpoint.lastSuccessAt,
  name: endpoint.name,
  projectId: endpoint.projectId,
  status: endpoint.status,
  url: endpoint.url,
});

export const WebhookRpcsLive = WebhookRpcsDef.toLayer(
  Effect.gen(function* WebhookRpcsLive() {
    const webhookManagerService = yield* WebhookManagerService;
    return {
      CreateWebhookEndpoint: ({ projectId, name, url, events, description }) =>
        webhookManagerService
          .createEndpoint({
            description,
            events,
            name,
            projectId,
            url,
          })
          .pipe(
            Effect.catchTags({
              ActionForbiddenError: (error) =>
                Effect.fail(new RpcActionForbiddenError({ message: error.message })),
              WebhookServiceError: (error) =>
                Effect.fail(new RpcWebhookServiceError({ cause: error.cause })),
              WebhookValidationError: (error) =>
                Effect.fail(new RpcWebhookValidationError({ message: error.message })),
            }),
          ),
      DeleteWebhookEndpoint: ({ endpointId, projectId }) =>
        webhookManagerService
          .deleteEndpoint({
            endpointId,
            projectId,
          })
          .pipe(
            Effect.catchTags({
              ActionForbiddenError: (error) =>
                Effect.fail(new RpcActionForbiddenError({ message: error.message })),
              WebhookEndpointNotFoundError: (error) =>
                Effect.fail(new RpcWebhookEndpointNotFoundError({ endpointId: error.endpointId })),
              WebhookServiceError: (error) =>
                Effect.fail(new RpcWebhookServiceError({ cause: error.cause })),
            }),
          ),
      GetWebhookDelivery: ({ deliveryId, projectId }) =>
        webhookManagerService
          .getDeliveryById({
            deliveryId,
            projectId,
          })
          .pipe(
            Effect.catchTags({
              ActionForbiddenError: (error) =>
                Effect.fail(new RpcActionForbiddenError({ message: error.message })),
              WebhookDeliveryNotFoundError: (error) =>
                Effect.fail(new RpcWebhookDeliveryNotFoundError({ deliveryId: error.deliveryId })),
              WebhookServiceError: (error) =>
                Effect.fail(new RpcWebhookServiceError({ cause: error.cause })),
            }),
          ),
      GetWebhookEndpoint: ({ endpointId, projectId }) =>
        webhookManagerService
          .getEndpointById({
            endpointId,
            projectId,
          })
          .pipe(
            Effect.map(toEndpointResponse),
            Effect.catchTags({
              ActionForbiddenError: (error) =>
                Effect.fail(new RpcActionForbiddenError({ message: error.message })),
              WebhookEndpointNotFoundError: (error) =>
                Effect.fail(new RpcWebhookEndpointNotFoundError({ endpointId: error.endpointId })),
              WebhookServiceError: (error) =>
                Effect.fail(new RpcWebhookServiceError({ cause: error.cause })),
            }),
          ),
      ListWebhookDeliveries: ({ projectId, endpointId }) =>
        webhookManagerService
          .getDeliveries({
            endpointId,
            projectId,
          })
          .pipe(
            Effect.catchTags({
              ActionForbiddenError: (error) =>
                Effect.fail(new RpcActionForbiddenError({ message: error.message })),
              WebhookServiceError: (error) =>
                Effect.fail(new RpcWebhookServiceError({ cause: error.cause })),
            }),
          ),
      ListWebhookEndpoints: ({ projectId }) =>
        webhookManagerService.getEndpoints({ projectId }).pipe(
          Effect.map((endpoints) => endpoints.map(toEndpointResponse)),
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            WebhookServiceError: (error) =>
              Effect.fail(new RpcWebhookServiceError({ cause: error.cause })),
          }),
        ),
      RetryWebhookDelivery: ({ deliveryId, projectId }) =>
        webhookManagerService
          .retryDelivery({
            deliveryId,
            projectId,
          })
          .pipe(
            Effect.catchTags({
              ActionForbiddenError: (error) =>
                Effect.fail(new RpcActionForbiddenError({ message: error.message })),
              WebhookDeliveryNotFoundError: (error) =>
                Effect.fail(new RpcWebhookDeliveryNotFoundError({ deliveryId: error.deliveryId })),
              WebhookServiceError: (error) =>
                Effect.fail(new RpcWebhookServiceError({ cause: error.cause })),
              WebhookValidationError: (error) =>
                Effect.fail(new RpcWebhookValidationError({ message: error.message })),
            }),
          ),
      RotateWebhookSecret: ({ endpointId, projectId }) =>
        webhookManagerService
          .rotateSecret({
            endpointId,
            projectId,
          })
          .pipe(
            Effect.catchTags({
              ActionForbiddenError: (error) =>
                Effect.fail(new RpcActionForbiddenError({ message: error.message })),
              WebhookEndpointNotFoundError: (error) =>
                Effect.fail(new RpcWebhookEndpointNotFoundError({ endpointId: error.endpointId })),
              WebhookServiceError: (error) =>
                Effect.fail(new RpcWebhookServiceError({ cause: error.cause })),
            }),
          ),
      TestWebhookEndpoint: ({ endpointId, projectId }) =>
        webhookManagerService
          .testEndpoint({
            endpointId,
            projectId,
          })
          .pipe(
            Effect.catchTags({
              ActionForbiddenError: (error) =>
                Effect.fail(new RpcActionForbiddenError({ message: error.message })),
              WebhookEndpointNotFoundError: (error) =>
                Effect.fail(new RpcWebhookEndpointNotFoundError({ endpointId: error.endpointId })),
              WebhookServiceError: (error) =>
                Effect.fail(new RpcWebhookServiceError({ cause: error.cause })),
            }),
          ),
      UpdateWebhookEndpoint: ({ endpointId, name, url, events, status, description, projectId }) =>
        webhookManagerService
          .updateEndpoint({
            description,
            endpointId,
            events,
            name,
            projectId,
            status,
            url,
          })
          .pipe(
            Effect.map(toEndpointResponse),
            Effect.catchTags({
              ActionForbiddenError: (error) =>
                Effect.fail(new RpcActionForbiddenError({ message: error.message })),
              WebhookEndpointNotFoundError: (error) =>
                Effect.fail(new RpcWebhookEndpointNotFoundError({ endpointId: error.endpointId })),
              WebhookServiceError: (error) =>
                Effect.fail(new RpcWebhookServiceError({ cause: error.cause })),
              WebhookValidationError: (error) =>
                Effect.fail(new RpcWebhookValidationError({ message: error.message })),
            }),
          ),
    };
  }),
);
