import { Option, Schema } from "effect";

/**
 * Error codes that App Store Server API responses return.
 * @see https://developer.apple.com/documentation/appstoreserverapi/error_codes
 */
export const APIErrorCode = {
  GENERAL_BAD_REQUEST: 4000000,
  INVALID_APP_IDENTIFIER: 4000002,
  INVALID_REQUEST_REVISION: 4000005,
  INVALID_TRANSACTION_ID: 4000006,
  INVALID_ORIGINAL_TRANSACTION_ID: 4000008,
  INVALID_EXTEND_BY_DAYS: 4000009,
  INVALID_EXTEND_REASON_CODE: 4000010,
  INVALID_REQUEST_IDENTIFIER: 4000011,
  START_DATE_TOO_FAR_IN_PAST: 4000012,
  START_DATE_AFTER_END_DATE: 4000013,
  INVALID_PAGINATION_TOKEN: 4000014,
  INVALID_START_DATE: 4000015,
  INVALID_END_DATE: 4000016,
  PAGINATION_TOKEN_EXPIRED: 4000017,
  INVALID_NOTIFICATION_TYPE: 4000018,
  MULTIPLE_FILTERS_SUPPLIED: 4000019,
  INVALID_TEST_NOTIFICATION_TOKEN: 4000020,
  INVALID_SORT: 4000021,
  INVALID_PRODUCT_TYPE: 4000022,
  INVALID_PRODUCT_ID: 4000023,
  INVALID_SUBSCRIPTION_GROUP_IDENTIFIER: 4000024,
  /** @deprecated */
  INVALID_EXCLUDE_REVOKED: 4000025,
  INVALID_IN_APP_OWNERSHIP_TYPE: 4000026,
  INVALID_EMPTY_STOREFRONT_COUNTRY_CODE_LIST: 4000027,
  INVALID_STOREFRONT_COUNTRY_CODE: 4000028,
  INVALID_REVOKED: 4000030,
  INVALID_STATUS: 4000031,
  INVALID_ACCOUNT_TENURE: 4000032,
  INVALID_APP_ACCOUNT_TOKEN: 4000033,
  INVALID_CONSUMPTION_STATUS: 4000034,
  INVALID_CUSTOMER_CONSENTED: 4000035,
  INVALID_DELIVERY_STATUS: 4000036,
  INVALID_LIFETIME_DOLLARS_PURCHASED: 4000037,
  INVALID_LIFETIME_DOLLARS_REFUNDED: 4000038,
  INVALID_PLATFORM: 4000039,
  INVALID_PLAY_TIME: 4000040,
  INVALID_SAMPLE_CONTENT_PROVIDED: 4000041,
  INVALID_USER_STATUS: 4000042,
  /** @deprecated */
  INVALID_TRANSACTION_NOT_CONSUMABLE: 4000043,
  INVALID_TRANSACTION_TYPE_NOT_SUPPORTED: 4000047,
  APP_TRANSACTION_ID_NOT_SUPPORTED_ERROR: 4000048,
  INVALID_IMAGE: 4000161,
  HEADER_TOO_LONG: 4000162,
  BODY_TOO_LONG: 4000163,
  INVALID_LOCALE: 4000164,
  ALT_TEXT_TOO_LONG: 4000175,
  INVALID_APP_ACCOUNT_TOKEN_UUID_ERROR: 4000183,
  FAMILY_TRANSACTION_NOT_SUPPORTED_ERROR: 4000185,
  TRANSACTION_ID_IS_NOT_ORIGINAL_TRANSACTION_ID_ERROR: 4000187,
  SUBSCRIPTION_EXTENSION_INELIGIBLE: 4030004,
  SUBSCRIPTION_MAX_EXTENSION: 4030005,
  FAMILY_SHARED_SUBSCRIPTION_EXTENSION_INELIGIBLE: 4030007,
  MAXIMUM_NUMBER_OF_IMAGES_REACHED: 4030014,
  MAXIMUM_NUMBER_OF_MESSAGES_REACHED: 4030016,
  MESSAGE_NOT_APPROVED: 4030017,
  IMAGE_NOT_APPROVED: 4030018,
  IMAGE_IN_USE: 4030019,
  ACCOUNT_NOT_FOUND: 4040001,
  ACCOUNT_NOT_FOUND_RETRYABLE: 4040002,
  APP_NOT_FOUND: 4040003,
  APP_NOT_FOUND_RETRYABLE: 4040004,
  ORIGINAL_TRANSACTION_ID_NOT_FOUND: 4040005,
  ORIGINAL_TRANSACTION_ID_NOT_FOUND_RETRYABLE: 4040006,
  SERVER_NOTIFICATION_URL_NOT_FOUND: 4040007,
  TEST_NOTIFICATION_NOT_FOUND: 4040008,
  STATUS_REQUEST_NOT_FOUND: 4040009,
  TRANSACTION_ID_NOT_FOUND: 4040010,
  IMAGE_NOT_FOUND: 4040014,
  MESSAGE_NOT_FOUND: 4040015,
  APP_TRANSACTION_DOES_NOT_EXIST_ERROR: 4040019,
  IMAGE_ALREADY_EXISTS: 4090000,
  MESSAGE_ALREADY_EXISTS: 4090001,
  RATE_LIMIT_EXCEEDED: 4290000,
  GENERAL_INTERNAL: 5000000,
  GENERAL_INTERNAL_RETRYABLE: 5000001,
} as const;

export type APIErrorCode = (typeof APIErrorCode)[keyof typeof APIErrorCode];

export const APIErrorCodeSchema = Schema.Union(
  Object.values(APIErrorCode).map((code) => Schema.Literal(code)),
);

/**
 * Validation errors (4000xxx) - invalid parameters, IDs, formats.
 */
export class AppStoreValidationError extends Schema.TaggedErrorClass<AppStoreValidationError>(
  "AppStoreValidationError",
)("AppStoreValidationError", {
  httpStatusCode: Schema.Number,
  apiError: Schema.Option(Schema.Number),
  errorMessage: Schema.Option(Schema.String),
}) {}

/**
 * Not found errors (4040xxx) - resource doesn't exist.
 */
export class AppStoreNotFoundError extends Schema.TaggedErrorClass<AppStoreNotFoundError>(
  "AppStoreNotFoundError",
)("AppStoreNotFoundError", {
  httpStatusCode: Schema.Number,
  apiError: Schema.Option(Schema.Number),
  errorMessage: Schema.Option(Schema.String),
}) {
  get isRetryable(): boolean {
    return (
      Option.contains(this.apiError, APIErrorCode.ACCOUNT_NOT_FOUND_RETRYABLE) ||
      Option.contains(this.apiError, APIErrorCode.APP_NOT_FOUND_RETRYABLE) ||
      Option.contains(this.apiError, APIErrorCode.ORIGINAL_TRANSACTION_ID_NOT_FOUND_RETRYABLE)
    );
  }
}

/**
 * Subscription extension errors (4030004-4030007).
 */
export class AppStoreSubscriptionExtensionError extends Schema.TaggedErrorClass<AppStoreSubscriptionExtensionError>(
  "AppStoreSubscriptionExtensionError",
)("AppStoreSubscriptionExtensionError", {
  httpStatusCode: Schema.Number,
  apiError: Schema.Option(Schema.Number),
  errorMessage: Schema.Option(Schema.String),
}) {}

/**
 * Messaging errors (4030014-4030019).
 */
export class AppStoreMessagingError extends Schema.TaggedErrorClass<AppStoreMessagingError>(
  "AppStoreMessagingError",
)("AppStoreMessagingError", {
  httpStatusCode: Schema.Number,
  apiError: Schema.Option(Schema.Number),
  errorMessage: Schema.Option(Schema.String),
}) {}

/**
 * Conflict errors (4090xxx) - resource already exists.
 */
export class AppStoreConflictError extends Schema.TaggedErrorClass<AppStoreConflictError>(
  "AppStoreConflictError",
)("AppStoreConflictError", {
  httpStatusCode: Schema.Number,
  apiError: Schema.Option(Schema.Number),
  errorMessage: Schema.Option(Schema.String),
}) {}

/**
 * Unauthorized (HTTP 401). Returned by Apple when the bearer token is missing,
 * malformed, or signed with a key that is not authorised for the bundle/issuer.
 * Apple does not assign a specific `errorCode` for this case, so we key off the
 * HTTP status alone.
 */
export class AppStoreUnauthorizedError extends Schema.TaggedErrorClass<AppStoreUnauthorizedError>(
  "AppStoreUnauthorizedError",
)("AppStoreUnauthorizedError", {
  httpStatusCode: Schema.Number,
  errorMessage: Schema.Option(Schema.String),
}) {}

/**
 * Rate limit exceeded (4290000).
 */
export class AppStoreRateLimitError extends Schema.TaggedErrorClass<AppStoreRateLimitError>(
  "AppStoreRateLimitError",
)("AppStoreRateLimitError", {
  httpStatusCode: Schema.Number,
  errorMessage: Schema.Option(Schema.String),
}) {}

/**
 * Internal server errors (5000xxx).
 */
export class AppStoreInternalError extends Schema.TaggedErrorClass<AppStoreInternalError>(
  "AppStoreInternalError",
)("AppStoreInternalError", {
  httpStatusCode: Schema.Number,
  apiError: Schema.Option(Schema.Number),
  errorMessage: Schema.Option(Schema.String),
}) {
  get isRetryable(): boolean {
    return Option.contains(this.apiError, APIErrorCode.GENERAL_INTERNAL_RETRYABLE);
  }
}

/**
 * Union type for all App Store API errors.
 */
export type AppStoreApiError =
  | AppStoreValidationError
  | AppStoreSubscriptionExtensionError
  | AppStoreMessagingError
  | AppStoreNotFoundError
  | AppStoreConflictError
  | AppStoreUnauthorizedError
  | AppStoreRateLimitError
  | AppStoreInternalError;

/**
 * Factory function to create the appropriate API error type based on error code.
 */
export function createAppStoreApiError(
  httpStatusCode: number,
  apiError: Option.Option<number>,
  errorMessage: Option.Option<string>,
): AppStoreApiError {
  // Unauthorized (401) — Apple does not assign a dedicated errorCode for this.
  if (httpStatusCode === 401) {
    return new AppStoreUnauthorizedError({ httpStatusCode, errorMessage });
  }

  // Rate limit
  if (Option.contains(apiError, APIErrorCode.RATE_LIMIT_EXCEEDED)) {
    return new AppStoreRateLimitError({ httpStatusCode, errorMessage });
  }

  // Not found (404xxxx)
  if (Option.exists(apiError, (code) => code >= 4040001 && code <= 4040019)) {
    return new AppStoreNotFoundError({ httpStatusCode, apiError, errorMessage });
  }

  // Subscription extension (4030004-4030007)
  if (Option.exists(apiError, (code) => code >= 4030004 && code <= 4030007)) {
    return new AppStoreSubscriptionExtensionError({
      httpStatusCode,
      apiError,
      errorMessage,
    });
  }

  // Messaging (4030014-4030019)
  if (Option.exists(apiError, (code) => code >= 4030014 && code <= 4030019)) {
    return new AppStoreMessagingError({
      httpStatusCode,
      apiError,
      errorMessage,
    });
  }

  // Conflict (409xxxx)
  if (Option.exists(apiError, (code) => code >= 4090000 && code <= 4090001)) {
    return new AppStoreConflictError({ httpStatusCode, apiError, errorMessage });
  }

  // Internal server (5000xxx)
  if (Option.exists(apiError, (code) => code >= 5000000 && code <= 5000001)) {
    return new AppStoreInternalError({ httpStatusCode, apiError, errorMessage });
  }

  // Default: validation error (covers all 4000xxx codes and unknown)
  return new AppStoreValidationError({ httpStatusCode, apiError, errorMessage });
}
