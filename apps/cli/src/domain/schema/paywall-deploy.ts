/**
 * The deploy manifest contract (schemaVersion 2) — the payload `voidhash-cli
 * deploy` produces at `.voidhash/.build/manifest.json` and uploads to the
 * Voidhash backend. The wire-format source of truth is
 * `docs/specs/paywall-deploy-contract.md` (§1); these schemas mirror it
 * exactly and MUST stay in sync. Breaking changes bump the schema version.
 */
import { Schema } from "effect";

/** Current deploy manifest schema version (contract §1). */
export const DEPLOY_MANIFEST_VERSION = 2 as const;

/** Paywall/component slug shape (contract §1.1). */
export const DEPLOY_SLUG_REGEX = /^[a-z0-9][a-z0-9-]{0,63}$/;

const SHA256_HEX_REGEX = /^[a-f0-9]{64}$/;

/** A slug identifier derived from a source file name, e.g. `onboarding`. */
export const DeploySlugSchema = Schema.String.check(
  Schema.isPattern(DEPLOY_SLUG_REGEX),
);

/** Lowercase hex SHA-256 digest. */
export const DeploySha256Schema = Schema.String.check(
  Schema.isPattern(SHA256_HEX_REGEX),
);

/** A file's identity: where it lives, how big it is, and its content hash. */
export const DeployFileSchema = Schema.Struct({
  /** Path relative to the project root, POSIX-separated. */
  path: Schema.String,
  bytes: Schema.Number.check(Schema.isInt()),
  /** Lowercase hex SHA-256 of the file's raw bytes. */
  sha256: DeploySha256Schema,
});
export type DeployFile = typeof DeployFileSchema.Type;

/** A deployable output file with its MIME type. */
export const DeployArtifactSchema = Schema.Struct({
  ...DeployFileSchema.fields,
  contentType: Schema.String,
});
export type DeployArtifact = typeof DeployArtifactSchema.Type;

/** A binary asset (image, font, …) referenced by one or more paywalls. */
export const DeployAssetSchema = DeployArtifactSchema;
export type DeployAsset = typeof DeployAssetSchema.Type;

/** Author variable values: `string | number | boolean` only (contract §1.1). */
export const DeployVariableValueSchema = Schema.Union([
  Schema.String,
  Schema.Number,
  Schema.Boolean,
]);
export type DeployVariableValue = typeof DeployVariableValueSchema.Type;

/** The paywall's author variables, keyed by name. */
export const DeployVariablesSchema = Schema.Record(
  Schema.String,
  DeployVariableValueSchema,
);
export type DeployVariables = typeof DeployVariablesSchema.Type;

/** The compiled, WebView-ready output for a single paywall. */
export const DeployPaywallArtifactsSchema = Schema.Struct({
  /** The HTML shell that boots the paywall in a WebView. */
  html: DeployArtifactSchema,
  /** The bundled JS (paywall tree + renderer + React) the shell loads. */
  js: DeployArtifactSchema,
});
export type DeployPaywallArtifacts = typeof DeployPaywallArtifactsSchema.Type;

/** One paywall in the deploy manifest (contract §1). */
export const DeployPaywallSchema = Schema.Struct({
  /** Slug derived from the source file name, e.g. `onboarding`. */
  id: DeploySlugSchema,
  title: Schema.String,
  description: Schema.optional(Schema.String),
  /** Product slugs the paywall uses (may be empty). */
  products: Schema.Array(Schema.String),
  variables: DeployVariablesSchema,
  /** The raw author source for this paywall. */
  source: DeployFileSchema,
  artifacts: DeployPaywallArtifactsSchema,
  /** Paths into the manifest's top-level `assets[]` this paywall references. */
  assets: Schema.Array(Schema.String),
  /**
   * `sha256(sha256(html) + ":" + sha256(js) + ":" + sortedAssetHashes.join(":"))`
   * (contract §1.2) — the paywall's deployable identity: storage prefix, cache
   * key, dedupe key.
   */
  contentHash: DeploySha256Schema,
});
export type DeployPaywall = typeof DeployPaywallSchema.Type;

/** One rendered preview state of a component (contract §3 node tree file). */
export const DeployComponentPreviewSchema = Schema.Struct({
  state: Schema.String,
  file: DeployArtifactSchema,
});
export type DeployComponentPreview = typeof DeployComponentPreviewSchema.Type;

/** The compiled artifacts of a component. */
export const DeployComponentArtifactsSchema = Schema.Struct({
  /** ESM bundle of the component module (react/@voidhash/paywalls external). */
  runtime: DeployArtifactSchema,
  /** Custom editor panel bundle, or `null` when none is declared. */
  panel: Schema.NullOr(DeployArtifactSchema),
});
export type DeployComponentArtifacts =
  typeof DeployComponentArtifactsSchema.Type;

/** One reusable component in the deploy manifest (contract §1). */
export const DeployComponentSchema = Schema.Struct({
  /** Slug derived from the source file name, e.g. `product-option`. */
  id: DeploySlugSchema,
  title: Schema.optional(Schema.String),
  /** The raw author source for this component. */
  source: DeployFileSchema,
  /** The §2 component manifest artifact. */
  manifest: DeployArtifactSchema,
  /** §3 preview node trees, one per preview state. */
  previews: Schema.Array(DeployComponentPreviewSchema),
  artifacts: DeployComponentArtifactsSchema,
  /**
   * `sha256(sha256(manifest) + ":" + sha256(runtime) + ":" + (sha256(panel) | "")
   * + ":" + sortedPreviewHashes.join(":"))` (contract §1.2).
   */
  contentHash: DeploySha256Schema,
});
export type DeployComponent = typeof DeployComponentSchema.Type;

/** The full manifest written to `.voidhash/.build/manifest.json` (contract §1). */
export const DeployManifestSchema = Schema.Struct({
  schemaVersion: Schema.Literal(DEPLOY_MANIFEST_VERSION),
  cliVersion: Schema.String,
  /** Version of `@voidhash/paywalls` the bundles were built against. */
  runtimeVersion: Schema.String,
  /** Organization slug. */
  team: Schema.String,
  /** Project slug. */
  project: Schema.String,
  /** ISO-8601 build timestamp. */
  createdAt: Schema.String,
  paywalls: Schema.Array(DeployPaywallSchema),
  components: Schema.Array(DeployComponentSchema),
  /** The project's `voidhash.config.*`. */
  config: DeployFileSchema,
  /** Every binary asset, deduped by path. */
  assets: Schema.Array(DeployAssetSchema),
}).check(
  // Contract §1.1: at least one paywall or one component.
  Schema.makeFilter(
    (manifest: {
      readonly paywalls: ReadonlyArray<unknown>;
      readonly components: ReadonlyArray<unknown>;
    }) =>
      manifest.paywalls.length > 0 || manifest.components.length > 0
        ? undefined
        : "manifest must contain at least one paywall or one component",
  ),
);
export type DeployManifest = typeof DeployManifestSchema.Type;
