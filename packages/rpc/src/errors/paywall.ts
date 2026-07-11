/**
 * Paywall errors — typed errors returned by paywall RPCs (paywall not found
 * / slug conflicts) plus the catch-all paywall and paywall-release service
 * errors. Class names and `_tag` values are namespaced with `Rpc` / `Rpc/`.
 */
import { Schema } from "effect";

/** Paywall row not found in the database. */
export class RpcPaywallNotFoundError extends Schema.TaggedErrorClass<RpcPaywallNotFoundError>(
  "RpcPaywallNotFoundError",
)("Rpc/PaywallNotFoundError", { message: Schema.String }) {}

/** Paywall slug uniqueness invariant violated within a project. */
export class RpcPaywallSlugAlreadyExistsError extends Schema.TaggedErrorClass<RpcPaywallSlugAlreadyExistsError>(
  "RpcPaywallSlugAlreadyExistsError",
)("Rpc/PaywallSlugAlreadyExistsError", { slug: Schema.String }) {}

/**
 * Catch-all paywall service error. Wraps `DatabaseError`,
 * `MimicHostServiceError`, and other infrastructural failures at the
 * public-method boundary so callers see one stable error tag.
 */
export class RpcPaywallServiceError extends Schema.TaggedErrorClass<RpcPaywallServiceError>(
  "RpcPaywallServiceError",
)("Rpc/PaywallServiceError", { cause: Schema.String }) {}

/**
 * Catch-all paywall-release error. Wraps S3, DB, Mimic, and other
 * infrastructural failures at the public-method boundary so callers see one
 * stable tag.
 */
export class RpcPaywallReleaseError extends Schema.TaggedErrorClass<RpcPaywallReleaseError>(
  "RpcPaywallReleaseError",
)("Rpc/PaywallReleaseError", { cause: Schema.optional(Schema.Unknown), message: Schema.String }) {}

/** Release row not found in the database. */
export class RpcReleaseNotFoundError extends Schema.TaggedErrorClass<RpcReleaseNotFoundError>(
  "RpcReleaseNotFoundError",
)("Rpc/ReleaseNotFoundError", { releaseId: Schema.String }) {}
