import * as Schema from "effect/Schema";

export class NoSignedInUserError extends Schema.TaggedErrorClass<NoSignedInUserError>(
  "NoSignedInUserError",
)("NoSignedInUserError", { cause: Schema.optional(Schema.Unknown), message: Schema.String }) {}

export class FailedToGetSessionError extends Schema.TaggedErrorClass<FailedToGetSessionError>(
  "FailedToGetSessionError",
)("FailedToGetSessionError", { cause: Schema.optional(Schema.Unknown), message: Schema.String }) {}

export class FailedToLogoutError extends Schema.TaggedErrorClass<FailedToLogoutError>(
  "FailedToLogoutError",
)("FailedToLogoutError", { cause: Schema.optional(Schema.Unknown), message: Schema.String }) {}

export class FailedToLoginError extends Schema.TaggedErrorClass<FailedToLoginError>(
  "FailedToLoginError",
)("FailedToLoginError", { cause: Schema.optional(Schema.Unknown), message: Schema.String }) {}
