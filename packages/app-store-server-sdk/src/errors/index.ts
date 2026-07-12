export {
  APIErrorCode,
  type APIErrorCode as APIErrorCodeType,
  APIErrorCodeSchema,
  AppStoreValidationError,
  AppStoreNotFoundError,
  AppStoreSubscriptionExtensionError,
  AppStoreMessagingError,
  AppStoreConflictError,
  AppStoreUnauthorizedError,
  AppStoreRateLimitError,
  AppStoreInternalError,
  type AppStoreApiError,
  createAppStoreApiError,
} from "./api-errors.ts";

export {
  AppStoreJwtError,
  AppStoreNetworkError,
  AppStoreParseError,
  AppStoreSchemaError,
  type AppStoreClientError,
} from "./client-errors.ts";

export type AppStoreError =
  | import("./api-errors.ts").AppStoreApiError
  | import("./client-errors.ts").AppStoreClientError;

export {
  VerificationStatus,
  type VerificationStatus as VerificationStatusType,
  VerificationStatusSchema,
  VerificationError,
  JwtCreationError,
  CertificateError,
} from "./verification-errors.ts";
