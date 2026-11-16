import * as Schema from "effect/Schema";

export class PackageJsonNotFoundError extends Schema.TaggedError<PackageJsonNotFoundError>(
  "PackageJsonNotFoundError",
)("PackageJsonNotFoundError", { message: Schema.String }) {}

export class InvalidPackageJsonError extends Schema.TaggedError<InvalidPackageJsonError>(
  "InvalidPackageJsonError",
)("InvalidPackageJsonError", { message: Schema.String, cause: Schema.optional(Schema.Unknown) }) {}

export class FailedToLoadPackageJsonError extends Schema.TaggedError<FailedToLoadPackageJsonError>(
  "FailedToLoadPackageJsonError",
)("FailedToLoadPackageJsonError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export class NoPackageManagerFoundError extends Schema.TaggedError<NoPackageManagerFoundError>(
  "NoPackageManagerFoundError",
)("NoPackageManagerFoundError", { message: Schema.String }) {}

export class FailedToDetectPackageManagerError extends Schema.TaggedError<FailedToDetectPackageManagerError>(
  "FailedToDetectPackageManagerError",
)("FailedToDetectPackageManagerError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export class VoidhashConfigNotFoundError extends Schema.TaggedError<VoidhashConfigNotFoundError>(
  "VoidhashConfigNotFoundError",
)("VoidhashConfigNotFoundError", { message: Schema.String }) {}

export class InvalidVoidhashConfigError extends Schema.TaggedError<InvalidVoidhashConfigError>(
  "InvalidVoidhashConfigError",
)("InvalidVoidhashConfigError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export class FailedToLoadVoidhashConfigError extends Schema.TaggedError<FailedToLoadVoidhashConfigError>(
  "FailedToLoadVoidhashConfigError",
)("FailedToLoadVoidhashConfigError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}
