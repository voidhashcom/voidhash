import * as Schema from "effect/Schema";

export class PackageJsonNotFoundError extends Schema.TaggedErrorClass<PackageJsonNotFoundError>("PackageJsonNotFoundError")(
  "PackageJsonNotFoundError",
  { message: Schema.String },
) {}

export class InvalidPackageJsonError extends Schema.TaggedErrorClass<InvalidPackageJsonError>("InvalidPackageJsonError")(
  "InvalidPackageJsonError",
  { message: Schema.String, cause: Schema.optional(Schema.Unknown) },
) {}

export class FailedToLoadPackageJsonError extends Schema.TaggedErrorClass<FailedToLoadPackageJsonError>("FailedToLoadPackageJsonError")(
  "FailedToLoadPackageJsonError",
  { message: Schema.String, cause: Schema.optional(Schema.Unknown) },
) {}

export class NoPackageManagerFoundError extends Schema.TaggedErrorClass<NoPackageManagerFoundError>("NoPackageManagerFoundError")(
  "NoPackageManagerFoundError",
  { message: Schema.String },
) {}

export class FailedToDetectPackageManagerError extends Schema.TaggedErrorClass<FailedToDetectPackageManagerError>("FailedToDetectPackageManagerError")(
  "FailedToDetectPackageManagerError",
  { message: Schema.String, cause: Schema.optional(Schema.Unknown) },
) {}

export class VoidhashConfigNotFoundError extends Schema.TaggedErrorClass<VoidhashConfigNotFoundError>("VoidhashConfigNotFoundError")(
  "VoidhashConfigNotFoundError",
  { message: Schema.String },
) {}

export class InvalidVoidhashConfigError extends Schema.TaggedErrorClass<InvalidVoidhashConfigError>("InvalidVoidhashConfigError")(
  "InvalidVoidhashConfigError",
  { message: Schema.String, cause: Schema.optional(Schema.Unknown) },
) {}

export class FailedToLoadVoidhashConfigError extends Schema.TaggedErrorClass<FailedToLoadVoidhashConfigError>("FailedToLoadVoidhashConfigError")(
  "FailedToLoadVoidhashConfigError",
  { message: Schema.String, cause: Schema.optional(Schema.Unknown) },
) {}
