import * as Schema from "effect/Schema";

export class NoSignedInUserError extends Schema.TaggedError<NoSignedInUserError>(
  "NoSignedInUserError",
)("NoSignedInUserError", { cause: Schema.optional(Schema.Unknown), message: Schema.String }) {}

export class FailedToGetSessionError extends Schema.TaggedError<FailedToGetSessionError>(
  "FailedToGetSessionError",
)("FailedToGetSessionError", { cause: Schema.optional(Schema.Unknown), message: Schema.String }) {}

export class FailedToLogoutError extends Schema.TaggedError<FailedToLogoutError>(
  "FailedToLogoutError",
)("FailedToLogoutError", { cause: Schema.optional(Schema.Unknown), message: Schema.String }) {}

export class FailedToLoginError extends Schema.TaggedError<FailedToLoginError>(
  "FailedToLoginError",
)("FailedToLoginError", { cause: Schema.optional(Schema.Unknown), message: Schema.String }) {}

export class FailedToStoreCredentialError extends Schema.TaggedError<FailedToStoreCredentialError>(
  "FailedToStoreCredentialError",
)("FailedToStoreCredentialError", {
  cause: Schema.optional(Schema.Unknown),
  message: Schema.String,
}) {}

/**
 * Why a device sign-in ended without a token: the person denied it, the code
 * expired, or the server no longer knows the code or refused the request.
 */
export class DeviceLoginError extends Schema.TaggedError<DeviceLoginError>("DeviceLoginError")(
  "DeviceLoginError",
  {
    reason: Schema.Literals(["denied", "expired", "invalid_grant", "rejected"]),
    message: Schema.String,
  },
) {}
