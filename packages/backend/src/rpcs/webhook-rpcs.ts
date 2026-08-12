import { WebhookManagerService } from "@voidhash/core/services";
import {
  RpcActionForbiddenError,
  RpcWebhookDeliveryNotFoundError,
  RpcWebhookEndpointNotFoundError,
  RpcWebhookServiceError,
  RpcWebhookValidationError,
  WebhookRpcsDef,
} from "@voidhash/rpc";
import { Effect } from "effect";

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
      DeleteWebhookEndpoint: ({ endpointId }) =>
        webhookManagerService
          .deleteEndpoint({
            endpointId,
            projectId: "",
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
      GetWebhookDelivery: ({ deliveryId }) =>
        webhookManagerService
          .getDeliveryById({
            deliveryId,
            projectId: "",
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
      GetWebhookEndpoint: ({ endpointId }) =>
        webhookManagerService
          .getEndpointById({
            endpointId,
            projectId: "",
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
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            WebhookServiceError: (error) =>
              Effect.fail(new RpcWebhookServiceError({ cause: error.cause })),
          }),
        ),
      RetryWebhookDelivery: ({ deliveryId }) =>
        webhookManagerService
          .retryDelivery({
            deliveryId,
            projectId: "",
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
      RotateWebhookSecret: ({ endpointId }) =>
        webhookManagerService
          .rotateSecret({
            endpointId,
            projectId: "",
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
      TestWebhookEndpoint: ({ endpointId }) =>
        webhookManagerService
          .testEndpoint({
            endpointId,
            projectId: "",
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
      UpdateWebhookEndpoint: ({ endpointId, name, url, events, status, description }) =>
        webhookManagerService
          .updateEndpoint({
            description,
            endpointId,
            events,
            name,
            projectId: "",
            status,
            url,
          })
          .pipe(
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
