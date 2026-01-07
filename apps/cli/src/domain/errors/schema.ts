import { Data } from "effect";

export class LocalSchemaNotFoundError extends Data.TaggedError(
  "LocalSchemaNotFoundError"
)<{
  path: string;
}> {}

export class LocalSchemaParseError extends Data.TaggedError(
  "LocalSchemaParseError"
)<{
  message: string;
}> {}

export class RemoteSchemaFetchError extends Data.TaggedError(
  "RemoteSchemaFetchError"
)<{
  cause: unknown;
}> {}

export class MissingProviderConfigurationError extends Data.TaggedError(
  "MissingProviderConfigurationError"
)<{
  providers: string[];
}> {}

export class SchemaValidationError extends Data.TaggedError(
  "SchemaValidationError"
)<{
  issues: string[];
}> {}

export class ChangeDeploymentError extends Data.TaggedError(
  "ChangeDeploymentError"
)<{
  cause: unknown;
  change: string;
}> {}

export class SchemaCheckFailedError extends Data.TaggedError(
  "SchemaCheckFailedError"
)<{
  message: string;
}> {}
