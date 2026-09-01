import * as Schema from "effect/Schema";

/**
 * Catch-all error for the consolidated schema endpoints
 * (`GET /api/v1/schema`, `GET /api/v1/schema/version`,
 * `GET /api/v1/sdk/schema`). Wraps `DatabaseError` and similar
 * infrastructure failures at the route boundary.
 */
export class ApiSchemaServiceError extends Schema.TaggedErrorClass<ApiSchemaServiceError>()(
  "Api/SchemaServiceError",
  {
    cause: Schema.String,
  },
  { httpApiStatus: 500 },
) {}
