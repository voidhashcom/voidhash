import * as Schema from "effect/Schema";

/** Generic API key service error */
export class ApiApiKeyServiceError extends Schema.TaggedErrorClass<ApiApiKeyServiceError>()(
  "Api/ApiKeyServiceError",
  {
    cause: Schema.String,
  },
  { httpApiStatus: 500 },
) {}

/** API key not found */
export class ApiApiKeyNotFoundError extends Schema.TaggedErrorClass<ApiApiKeyNotFoundError>()(
  "Api/ApiKeyNotFoundError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 404 },
) {}
