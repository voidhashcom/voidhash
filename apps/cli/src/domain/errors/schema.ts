import * as Schema from "effect/Schema";

export class RemoteSchemaFetchError extends Schema.TaggedError<RemoteSchemaFetchError>(
  "RemoteSchemaFetchError",
)("RemoteSchemaFetchError", { cause: Schema.Unknown }) {}

export class SchemaCheckFailedError extends Schema.TaggedError<SchemaCheckFailedError>(
  "SchemaCheckFailedError",
)("SchemaCheckFailedError", { message: Schema.String }) {}
