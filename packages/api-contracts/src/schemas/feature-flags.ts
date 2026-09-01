/**
 * Feature-flag request/response schemas for the public HTTP API. Mirrors the
 * shapes served by `FeatureFlagRpcsDef` — the row column `key` is exposed as
 * `slug` and the variant column `name` as `label`, matching the RPC surface.
 */
import * as Schema from "effect/Schema";

import { PageParams } from "../Pagination.ts";

/** Value type a flag resolves to. `boolean` flags carry no payload. */
export const FeatureFlagType = Schema.Literals(["boolean", "string", "number", "json"]);
export type FeatureFlagType = typeof FeatureFlagType.Type;

/**
 * Identity a target or override is keyed on:
 * `1` person id, `2` distinct id, `3` email, `4` external id.
 */
export const FeatureFlagIdentityType = Schema.Literals([1, 2, 3, 4]);
export type FeatureFlagIdentityType = typeof FeatureFlagIdentityType.Type;

/** Target list semantics: `1` allow-list, `2` deny-list. */
export const FeatureFlagListType = Schema.Literals([1, 2]);
export type FeatureFlagListType = typeof FeatureFlagListType.Type;

export class FeatureFlagVariant extends Schema.Class<FeatureFlagVariant>("FeatureFlagVariant")({
  archivedAt: Schema.NullOr(Schema.Date),
  createdAt: Schema.NullOr(Schema.Date),
  featureFlagId: Schema.String,
  id: Schema.String,
  key: Schema.String,
  label: Schema.NullOr(Schema.String),
  updatedAt: Schema.NullOr(Schema.Date),
  value: Schema.NullOr(Schema.Unknown),
  weightBps: Schema.Number,
}) {}

export class FeatureFlagOverride extends Schema.Class<FeatureFlagOverride>("FeatureFlagOverride")({
  archivedAt: Schema.NullOr(Schema.Date),
  createdAt: Schema.NullOr(Schema.Date),
  featureFlagId: Schema.String,
  forcedEnabled: Schema.NullOr(Schema.Boolean),
  forcedVariantKey: Schema.NullOr(Schema.String),
  id: Schema.String,
  identityType: Schema.Number,
  identityValue: Schema.String,
  note: Schema.NullOr(Schema.String),
  updatedAt: Schema.NullOr(Schema.Date),
}) {}

export class FeatureFlagTarget extends Schema.Class<FeatureFlagTarget>("FeatureFlagTarget")({
  archivedAt: Schema.NullOr(Schema.Date),
  createdAt: Schema.NullOr(Schema.Date),
  featureFlagId: Schema.String,
  id: Schema.String,
  identityType: Schema.Number,
  identityValue: Schema.String,
  listType: Schema.Number,
  updatedAt: Schema.NullOr(Schema.Date),
}) {}

/** A flag with its variants, targets and (unarchived) overrides inlined. */
export class FeatureFlag extends Schema.Class<FeatureFlag>("FeatureFlag")({
  archivedAt: Schema.NullOr(Schema.Date),
  createdAt: Schema.NullOr(Schema.Date),
  description: Schema.NullOr(Schema.String),
  enabled: Schema.Boolean,
  id: Schema.String,
  overrides: Schema.Array(FeatureFlagOverride),
  projectId: Schema.String,
  rolloutBps: Schema.Number,
  slug: Schema.String,
  targets: Schema.Array(FeatureFlagTarget),
  type: FeatureFlagType,
  updatedAt: Schema.NullOr(Schema.Date),
  variants: Schema.Array(FeatureFlagVariant),
  version: Schema.Number,
}) {}

/** Collection projection: variant rows are collapsed to a count. */
export class FeatureFlagListItem extends Schema.Class<FeatureFlagListItem>("FeatureFlagListItem")({
  archivedAt: Schema.NullOr(Schema.Date),
  createdAt: Schema.NullOr(Schema.Date),
  description: Schema.NullOr(Schema.String),
  enabled: Schema.Boolean,
  id: Schema.String,
  projectId: Schema.String,
  rolloutBps: Schema.Number,
  slug: Schema.String,
  type: FeatureFlagType,
  updatedAt: Schema.NullOr(Schema.Date),
  variantCount: Schema.Number,
  version: Schema.Number,
}) {}

/** Query parameters accepted by `GET /feature-flags`. */
export const ListFeatureFlagsParams = Schema.Struct({
  ...PageParams.fields,
  includeArchived: Schema.optional(Schema.Literals(["true", "false"])),
  projectId: Schema.optional(Schema.String),
}).annotate({ identifier: "ListFeatureFlagsParams" });
export type ListFeatureFlagsParams = typeof ListFeatureFlagsParams.Type;

/** Query parameters accepted by `GET /feature-flag-overrides`. */
export const ListFeatureFlagOverridesParams = Schema.Struct({
  ...PageParams.fields,
  featureFlagId: Schema.optional(Schema.String),
  identityType: Schema.optional(Schema.FiniteFromString),
  identityValue: Schema.optional(Schema.String),
  projectId: Schema.optional(Schema.String),
}).annotate({ identifier: "ListFeatureFlagOverridesParams" });
export type ListFeatureFlagOverridesParams = typeof ListFeatureFlagOverridesParams.Type;

/** Query parameters accepted by `GET /feature-flag-targets`. */
export const ListFeatureFlagTargetsParams = Schema.Struct({
  ...PageParams.fields,
  featureFlagId: Schema.String,
  listType: Schema.optional(Schema.FiniteFromString),
  projectId: Schema.optional(Schema.String),
}).annotate({ identifier: "ListFeatureFlagTargetsParams" });
export type ListFeatureFlagTargetsParams = typeof ListFeatureFlagTargetsParams.Type;

export class CreateFeatureFlagBody extends Schema.Class<CreateFeatureFlagBody>(
  "CreateFeatureFlagBody",
)({
  description: Schema.optional(Schema.String),
  projectId: Schema.optional(Schema.String),
  slug: Schema.String,
  type: Schema.optional(FeatureFlagType),
  variants: Schema.optional(
    Schema.Array(
      Schema.Struct({
        label: Schema.optional(Schema.String),
        value: Schema.Unknown,
        weightBps: Schema.optional(Schema.Number),
      }),
    ),
  ),
}) {}

export class UpdateFeatureFlagBody extends Schema.Class<UpdateFeatureFlagBody>(
  "UpdateFeatureFlagBody",
)({
  description: Schema.optional(Schema.NullOr(Schema.String)),
  enabled: Schema.optional(Schema.Boolean),
  rolloutBps: Schema.optional(Schema.Number),
  slug: Schema.optional(Schema.String),
}) {}

/**
 * Full replacement of a flag's variant matrix. Variants carrying an `id` are
 * updated in place; the ones omitted from the array are archived.
 */
export class ReplaceFeatureFlagVariantsBody extends Schema.Class<ReplaceFeatureFlagVariantsBody>(
  "ReplaceFeatureFlagVariantsBody",
)({
  variants: Schema.Array(
    Schema.Struct({
      id: Schema.optional(Schema.String),
      label: Schema.optional(Schema.String),
      value: Schema.Unknown,
      weightBps: Schema.optional(Schema.Number),
    }),
  ),
}) {}

/** Upsert on the natural key `(featureFlagId, identityType, identityValue)`. */
export class UpsertFeatureFlagOverrideBody extends Schema.Class<UpsertFeatureFlagOverrideBody>(
  "UpsertFeatureFlagOverrideBody",
)({
  featureFlagId: Schema.String,
  forcedEnabled: Schema.optional(Schema.NullOr(Schema.Boolean)),
  forcedVariantKey: Schema.optional(Schema.NullOr(Schema.String)),
  identityType: FeatureFlagIdentityType,
  identityValue: Schema.String,
  note: Schema.optional(Schema.String),
}) {}

/** Upsert on the natural key `(featureFlagId, listType, identityType, identityValue)`. */
export class UpsertFeatureFlagTargetBody extends Schema.Class<UpsertFeatureFlagTargetBody>(
  "UpsertFeatureFlagTargetBody",
)({
  featureFlagId: Schema.String,
  identityType: FeatureFlagIdentityType,
  identityValue: Schema.String,
  listType: FeatureFlagListType,
}) {}

/**
 * Server-side evaluation input. At least one of `personId` / `distinctId` /
 * `email` / `externalIds` should be supplied; with none of them the flags are
 * evaluated anonymously (targets and overrides never match).
 */
export class EvaluateProjectFeatureFlagsBody extends Schema.Class<EvaluateProjectFeatureFlagsBody>(
  "EvaluateProjectFeatureFlagsBody",
)({
  distinctId: Schema.optional(Schema.String),
  email: Schema.optional(Schema.String),
  externalIds: Schema.optional(Schema.Array(Schema.String)),
  keys: Schema.optional(Schema.Array(Schema.String)),
  personId: Schema.optional(Schema.String),
  projectId: Schema.optional(Schema.String),
}) {}
