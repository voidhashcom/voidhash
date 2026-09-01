import { Rpc, RpcGroup } from "effect/unstable/rpc";
import * as Schema from "effect/Schema";

import { RpcAuditLogServiceError } from "../errors/AuditLog.ts";
import { RpcActionForbiddenError } from "../errors/common.ts";
import {
  RpcFeatureFlagKeyAlreadyExistsError,
  RpcFeatureFlagNotFoundError,
  RpcFeatureFlagOverrideNotFoundError,
  RpcFeatureFlagServiceError,
  RpcFeatureFlagTargetNotFoundError,
} from "../errors/FeatureFlag.ts";
import { AuthMiddleware } from "../middlewares.ts";

export const RpcFeatureFlagType = Schema.Literals(["boolean", "string", "number", "json"]);
export type RpcFeatureFlagType = typeof RpcFeatureFlagType.Type;

export const RpcFeatureFlagTarget = Schema.Struct({
  archivedAt: Schema.NullOr(Schema.Date),
  createdAt: Schema.NullOr(Schema.Date),
  featureFlagId: Schema.String,
  id: Schema.String,
  identityType: Schema.Number,
  identityValue: Schema.String,
  listType: Schema.Number,
  updatedAt: Schema.NullOr(Schema.Date),
});
export type RpcFeatureFlagTarget = typeof RpcFeatureFlagTarget.Type;

export const RpcFeatureFlagOverride = Schema.Struct({
  archivedAt: Schema.NullOr(Schema.Date),
  createdAt: Schema.NullOr(Schema.Date),
  createdByUserId: Schema.NullOr(Schema.String),
  featureFlagId: Schema.String,
  forcedEnabled: Schema.NullOr(Schema.Boolean),
  id: Schema.String,
  identityType: Schema.Number,
  identityValue: Schema.String,
  note: Schema.NullOr(Schema.String),
  updatedAt: Schema.NullOr(Schema.Date),
  updatedByUserId: Schema.NullOr(Schema.String),
});
export type RpcFeatureFlagOverride = typeof RpcFeatureFlagOverride.Type;

export const RpcFeatureFlagVariant = Schema.Struct({
  archivedAt: Schema.NullOr(Schema.Date),
  createdAt: Schema.NullOr(Schema.Date),
  featureFlagId: Schema.String,
  id: Schema.String,
  label: Schema.NullOr(Schema.String),
  updatedAt: Schema.NullOr(Schema.Date),
  value: Schema.Unknown,
});
export type RpcFeatureFlagVariant = typeof RpcFeatureFlagVariant.Type;

export const RpcFeatureFlag = Schema.Struct({
  archivedAt: Schema.NullOr(Schema.Date),
  createdAt: Schema.NullOr(Schema.Date),
  createdByUserId: Schema.NullOr(Schema.String),
  description: Schema.NullOr(Schema.String),
  isEnabled: Schema.Boolean,
  id: Schema.String,
  isInternal: Schema.Boolean,
  overrides: Schema.Array(RpcFeatureFlagOverride),
  ownerId: Schema.NullOr(Schema.String),
  ownerType: Schema.NullOr(Schema.String),
  projectId: Schema.String,
  rolloutBps: Schema.Number,
  slug: Schema.String,
  targets: Schema.Array(RpcFeatureFlagTarget),
  type: RpcFeatureFlagType,
  updatedAt: Schema.NullOr(Schema.Date),
  updatedByUserId: Schema.NullOr(Schema.String),
  variants: Schema.Array(RpcFeatureFlagVariant),
  version: Schema.Number,
}).pipe(Schema.encodeKeys({ isEnabled: "enabled", isInternal: "internal" }));
export type RpcFeatureFlag = typeof RpcFeatureFlag.Type;

export const RpcFeatureFlagListItem = Schema.Struct({
  archivedAt: Schema.NullOr(Schema.Date),
  createdAt: Schema.NullOr(Schema.Date),
  description: Schema.NullOr(Schema.String),
  isEnabled: Schema.Boolean,
  id: Schema.String,
  isInternal: Schema.Boolean,
  ownerId: Schema.NullOr(Schema.String),
  ownerType: Schema.NullOr(Schema.String),
  projectId: Schema.String,
  rolloutBps: Schema.Number,
  slug: Schema.String,
  type: RpcFeatureFlagType,
  updatedAt: Schema.NullOr(Schema.Date),
  variantCount: Schema.Number,
  version: Schema.Number,
}).pipe(Schema.encodeKeys({ isEnabled: "enabled", isInternal: "internal" }));
export type RpcFeatureFlagListItem = typeof RpcFeatureFlagListItem.Type;

const commonError = Schema.Union([
  RpcFeatureFlagServiceError,
  RpcActionForbiddenError,
  RpcAuditLogServiceError,
]);
const flagNotFoundError = Schema.Union([
  RpcFeatureFlagServiceError,
  RpcFeatureFlagNotFoundError,
  RpcActionForbiddenError,
  RpcAuditLogServiceError,
]);

export class FeatureFlagRpcsDef extends RpcGroup.make(
  Rpc.make("ListFeatureFlags", {
    error: commonError,
    payload: {
      includeArchived: Schema.optional(Schema.Boolean),
      projectId: Schema.String,
    },
    success: Schema.Array(RpcFeatureFlagListItem),
  }),
  Rpc.make("GetFeatureFlag", {
    error: flagNotFoundError,
    payload: {
      id: Schema.String,
    },
    success: RpcFeatureFlag,
  }),
  Rpc.make("CreateFeatureFlag", {
    error: Schema.Union([
      RpcFeatureFlagServiceError,
      RpcFeatureFlagKeyAlreadyExistsError,
      RpcActionForbiddenError,
      RpcAuditLogServiceError,
    ]),
    payload: {
      description: Schema.optional(Schema.String),
      projectId: Schema.String,
      slug: Schema.String,
      type: RpcFeatureFlagType,
      variants: Schema.Array(
        Schema.Struct({
          label: Schema.optional(Schema.String),
          value: Schema.Unknown,
        }),
      ),
    },
    success: Schema.Struct({ id: Schema.String }),
  }),
  Rpc.make("UpdateFeatureFlag", {
    error: Schema.Union([
      RpcFeatureFlagServiceError,
      RpcFeatureFlagNotFoundError,
      RpcFeatureFlagKeyAlreadyExistsError,
      RpcActionForbiddenError,
      RpcAuditLogServiceError,
    ]),
    payload: {
      description: Schema.optional(Schema.NullOr(Schema.String)),
      enabled: Schema.optional(Schema.Boolean),
      id: Schema.String,
      rolloutBps: Schema.optional(Schema.Number),
      slug: Schema.optional(Schema.String),
    },
    success: RpcFeatureFlag,
  }),
  Rpc.make("ArchiveFeatureFlag", {
    error: flagNotFoundError,
    payload: {
      id: Schema.String,
    },
    success: Schema.Void,
  }),
  Rpc.make("RestoreFeatureFlag", {
    error: flagNotFoundError,
    payload: {
      id: Schema.String,
    },
    success: Schema.Void,
  }),
  Rpc.make("UpsertFeatureFlagOverride", {
    error: Schema.Union([
      RpcFeatureFlagServiceError,
      RpcFeatureFlagNotFoundError,
      RpcActionForbiddenError,
      RpcAuditLogServiceError,
    ]),
    payload: {
      featureFlagId: Schema.String,
      forcedEnabled: Schema.optional(Schema.NullOr(Schema.Boolean)),
      identityType: Schema.Number,
      identityValue: Schema.String,
      note: Schema.optional(Schema.String),
    },
    success: Schema.Struct({ id: Schema.String }),
  }),
  Rpc.make("ArchiveFeatureFlagOverride", {
    error: Schema.Union([
      RpcFeatureFlagServiceError,
      RpcFeatureFlagOverrideNotFoundError,
      RpcActionForbiddenError,
      RpcAuditLogServiceError,
    ]),
    payload: {
      id: Schema.String,
    },
    success: Schema.Void,
  }),
  Rpc.make("ListFeatureFlagOverridesByFlag", {
    error: flagNotFoundError,
    payload: {
      featureFlagId: Schema.String,
    },
    success: Schema.Array(RpcFeatureFlagOverride),
  }),
  Rpc.make("ListFeatureFlagOverridesByPerson", {
    error: commonError,
    payload: {
      identityType: Schema.Number,
      identityValue: Schema.String,
      projectId: Schema.String,
    },
    success: Schema.Array(RpcFeatureFlagOverride),
  }),
  Rpc.make("UpsertFeatureFlagTarget", {
    error: Schema.Union([
      RpcFeatureFlagServiceError,
      RpcFeatureFlagNotFoundError,
      RpcActionForbiddenError,
      RpcAuditLogServiceError,
    ]),
    payload: {
      featureFlagId: Schema.String,
      identityType: Schema.Number,
      identityValue: Schema.String,
      listType: Schema.Number,
    },
    success: Schema.Struct({ id: Schema.String }),
  }),
  Rpc.make("ArchiveFeatureFlagTarget", {
    error: Schema.Union([
      RpcFeatureFlagServiceError,
      RpcFeatureFlagTargetNotFoundError,
      RpcActionForbiddenError,
      RpcAuditLogServiceError,
    ]),
    payload: {
      id: Schema.String,
    },
    success: Schema.Void,
  }),
  Rpc.make("UpdateFeatureFlagVariants", {
    error: Schema.Union([
      RpcFeatureFlagServiceError,
      RpcFeatureFlagNotFoundError,
      RpcActionForbiddenError,
      RpcAuditLogServiceError,
    ]),
    payload: {
      featureFlagId: Schema.String,
      variants: Schema.Array(
        Schema.Struct({
          id: Schema.optional(Schema.String),
          label: Schema.optional(Schema.String),
          value: Schema.Unknown,
        }),
      ),
    },
    success: Schema.Void,
  }),
).middleware(AuthMiddleware) {}
