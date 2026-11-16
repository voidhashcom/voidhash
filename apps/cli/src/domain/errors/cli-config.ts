import * as Schema from "effect/Schema";

export class CliConfigFileNotFoundError extends Schema.TaggedError<CliConfigFileNotFoundError>(
  "ConfigFileNotFoundError",
)("ConfigFileNotFoundError", { cause: Schema.optional(Schema.Unknown), message: Schema.String }) {}

export class FailedToReadCliConfigError extends Schema.TaggedError<FailedToReadCliConfigError>(
  "FailedToReadConfigError",
)("FailedToReadConfigError", { cause: Schema.optional(Schema.Unknown), message: Schema.String }) {}
