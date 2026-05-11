import { Data } from "effect";

export class RemoteSchemaFetchError extends Data.TaggedError(
  "RemoteSchemaFetchError"
)<{
  cause: unknown;
}> {}

export class SchemaCheckFailedError extends Data.TaggedError(
  "SchemaCheckFailedError"
)<{
  message: string;
}> {}
