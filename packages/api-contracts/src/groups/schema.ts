import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import { ApiActionForbiddenError, ApiSchemaServiceError } from "../errors/index.ts";
import { AuthMiddleware } from "../Middlewares.ts";
import { ProjectSchemaResponse, SchemaVersion } from "../Schema.ts";

/**
 * Query parameters shared by both schema reads. The schema is project-scoped,
 * so a credential that spans more than one project must name the one it means;
 * key-based credentials carry exactly one and can omit it.
 */
const SchemaReadParams = Schema.Struct({
  projectId: Schema.optional(Schema.String),
});

export const SchemaGroup = HttpApiGroup.make("schema")
  /**
   * The consolidated project schema — products, perks, locations and enabled
   * providers — behind a `sha256:<hex>` `ETag`. Honours `If-None-Match` with a
   * `304`, so the CLI watch loop can revalidate cheaply.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.get("getSchema", "/", {
      query: SchemaReadParams,
      success: ProjectSchemaResponse,
      error: [ApiActionForbiddenError, ApiSchemaServiceError],
    }),
  )
  /**
   * The schema version hash on its own, for drift checks that do not need the
   * body. Same `ETag` / `If-None-Match` contract as the full read.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.get("getSchemaVersion", "/version", {
      query: SchemaReadParams,
      success: SchemaVersion,
      error: [ApiActionForbiddenError, ApiSchemaServiceError],
    }),
  )
  .middleware(AuthMiddleware)
  .prefix("/schema");
