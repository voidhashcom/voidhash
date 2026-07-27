/**
 * Paywall deploy errors — typed errors returned by the paywall code-deploy
 * RPCs (dashboard read-side + release activation). Class names and `_tag`
 * values are namespaced with `Rpc` / `Rpc/`.
 */
import { Schema } from "effect";

/**
 * Catch-all paywall deploy service error. Wraps `DatabaseError`,
 * `PaywallArtifactStoreError`, and other infrastructural failures at the
 * public-method boundary so callers see one stable error tag.
 */
export class RpcPaywallDeployServiceError extends Schema.TaggedErrorClass<RpcPaywallDeployServiceError>(
  "RpcPaywallDeployServiceError",
)("Rpc/PaywallDeployServiceError", { cause: Schema.String }) {}

/**
 * A deploy-related validation failure — e.g. activating a release that was
 * never released. `violations` carries the per-item details.
 */
export class RpcPaywallDeployValidationError extends Schema.TaggedErrorClass<RpcPaywallDeployValidationError>(
  "RpcPaywallDeployValidationError",
)("Rpc/PaywallDeployValidationError", {
  message: Schema.String,
  violations: Schema.Array(Schema.String),
}) {}
