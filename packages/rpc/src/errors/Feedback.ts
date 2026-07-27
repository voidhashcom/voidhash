/**
 * Feedback errors — typed error returned by the feedback RPC. Class name and
 * `_tag` value are namespaced with `Rpc` / `Rpc/`.
 */
import { Schema } from "effect";

/**
 * Catch-all feedback service error. Wraps database/infrastructure failures at
 * the public-method boundary so callers see one stable error tag.
 */
export class RpcFeedbackServiceError extends Schema.TaggedErrorClass<RpcFeedbackServiceError>(
  "RpcFeedbackServiceError",
)("Rpc/FeedbackServiceError", { message: Schema.String }) {}
