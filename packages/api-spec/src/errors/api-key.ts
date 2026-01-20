import { HttpApiSchema } from "@effect/platform";
import { Schema } from "effect";

/** Generic API key service error */
export class ApiKeyServiceError extends Schema.TaggedError<ApiKeyServiceError>()(
  "ApiKeyServiceError",
  {
    cause: Schema.String,
  },
  HttpApiSchema.annotations({ status: 500 })
) {}

/** API key not found */
export class ApiKeyNotFoundError extends Schema.TaggedError<ApiKeyNotFoundError>()(
  "ApiKeyNotFoundError",
  {
    message: Schema.String,
  },
  HttpApiSchema.annotations({ status: 404 })
) {}
