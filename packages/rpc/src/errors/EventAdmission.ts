/**
 * Event admission errors — typed errors returned by the event-admission RPCs.
 * Class names and `_tag` values are namespaced with `Rpc` / `Rpc/`.
 */
import * as Schema from "effect/Schema";

/**
 * Catch-all event-admission service error. Wraps unknown built-in keys, invalid
 * custom event names, and infrastructural failures at the public-method boundary
 * so callers see one stable error tag.
 */
export class RpcEventAdmissionServiceError extends Schema.TaggedErrorClass<RpcEventAdmissionServiceError>(
  "RpcEventAdmissionServiceError",
)("Rpc/EventAdmissionServiceError", { message: Schema.String }) {}
