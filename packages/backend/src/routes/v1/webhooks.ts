import * as Schema from "effect/Schema";
import * as Arr from "effect/Array";
import {
  createdResponse,
  VoidhashV1Api,
  WebhookDelivery,
  WebhookDeliveryAttempt,
  WebhookDeliveryWithAttempts,
  WebhookEndpoint,
  WebhookEndpointWithSecret,
} from "@voidhash/api-contracts";
import {
  ApiActionForbiddenError,
  ApiWebhookDeliveryNotFoundError,
  ApiWebhookEndpointNotFoundError,
  ApiWebhookServiceError,
  ApiWebhookValidationError,
} from "@voidhash/api-contracts/errors";
import { WebhookManagerService } from "@voidhash/core/services/webhookManager/WebhookManagerService";
import {
  decodeCursor,
  encodeCursor,
  paginate,
  resolveRequestProjectId,
} from "@voidhash/core/utils";
import { AuthSession } from "@voidhash/rpc";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Order from "effect/Order";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import {
  type ApiCredentialMethod,
  bridgeAuthSession,
  requireCredential,
} from "../../ApiMiddlewares.ts";

/**
 * Credentials allowed to manage webhooks. Publishable keys ship inside client
 * bundles, so they must never reach an endpoint that can read delivery
 * payloads or mint a signing secret.
 */
const MANAGEMENT_CREDENTIALS: ReadonlyArray<ApiCredentialMethod> = ["user", "secret-key"];

/** Resolves an optional opaque cursor to the delivery id it points at. */
const toAfterDeliveryId = (cursor: string | typeof Schema.Undefined.Type) => {
  if (cursor === undefined) return Effect.succeed(undefined);
  return decodeCursor(cursor);
};

/** Shape the webhook service returns for an endpoint — secret included. */
type ServiceEndpoint = typeof WebhookEndpointWithSecret.Type;

/**
 * Strips the signing secret before an endpoint leaves a read. The service hands
 * back the raw row, so masking has to happen here rather than being an accident
 * of the response schema.
 */
const toEndpointResponse = (endpoint: ServiceEndpoint): WebhookEndpoint =>
  new WebhookEndpoint({
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

export const WebhooksGroupLive = HttpApiBuilder.group(VoidhashV1Api, "webhooks", (handlers) =>
  Effect.gen(function* () {
    const webhookManagerService = yield* WebhookManagerService;

    return handlers
      .handle("createWebhookEndpoint", ({ payload }) =>
        bridgeAuthSession(
          Effect.fn("WebhooksGroupLive")(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
            const projectId = yield* resolveRequestProjectId(authSession, payload.projectId);
            const endpoint = yield* webhookManagerService.createEndpoint({
              description: payload.description,
              events: payload.events,
              name: payload.name,
              projectId,
              url: payload.url,
            });
            const created = new WebhookEndpointWithSecret(endpoint);
            // `GET /webhooks/endpoints/:endpointId` is project-scoped, so the
            // scope the create resolved travels with the `Location` URL.
            return yield* createdResponse(
              WebhookEndpointWithSecret,
              created,
              `/webhooks/endpoints/${created.id}?projectId=${projectId}`,
            );
          })(),
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
      .handle("listWebhookEndpoints", ({ query }) =>
        bridgeAuthSession(
          Effect.fn("WebhooksGroupLive")(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
            const projectId = yield* resolveRequestProjectId(authSession, query.projectId);
            const endpoints = yield* webhookManagerService.getEndpoints({ projectId });
            // The service returns rows in database order; cursors only mean
            // something over a stable one.
            const sorted = Arr.sortWith([...endpoints], (item) => item.id, Order.String);
            const page = yield* paginate(sorted, (endpoint) => endpoint.id, query);
            return {
              data: page.data.map(toEndpointResponse),
              pageInfo: page.pageInfo,
            };
          })(),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            WebhookServiceError: (e) => Effect.fail(new ApiWebhookServiceError({ cause: e.cause })),
          }),
        ),
      )
      .handle("getWebhookEndpoint", ({ params, query }) =>
        bridgeAuthSession(
          Effect.fn("WebhooksGroupLive")(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
            const projectId = yield* resolveRequestProjectId(authSession, query.projectId);
            const endpoint = yield* webhookManagerService.getEndpointById({
              endpointId: params.endpointId,
              projectId,
            });
            return toEndpointResponse(endpoint);
          })(),
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
      .handle("updateWebhookEndpoint", ({ params, payload, query }) =>
        bridgeAuthSession(
          Effect.fn("WebhooksGroupLive")(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
            const projectId = yield* resolveRequestProjectId(authSession, query.projectId);
            const { description, ...endpointUpdates } = payload;
            const endpoint = yield* webhookManagerService.updateEndpoint({
              ...endpointUpdates,
              ...(description === undefined
                ? {}
                : { description: Option.fromNullishOr(description) }),
              endpointId: params.endpointId,
              projectId,
            });
            return toEndpointResponse(endpoint);
          })(),
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
      .handle("deleteWebhookEndpoint", ({ params, query }) =>
        bridgeAuthSession(
          Effect.fn("WebhooksGroupLive")(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
            const projectId = yield* resolveRequestProjectId(authSession, query.projectId);
            return yield* webhookManagerService.deleteEndpoint({
              endpointId: params.endpointId,
              projectId,
            });
          })(),
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
      .handle("rotateWebhookSecret", ({ params, query }) =>
        bridgeAuthSession(
          Effect.fn("WebhooksGroupLive")(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
            const projectId = yield* resolveRequestProjectId(authSession, query.projectId);
            const endpoint = yield* webhookManagerService.rotateSecret({
              endpointId: params.endpointId,
              projectId,
            });
            return new WebhookEndpointWithSecret(endpoint);
          })(),
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
      .handle("testWebhookEndpoint", ({ params, query }) =>
        bridgeAuthSession(
          Effect.fn("WebhooksGroupLive")(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
            const projectId = yield* resolveRequestProjectId(authSession, query.projectId);
            const delivery = yield* webhookManagerService.testEndpoint({
              endpointId: params.endpointId,
              projectId,
            });
            return new WebhookDelivery(delivery);
          })(),
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
      .handle("listWebhookDeliveries", ({ query }) =>
        bridgeAuthSession(
          Effect.fn("WebhooksGroupLive")(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
            const projectId = yield* resolveRequestProjectId(authSession, query.projectId);
            const after = yield* toAfterDeliveryId(query.cursor);
            const page = yield* webhookManagerService.getDeliveriesPage({
              after,
              endpointId: query.endpointId,
              limit: query.limit,
              projectId,
            });
            let endCursor: string | typeof Schema.Null.Type = null;
            if (page.hasNextPage && page.endCursorId !== null) {
              endCursor = encodeCursor(page.endCursorId);
            }
            return {
              data: page.deliveries.map((delivery) => new WebhookDelivery(delivery)),
              pageInfo: { endCursor, hasNextPage: page.hasNextPage },
            };
          })(),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            WebhookServiceError: (e) => Effect.fail(new ApiWebhookServiceError({ cause: e.cause })),
          }),
        ),
      )
      .handle("getWebhookDelivery", ({ params, query }) =>
        bridgeAuthSession(
          Effect.fn("WebhooksGroupLive")(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
            const projectId = yield* resolveRequestProjectId(authSession, query.projectId);
            const delivery = yield* webhookManagerService.getDeliveryById({
              deliveryId: params.deliveryId,
              projectId,
            });
            return new WebhookDeliveryWithAttempts({
              ...delivery,
              attempts: delivery.attempts.map((attempt) => new WebhookDeliveryAttempt(attempt)),
            });
          })(),
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
      .handle("retryWebhookDelivery", ({ params, query }) =>
        bridgeAuthSession(
          Effect.fn("WebhooksGroupLive")(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
            const projectId = yield* resolveRequestProjectId(authSession, query.projectId);
            const delivery = yield* webhookManagerService.retryDelivery({
              deliveryId: params.deliveryId,
              projectId,
            });
            return new WebhookDelivery(delivery);
          })(),
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
