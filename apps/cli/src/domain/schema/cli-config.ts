import { Schema } from "effect";

/**
 * The resolved/effective CLI configuration returned by `CliConfig.readConfig`.
 * Also describes the shape of the shared base section stored on disk.
 */
export const ResolvedCliConfigSchema = Schema.Struct({
  api_key: Schema.NullishOr(Schema.String),
  api_url: Schema.String,
  web_url: Schema.String,
});

/**
 * Per-profile overrides. Every field is optional and stored sparsely so that a
 * profile only carries the keys it actually overrides; any missing key falls
 * back to the shared base config when resolved.
 */
export const CliProfileSchema = Schema.Struct({
  api_key: Schema.optional(Schema.NullishOr(Schema.String)),
  api_url: Schema.optional(Schema.String),
  web_url: Schema.optional(Schema.String),
});

/**
 * The on-disk configuration file: the shared base config plus an optional map
 * of named profiles, each holding partial overrides merged onto the base.
 */
export const CliConfigSchema = Schema.Struct({
  api_key: Schema.NullishOr(Schema.String),
  api_url: Schema.String,
  web_url: Schema.String,
  profiles: Schema.optional(Schema.Record(Schema.String, CliProfileSchema)),
});
