import * as Schema from "effect/Schema";

export class RemoteSchemaFetchError extends Schema.TaggedErrorClass<RemoteSchemaFetchError>(
  "RemoteSchemaFetchError",
)("RemoteSchemaFetchError", { cause: Schema.Unknown }) {}

export class SchemaCheckFailedError extends Schema.TaggedErrorClass<SchemaCheckFailedError>(
  "SchemaCheckFailedError",
)("SchemaCheckFailedError", { message: Schema.String }) {}
