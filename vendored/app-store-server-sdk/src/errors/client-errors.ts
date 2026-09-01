import * as Schema from "effect/Schema";

/**
 * Error when JWT/bearer token creation fails.
 */
export class AppStoreJwtError extends Schema.TaggedErrorClass<AppStoreJwtError>("AppStoreJwtError")(
  "AppStoreJwtError",
  {
    message: Schema.String,
    cause: Schema.OptionFromOptionalKey(Schema.Unknown),
  },
) {}

/**
 * Error when HTTP request fails (network error).
 */
export class AppStoreNetworkError extends Schema.TaggedErrorClass<AppStoreNetworkError>(
  "AppStoreNetworkError",
)("AppStoreNetworkError", {
  message: Schema.String,
  cause: Schema.OptionFromOptionalKey(Schema.Unknown),
}) {}

/**
 * Error when response body cannot be parsed as JSON.
 */
export class AppStoreParseError extends Schema.TaggedErrorClass<AppStoreParseError>(
  "AppStoreParseError",
)("AppStoreParseError", {
  httpStatusCode: Schema.Number,
  message: Schema.String,
}) {}

/**
 * Error when response body doesn't match expected schema.
 */
export class AppStoreSchemaError extends Schema.TaggedErrorClass<AppStoreSchemaError>(
  "AppStoreSchemaError",
)("AppStoreSchemaError", {
  httpStatusCode: Schema.Number,
  message: Schema.String,
}) {}

export type AppStoreClientError =
  | AppStoreJwtError
  | AppStoreNetworkError
  | AppStoreParseError
  | AppStoreSchemaError;
