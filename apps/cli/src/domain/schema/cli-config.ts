import * as Schema from "effect/Schema";

/**
 * The resolved/effective CLI configuration returned by `CliConfig.readConfig`.
 * Also describes the shape of the shared base section stored on disk. It holds
 * no secrets: tokens are kept in the credential store, keyed by API host.
 */
export const ResolvedCliConfig = Schema.Struct({
  api_url: Schema.String,
  web_url: Schema.String,
  /** The id of the project commands act on outside linked directories (`voidhash-cli switch`). */
  default_project: Schema.optional(Schema.NullishOr(Schema.String)),
  /**
   * Directories bound to a project (`voidhash-cli link`): absolute path to
   * project id. A link applies to the directory and everything below it.
   */
  links: Schema.optional(Schema.Record(Schema.String, Schema.String)),
});
export type ResolvedCliConfig = typeof ResolvedCliConfig.Type;

/**
 * Per-profile overrides. Every field is optional and stored sparsely so that a
 * profile only carries the keys it actually overrides; any missing key falls
 * back to the shared base config when resolved.
 */
export const CliProfile = Schema.Struct({
  /** A key from before the credential store; moved into it on the next run. */
  api_key: Schema.optional(Schema.NullishOr(Schema.String)),
  api_url: Schema.optional(Schema.String),
  web_url: Schema.optional(Schema.String),
  default_project: Schema.optional(Schema.NullishOr(Schema.String)),
  links: Schema.optional(Schema.Record(Schema.String, Schema.String)),
});
export type CliProfile = typeof CliProfile.Type;

/**
 * The on-disk configuration file: the shared base config plus an optional map
 * of named profiles, each holding partial overrides merged onto the base.
 */
export const CliConfig = Schema.Struct({
  /** A key from before the credential store; moved into it on the next run. */
  api_key: Schema.optional(Schema.NullishOr(Schema.String)),
  api_url: Schema.String,
  web_url: Schema.String,
  default_project: Schema.optional(Schema.NullishOr(Schema.String)),
  links: Schema.optional(Schema.Record(Schema.String, Schema.String)),
  /**
   * A random id for this installation of the CLI, sent when it signs in so the
   * server keeps one session per installation.
   */
  install_id: Schema.optional(Schema.String),
  profiles: Schema.optional(Schema.Record(Schema.String, CliProfile)),
});
export type CliConfig = typeof CliConfig.Type;
