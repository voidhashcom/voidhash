import * as Schema from "effect/Schema";

/** Stable RPC failure for durable session metadata or attachment storage. */
export class RpcAgentSessionServiceError extends Schema.TaggedErrorClass<RpcAgentSessionServiceError>(
  "RpcAgentSessionServiceError",
)("Rpc/AgentSessionServiceError", { message: Schema.String }) {}

/** Stable RPC failure for a durable session that does not exist. */
export class RpcAgentSessionNotFoundError extends Schema.TaggedErrorClass<RpcAgentSessionNotFoundError>(
  "RpcAgentSessionNotFoundError",
)("Rpc/AgentSessionNotFoundError", { sessionId: Schema.String }) {}

/** Stable RPC failure for invalid durable-session attachment input. */
export class RpcAgentAttachmentValidationError extends Schema.TaggedErrorClass<RpcAgentAttachmentValidationError>(
  "RpcAgentAttachmentValidationError",
)("Rpc/AgentAttachmentValidationError", { message: Schema.String }) {}
