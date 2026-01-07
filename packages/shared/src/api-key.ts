import { Schema } from "effect";

export class ApiKeyServiceError extends Schema.TaggedError<ApiKeyServiceError>()(
  "ApiKeyServiceError",
  {
    cause: Schema.String,
  }
) {}

export class ApiKeyNotFoundError extends Schema.TaggedError<ApiKeyNotFoundError>()(
  "ApiKeyNotFoundError",
  {
    message: Schema.String,
  }
) {}
