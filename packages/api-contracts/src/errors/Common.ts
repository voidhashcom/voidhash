import * as Schema from "effect/Schema";

/** Action is forbidden due to insufficient permissions */
export class ApiActionForbiddenError extends Schema.TaggedErrorClass<ApiActionForbiddenError>()(
  "Api/ActionForbiddenError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 403 },
) {}

/**
 * The supplied credential is missing, malformed, expired or unknown.
 *
 * Distinct from {@link ApiAuthServiceError}: this is the caller's fault and is
 * safe to retry only after fixing the credential.
 */
export class ApiAuthenticationError extends Schema.TaggedErrorClass<ApiAuthenticationError>()(
  "Api/AuthenticationError",
  {
    cause: Schema.String,
    message: Schema.String,
  },
  { httpApiStatus: 401 },
) {}

/**
 * Authentication could not be completed because a dependency failed — the
 * identity provider, the key store, the database. The credential itself may be
 * perfectly valid, so this is a server fault and is retryable.
 */
export class ApiAuthServiceError extends Schema.TaggedErrorClass<ApiAuthServiceError>()(
  "Api/AuthServiceError",
  {
    cause: Schema.String,
    message: Schema.String,
  },
  { httpApiStatus: 500 },
) {}

/** User is not authenticated */
export class ApiNotAuthenticatedError extends Schema.TaggedErrorClass<ApiNotAuthenticatedError>()(
  "Api/NotAuthenticatedError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 401 },
) {}
