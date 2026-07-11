/**
 * API key errors — typed errors returned by api-key RPCs. Class names and
 * `_tag` values are namespaced with `Rpc` / `Rpc/`.
 */
import { Schema } from "effect";

/** API key row not found in the database. */
export class RpcApiKeyNotFoundError extends Schema.TaggedErrorClass<RpcApiKeyNotFoundError>(
  "RpcApiKeyNotFoundError",
)("Rpc/ApiKeyNotFoundError", { message: Schema.String }) {}

/**
 * Catch-all api-key service error. Wraps `DatabaseError` (and other
 * infrastructural failures) at the public-method boundary so callers see
 * one stable error tag.
 */
export class RpcApiKeyServiceError extends Schema.TaggedErrorClass<RpcApiKeyServiceError>(
  "RpcApiKeyServiceError",
)("Rpc/ApiKeyServiceError", { cause: Schema.String }) {}
