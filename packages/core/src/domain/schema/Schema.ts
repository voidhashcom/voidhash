/**
 * Schema domain — the public DTO `SchemaService` returns from
 * `getProjectSchema` / `getProjectSchemaForSdk`, plus the provider literal it
 * surfaces in `enabledProviders` / `products[].providers`.
 *
 * The byte-level layout is part of the contract the CLI (`apps/cli`) and SDK
 * runtime consume — don't reorder fields without making the matching change
 * in `apps/cli/src/utils/schema/version.ts`, since the CLI's
 * `voidhash types check` compares the two hashes byte-for-byte.
 */
import { Schema } from "effect";

/**
 * Provider IDs the CLI / SDK currently understand. Other DB providers (today:
 * `"stripe"`) are filtered out at the projection boundary so the version hash
 * stays stable across CLI and server.
 */
export const SchemaProviderId = Schema.Literals(["appleAppStore", "googlePlay"]);
export type SchemaProviderId = typeof SchemaProviderId.Type;

export class SchemaPerk extends Schema.Class<SchemaPerk>("SchemaPerk")({
  slug: Schema.String,
  name: Schema.String,
}) {}

export class SchemaLocation extends Schema.Class<SchemaLocation>("SchemaLocation")({
  slug: Schema.String,
  name: Schema.String,
  description: Schema.NullOr(Schema.String),
}) {}

export class SchemaProductProvider extends Schema.Class<SchemaProductProvider>(
  "SchemaProductProvider",
)({
  providerId: SchemaProviderId,
  configuration: Schema.Record(Schema.String, Schema.Unknown),
}) {}

export class SchemaProduct extends Schema.Class<SchemaProduct>("SchemaProduct")({
  duration: Schema.NullOr(
    Schema.Literals(["weekly", "monthly", "quarterly", "semi-annual", "annual"]),
  ),
  slug: Schema.String,
  name: Schema.String,
  type: Schema.Literals(["subscription", "one-time", "one-time-consumable"]),
  /** Perk slugs, ascending. */
  perks: Schema.Array(Schema.String),
  /** Per-provider mappings, sorted by `providerId`. */
  providers: Schema.Array(SchemaProductProvider),
}) {}

/**
 * Public-facing schema DTO returned by `SchemaService.getProjectSchema` and
 * `SchemaService.getProjectSchemaForSdk`. Mirrors the CLI's `NormalizedSchema`
 * shape so the version hash stays consistent across both sides.
 *
 * `enabledProviders` is a derived view of the same provider rows present in
 * `products[].providers` — it's intentionally NOT part of the hash, since
 * including it would diverge from the CLI's `NormalizedSchema`-based hash.
 */
export class ProjectSchema extends Schema.Class<ProjectSchema>("ProjectSchema")({
  enabledProviders: Schema.Array(SchemaProviderId),
  locations: Schema.Array(SchemaLocation),
  perks: Schema.Array(SchemaPerk),
  products: Schema.Array(SchemaProduct),
  version: Schema.String,
}) {}
