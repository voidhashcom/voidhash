/**
 * Audit-log errors — typed errors returned by audit-log RPCs. Class names
 * and `_tag` values are namespaced with `Rpc` / `Rpc/`.
 */
import * as Schema from "effect/Schema";

/**
 * Catch-all audit-log service error. Wraps `DatabaseError` (and other
 * infrastructural failures) at the public-method boundary so callers see
 * one stable error tag.
 */
export class RpcAuditLogServiceError extends Schema.TaggedErrorClass<RpcAuditLogServiceError>(
  "RpcAuditLogServiceError",
)("Rpc/AuditLogServiceError", { cause: Schema.String }) {}
