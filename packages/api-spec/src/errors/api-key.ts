import { Schema } from "effect";

/** Generic API key service error */
export class ApiKeyServiceError extends Schema.TaggedErrorClass<ApiKeyServiceError>()(
  "ApiKeyServiceError",
  {
    cause: Schema.String,
  },
  { httpApiStatus: 500 }
) {}

/** API key not found */
export class ApiKeyNotFoundError extends Schema.TaggedErrorClass<ApiKeyNotFoundError>()(
  "ApiKeyNotFoundError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 404 }
) {}
