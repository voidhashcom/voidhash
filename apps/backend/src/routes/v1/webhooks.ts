import {
  VoidhashV1Api,
  WebhookDelivery,
  WebhookDeliveryAttempt,
  WebhookDeliveryWithAttempts,
  WebhookEndpoint,
} from "@voidhash/api-contracts";
import {
  ApiActionForbiddenError,
  ApiWebhookDeliveryNotFoundError,
  ApiWebhookEndpointNotFoundError,
  ApiWebhookServiceError,
  ApiWebhookValidationError,
} from "@voidhash/api-contracts/errors";
import { WebhookManagerService } from "@voidhash/core/services/webhookManager/WebhookManagerService";
import { extractAuthorizedProjectId } from "@voidhash/core/utils";
import { AuthSession } from "@voidhash/rpc";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { bridgeAuthSession } from "../../ApiMiddlewares.ts";

export const WebhooksGroupLive = HttpApiBuilder.group(VoidhashV1Api, "webhooks", (handlers) =>
  Effect.gen(function* () {
    const webhookManagerService = yield* WebhookManagerService;

    return handlers
      .handle("createWebhookEndpoint", ({ payload }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            const projectId = yield* extractAuthorizedProjectId(authSession);
            const endpoint = yield* webhookManagerService.createEndpoint({ ...payload, projectId });
            return new WebhookEndpoint(endpoint);
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            WebhookValidationError: (e) =>
              Effect.fail(new ApiWebhookValidationError({ message: e.message })),
            WebhookServiceError: (e) => Effect.fail(new ApiWebhookServiceError({ cause: e.cause })),
          }),
        ),
      )
      .handle("listWebhookEndpoints", () =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            const projectId = yield* extractAuthorizedProjectId(authSession);
            const endpoints = yield* webhookManagerService.getEndpoints({ projectId });
            return endpoints.map((endpoint) => new WebhookEndpoint(endpoint));
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            WebhookServiceError: (e) => Effect.fail(new ApiWebhookServiceError({ cause: e.cause })),
          }),
        ),
      )
      .handle("getWebhookEndpoint", ({ params }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            const projectId = yield* extractAuthorizedProjectId(authSession);
            const endpoint = yield* webhookManagerService.getEndpointById({
              endpointId: params.endpointId,
              projectId,
            });
            return new WebhookEndpoint(endpoint);
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            WebhookEndpointNotFoundError: (e) =>
              Effect.fail(new ApiWebhookEndpointNotFoundError({ endpointId: e.endpointId })),
            WebhookServiceError: (e) => Effect.fail(new ApiWebhookServiceError({ cause: e.cause })),
          }),
        ),
      )
      .handle("updateWebhookEndpoint", ({ params, payload }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            const projectId = yield* extractAuthorizedProjectId(authSession);
            const endpoint = yield* webhookManagerService.updateEndpoint({
              ...payload,
              endpointId: params.endpointId,
              projectId,
            });
            return new WebhookEndpoint(endpoint);
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            WebhookEndpointNotFoundError: (e) =>
              Effect.fail(new ApiWebhookEndpointNotFoundError({ endpointId: e.endpointId })),
            WebhookValidationError: (e) =>
              Effect.fail(new ApiWebhookValidationError({ message: e.message })),
            WebhookServiceError: (e) => Effect.fail(new ApiWebhookServiceError({ cause: e.cause })),
          }),
        ),
      )
      .handle("deleteWebhookEndpoint", ({ params }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            const projectId = yield* extractAuthorizedProjectId(authSession);
            return yield* webhookManagerService.deleteEndpoint({
              endpointId: params.endpointId,
              projectId,
            });
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            WebhookEndpointNotFoundError: (e) =>
              Effect.fail(new ApiWebhookEndpointNotFoundError({ endpointId: e.endpointId })),
            WebhookServiceError: (e) => Effect.fail(new ApiWebhookServiceError({ cause: e.cause })),
          }),
        ),
      )
      .handle("rotateWebhookSecret", ({ params }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            const projectId = yield* extractAuthorizedProjectId(authSession);
            const endpoint = yield* webhookManagerService.rotateSecret({
              endpointId: params.endpointId,
              projectId,
            });
            return new WebhookEndpoint(endpoint);
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            WebhookEndpointNotFoundError: (e) =>
              Effect.fail(new ApiWebhookEndpointNotFoundError({ endpointId: e.endpointId })),
            WebhookServiceError: (e) => Effect.fail(new ApiWebhookServiceError({ cause: e.cause })),
          }),
        ),
      )
      .handle("testWebhookEndpoint", ({ params }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            const projectId = yield* extractAuthorizedProjectId(authSession);
            const delivery = yield* webhookManagerService.testEndpoint({
              endpointId: params.endpointId,
              projectId,
            });
            return new WebhookDelivery(delivery);
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            WebhookEndpointNotFoundError: (e) =>
              Effect.fail(new ApiWebhookEndpointNotFoundError({ endpointId: e.endpointId })),
            WebhookServiceError: (e) => Effect.fail(new ApiWebhookServiceError({ cause: e.cause })),
          }),
        ),
      )
      .handle("listWebhookDeliveries", () =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            const projectId = yield* extractAuthorizedProjectId(authSession);
            const deliveries = yield* webhookManagerService.getDeliveries({ projectId });
            return deliveries.map((delivery) => new WebhookDelivery(delivery));
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            WebhookServiceError: (e) => Effect.fail(new ApiWebhookServiceError({ cause: e.cause })),
          }),
        ),
      )
      .handle("getWebhookDelivery", ({ params }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            const projectId = yield* extractAuthorizedProjectId(authSession);
            const delivery = yield* webhookManagerService.getDeliveryById({
              deliveryId: params.deliveryId,
              projectId,
            });
            return new WebhookDeliveryWithAttempts({
              ...delivery,
              attempts: delivery.attempts.map((attempt) => new WebhookDeliveryAttempt(attempt)),
            });
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            WebhookDeliveryNotFoundError: (e) =>
              Effect.fail(new ApiWebhookDeliveryNotFoundError({ deliveryId: e.deliveryId })),
            WebhookServiceError: (e) => Effect.fail(new ApiWebhookServiceError({ cause: e.cause })),
          }),
        ),
      )
      .handle("retryWebhookDelivery", ({ params }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            const projectId = yield* extractAuthorizedProjectId(authSession);
            const delivery = yield* webhookManagerService.retryDelivery({
              deliveryId: params.deliveryId,
              projectId,
            });
            return new WebhookDelivery(delivery);
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            WebhookDeliveryNotFoundError: (e) =>
              Effect.fail(new ApiWebhookDeliveryNotFoundError({ deliveryId: e.deliveryId })),
            WebhookValidationError: (e) =>
              Effect.fail(new ApiWebhookValidationError({ message: e.message })),
            WebhookServiceError: (e) => Effect.fail(new ApiWebhookServiceError({ cause: e.cause })),
          }),
        ),
      );
  }),
);
