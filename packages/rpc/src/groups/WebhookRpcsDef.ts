import { Rpc, RpcGroup } from "effect/unstable/rpc";
import * as Schema from "effect/Schema";

import { RpcActionForbiddenError } from "../errors/common.ts";
import {
  RpcWebhookDeliveryNotFoundError,
  RpcWebhookEndpointNotFoundError,
  RpcWebhookServiceError,
  RpcWebhookValidationError,
} from "../errors/webhook.ts";
import { AuthMiddleware } from "../middlewares.ts";

/**
 * A webhook endpoint as returned by reads. The signing secret is deliberately
 * absent: it is shown once at creation and once per rotation, and is not
 * recoverable afterwards. Use {@link WebhookEndpointWithSecret} for those two.
 */
export const WebhookEndpoint = Schema.Struct({
  consecutiveFailures: Schema.Number,
  createdAt: Schema.NullOr(Schema.Date),
  description: Schema.NullOr(Schema.String),
  events: Schema.Array(Schema.String),
  id: Schema.String,
  lastSuccessAt: Schema.NullOr(Schema.Date),
  name: Schema.String,
  projectId: Schema.String,
  status: Schema.Union([
    Schema.Literal("active"),
    Schema.Literal("disabled"),
    Schema.Literal("failed"),
  ]),
  url: Schema.String,
});
export type WebhookEndpoint = typeof WebhookEndpoint.Type;

/**
 * A webhook endpoint plus its plaintext signing secret. Returned only by
 * `CreateWebhookEndpoint` and `RotateWebhookSecret`, mirroring the HTTP
 * surface, which are the only moments the caller can still capture it.
 */
export const WebhookEndpointWithSecret = Schema.Struct({
  ...WebhookEndpoint.fields,
  secret: Schema.String,
});
export type WebhookEndpointWithSecret = typeof WebhookEndpointWithSecret.Type;

export const WebhookDelivery = Schema.Struct({
  attemptCount: Schema.Number,
  completedAt: Schema.NullOr(Schema.Date),
  createdAt: Schema.NullOr(Schema.Date),
  eventOccurredAt: Schema.Date,
  eventType: Schema.String,
  id: Schema.String,
  nextAttemptAt: Schema.NullOr(Schema.Date),
  payload: Schema.Unknown,
  projectId: Schema.String,
  status: Schema.Union([
    Schema.Literal("pending"),
    Schema.Literal("in_progress"),
    Schema.Literal("succeeded"),
    Schema.Literal("failed"),
    Schema.Literal("exhausted"),
  ]),
  webhookEndpointId: Schema.String,
});
export type WebhookDelivery = typeof WebhookDelivery.Type;

export const WebhookDeliveryAttempt = Schema.Struct({
  attemptNumber: Schema.Number,
  createdAt: Schema.NullOr(Schema.Date),
  durationMs: Schema.NullOr(Schema.Number),
  errorMessage: Schema.NullOr(Schema.String),
  id: Schema.String,
  responseBody: Schema.NullOr(Schema.String),
  statusCode: Schema.NullOr(Schema.Number),
  isSucceeded: Schema.Boolean,
}).pipe(Schema.encodeKeys({ isSucceeded: "succeeded" }));
export type WebhookDeliveryAttempt = typeof WebhookDeliveryAttempt.Type;

export const WebhookDeliveryWithAttempts = Schema.Struct({
  attemptCount: Schema.Number,
  attempts: Schema.Array(WebhookDeliveryAttempt),
  completedAt: Schema.NullOr(Schema.Date),
  createdAt: Schema.NullOr(Schema.Date),
  eventOccurredAt: Schema.Date,
  eventType: Schema.String,
  id: Schema.String,
  nextAttemptAt: Schema.NullOr(Schema.Date),
  payload: Schema.Unknown,
  projectId: Schema.String,
  status: Schema.Union([
    Schema.Literal("pending"),
    Schema.Literal("in_progress"),
    Schema.Literal("succeeded"),
    Schema.Literal("failed"),
    Schema.Literal("exhausted"),
  ]),
  webhookEndpointId: Schema.String,
});
export type WebhookDeliveryWithAttempts = typeof WebhookDeliveryWithAttempts.Type;

export class WebhookRpcsDef extends RpcGroup.make(
  Rpc.make("ListWebhookEndpoints", {
    error: Schema.Union([RpcWebhookServiceError, RpcActionForbiddenError]),
    payload: {
      projectId: Schema.String,
    },
    success: Schema.Array(WebhookEndpoint),
  }),
  Rpc.make("GetWebhookEndpoint", {
    error: Schema.Union([
      RpcWebhookServiceError,
      RpcWebhookEndpointNotFoundError,
      RpcActionForbiddenError,
    ]),
    payload: {
      endpointId: Schema.String,
      projectId: Schema.String,
    },
    success: WebhookEndpoint,
  }),
  Rpc.make("CreateWebhookEndpoint", {
    error: Schema.Union([
      RpcWebhookServiceError,
      RpcWebhookValidationError,
      RpcActionForbiddenError,
    ]),
    payload: {
      description: Schema.optional(Schema.String),
      events: Schema.Array(Schema.String),
      name: Schema.String,
      projectId: Schema.String,
      url: Schema.String,
    },
    success: WebhookEndpointWithSecret,
  }),
  Rpc.make("UpdateWebhookEndpoint", {
    error: Schema.Union([
      RpcWebhookServiceError,
      RpcWebhookValidationError,
      RpcWebhookEndpointNotFoundError,
      RpcActionForbiddenError,
    ]),
    payload: {
      description: Schema.optional(Schema.NullOr(Schema.String)),
      endpointId: Schema.String,
      events: Schema.optional(Schema.Array(Schema.String)),
      name: Schema.optional(Schema.String),
      projectId: Schema.String,
      status: Schema.optional(Schema.Union([Schema.Literal("active"), Schema.Literal("disabled")])),
      url: Schema.optional(Schema.String),
    },
    success: WebhookEndpoint,
  }),
  Rpc.make("DeleteWebhookEndpoint", {
    error: Schema.Union([
      RpcWebhookServiceError,
      RpcWebhookEndpointNotFoundError,
      RpcActionForbiddenError,
    ]),
    payload: {
      endpointId: Schema.String,
      projectId: Schema.String,
    },
    success: Schema.Void,
  }),
  Rpc.make("RotateWebhookSecret", {
    error: Schema.Union([
      RpcWebhookServiceError,
      RpcWebhookEndpointNotFoundError,
      RpcActionForbiddenError,
    ]),
    payload: {
      endpointId: Schema.String,
      projectId: Schema.String,
    },
    success: WebhookEndpointWithSecret,
  }),
  Rpc.make("TestWebhookEndpoint", {
    error: Schema.Union([
      RpcWebhookServiceError,
      RpcWebhookEndpointNotFoundError,
      RpcActionForbiddenError,
    ]),
    payload: {
      endpointId: Schema.String,
      projectId: Schema.String,
    },
    success: WebhookDelivery,
  }),
  Rpc.make("ListWebhookDeliveries", {
    error: Schema.Union([RpcWebhookServiceError, RpcActionForbiddenError]),
    payload: {
      endpointId: Schema.optional(Schema.String),
      projectId: Schema.String,
    },
    success: Schema.Array(WebhookDelivery),
  }),
  Rpc.make("GetWebhookDelivery", {
    error: Schema.Union([
      RpcWebhookServiceError,
      RpcWebhookDeliveryNotFoundError,
      RpcActionForbiddenError,
    ]),
    payload: {
      deliveryId: Schema.String,
      projectId: Schema.String,
    },
    success: WebhookDeliveryWithAttempts,
  }),
  Rpc.make("RetryWebhookDelivery", {
    error: Schema.Union([
      RpcWebhookServiceError,
      RpcWebhookDeliveryNotFoundError,
      RpcWebhookValidationError,
      RpcActionForbiddenError,
    ]),
    payload: {
      deliveryId: Schema.String,
      projectId: Schema.String,
    },
    success: WebhookDelivery,
  }),
).middleware(AuthMiddleware) {}
