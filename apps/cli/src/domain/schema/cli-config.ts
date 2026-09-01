import * as Schema from "effect/Schema";

/**
 * The resolved/effective CLI configuration returned by `CliConfig.readConfig`.
 * Also describes the shape of the shared base section stored on disk.
 */
export const ResolvedCliConfig = Schema.Struct({
  api_key: Schema.NullishOr(Schema.String),
  api_url: Schema.String,
  web_url: Schema.String,
});
export type ResolvedCliConfig = typeof ResolvedCliConfig.Type;

/**
 * Per-profile overrides. Every field is optional and stored sparsely so that a
 * profile only carries the keys it actually overrides; any missing key falls
 * back to the shared base config when resolved.
 */
export const CliProfile = Schema.Struct({
  api_key: Schema.optional(Schema.NullishOr(Schema.String)),
  api_url: Schema.optional(Schema.String),
  web_url: Schema.optional(Schema.String),
});
export type CliProfile = typeof CliProfile.Type;

/**
 * The on-disk configuration file: the shared base config plus an optional map
 * of named profiles, each holding partial overrides merged onto the base.
 */
export const CliConfig = Schema.Struct({
  api_key: Schema.NullishOr(Schema.String),
  api_url: Schema.String,
  web_url: Schema.String,
  profiles: Schema.optional(Schema.Record(Schema.String, CliProfile)),
});
export type CliConfig = typeof CliConfig.Type;
