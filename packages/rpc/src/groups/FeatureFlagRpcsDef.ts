import { Rpc, RpcGroup } from "effect/unstable/rpc";
import { Schema } from "effect";

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

export const RpcFeatureFlagVariant = Schema.Struct({
  archivedAt: Schema.NullOr(Schema.Date),
  createdAt: Schema.NullOr(Schema.Date),
  featureFlagId: Schema.String,
  id: Schema.String,
  key: Schema.String,
  name: Schema.String,
  payload: Schema.NullOr(Schema.Unknown),
  updatedAt: Schema.NullOr(Schema.Date),
  weightBps: Schema.Number,
});

export const RpcFeatureFlag = Schema.Struct({
  archivedAt: Schema.NullOr(Schema.Date),
  createdAt: Schema.NullOr(Schema.Date),
  createdByUserId: Schema.NullOr(Schema.String),
  description: Schema.NullOr(Schema.String),
  enabled: Schema.Boolean,
  id: Schema.String,
  internal: Schema.Boolean,
  key: Schema.String,
  name: Schema.String,
  overrides: Schema.Array(RpcFeatureFlagOverride),
  ownerId: Schema.NullOr(Schema.String),
  ownerType: Schema.NullOr(Schema.String),
  projectId: Schema.String,
  rolloutBps: Schema.Number,
  targets: Schema.Array(RpcFeatureFlagTarget),
  updatedAt: Schema.NullOr(Schema.Date),
  updatedByUserId: Schema.NullOr(Schema.String),
  variants: Schema.Array(RpcFeatureFlagVariant),
  version: Schema.Number,
});

export const RpcFeatureFlagListItem = Schema.Struct({
  archivedAt: Schema.NullOr(Schema.Date),
  createdAt: Schema.NullOr(Schema.Date),
  description: Schema.NullOr(Schema.String),
  enabled: Schema.Boolean,
  id: Schema.String,
  internal: Schema.Boolean,
  key: Schema.String,
  name: Schema.String,
  ownerId: Schema.NullOr(Schema.String),
  ownerType: Schema.NullOr(Schema.String),
  projectId: Schema.String,
  rolloutBps: Schema.Number,
  updatedAt: Schema.NullOr(Schema.Date),
  variantCount: Schema.Number,
  version: Schema.Number,
});

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
      key: Schema.String,
      name: Schema.String,
      projectId: Schema.String,
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
      key: Schema.optional(Schema.String),
      name: Schema.optional(Schema.String),
      rolloutBps: Schema.optional(Schema.Number),
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
          key: Schema.String,
          name: Schema.String,
          payload: Schema.optional(Schema.Unknown),
          weightBps: Schema.Number,
        }),
      ),
    },
    success: Schema.Void,
  }),
).middleware(AuthMiddleware) {}
