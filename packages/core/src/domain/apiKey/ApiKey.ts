/**
 * API key domain — currently just the typed errors that signal an api-key
 * invariant violation. Row data lives in the `apiKeys` Drizzle table; an
 * `ApiKey` aggregate can be added here later when the entity gains behaviour
 * beyond CRUD.
 */
import * as Schema from "effect/Schema";

/**
 * API key row not found in the database.
 *
 * `apiKeyId` is optional because the auth-establishing validate paths
 * (`validateUserApiKey` / `validateSecretKey` / `validatePublishableKey`) look
 * up records by a raw, secret-equivalent key and have no row id to report on the
 * not-found path. Those callers MUST omit it rather than echo the raw key, which
 * is secret material that could leak into logs/spans (see
 * docs/attribute-registry.md §5). Id-carrying callers (lookup/rotate/delete/
 * revoke by id) still populate it with the real row id.
 */
export class ApiKeyNotFoundError extends Schema.TaggedErrorClass<ApiKeyNotFoundError>(
  "ApiKeyNotFoundError",
)("ApiKeyNotFoundError", { apiKeyId: Schema.optional(Schema.String) }) {}
