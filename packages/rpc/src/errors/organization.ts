/**
 * Organization errors — typed errors returned by organization RPCs. Class
 * names and `_tag` values are namespaced with `Rpc` / `Rpc/`.
 */
import { Schema } from "effect";

/** Organization row not found in the database. */
export class RpcOrganizationNotFoundError extends Schema.TaggedErrorClass<RpcOrganizationNotFoundError>(
  "RpcOrganizationNotFoundError",
)("Rpc/OrganizationNotFoundError", { message: Schema.String }) {}

export class RpcOrganizationServiceError extends Schema.TaggedErrorClass<RpcOrganizationServiceError>(
  "RpcOrganizationServiceError",
)("Rpc/OrganizationServiceError", { cause: Schema.String }) {}
