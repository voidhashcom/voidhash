import * as Schema from "effect/Schema";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

import {
  RpcAgentAttachmentValidationError,
  RpcAgentSessionNotFoundError,
  RpcAgentSessionServiceError,
} from "../errors/AgentSession.ts";
import { RpcActionForbiddenError } from "../errors/common.ts";
import { AuthMiddleware } from "../middlewares.ts";

/** Searchable metadata returned for a durable agent session. */
export const AgentSessionSummary = Schema.Struct({
  id: Schema.String,
  organizationId: Schema.String,
  projectId: Schema.String,
  surface: Schema.String,
  paywallId: Schema.NullOr(Schema.String),
  userId: Schema.String,
  title: Schema.String,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
});
export type AgentSessionSummary = typeof AgentSessionSummary.Type;

/** Public attachment metadata accepted by the Pi prompt protocol. */
export const AgentAttachment = Schema.Struct({
  url: Schema.String,
  name: Schema.String,
  contentType: Schema.String,
  sizeBytes: Schema.Number,
});
export type AgentAttachment = typeof AgentAttachment.Type;

/** Authenticated metadata and attachment operations for durable Pi sessions. */
export class AgentSessionRpcsDef extends RpcGroup.make(
  Rpc.make("ListAgentSessions", {
    error: Schema.Union([RpcAgentSessionServiceError, RpcActionForbiddenError]),
    payload: {
      organizationId: Schema.String,
      projectId: Schema.String,
      surface: Schema.String,
      paywallId: Schema.optional(Schema.String),
    },
    success: Schema.Array(AgentSessionSummary),
  }),
  Rpc.make("GetAgentSession", {
    error: Schema.Union([
      RpcAgentSessionServiceError,
      RpcActionForbiddenError,
      RpcAgentSessionNotFoundError,
    ]),
    payload: { sessionId: Schema.String },
    success: AgentSessionSummary,
  }),
  Rpc.make("DeleteAgentSession", {
    error: Schema.Union([
      RpcAgentSessionServiceError,
      RpcActionForbiddenError,
      RpcAgentSessionNotFoundError,
    ]),
    payload: { sessionId: Schema.String },
    success: Schema.Void,
  }),
  Rpc.make("RevertAgentEditSession", {
    error: Schema.Union([
      RpcAgentSessionServiceError,
      RpcActionForbiddenError,
      RpcAgentSessionNotFoundError,
    ]),
    payload: { sessionId: Schema.String, editSessionId: Schema.String },
    success: Schema.Void,
  }),
  Rpc.make("UploadAgentAttachment", {
    error: Schema.Union([
      RpcAgentSessionServiceError,
      RpcActionForbiddenError,
      RpcAgentAttachmentValidationError,
    ]),
    payload: {
      sessionId: Schema.String,
      organizationId: Schema.String,
      name: Schema.String,
      contentType: Schema.String,
      dataBase64: Schema.String,
    },
    success: AgentAttachment,
  }),
).middleware(AuthMiddleware) {}

export { AgentSessionSummary as AgentSessionSummarySchema };
export { AgentAttachment as AgentAttachmentSchema };
