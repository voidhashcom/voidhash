import { Rpc, RpcGroup } from "effect/unstable/rpc";
import { Schema } from "effect";

import { RpcActionForbiddenError } from "../errors/common.ts";
import {
  RpcExperimentKeyAlreadyExistsError,
  RpcExperimentNotFoundError,
  RpcExperimentServiceError,
  RpcExperimentTreatmentNotFoundError,
  RpcExperimentValidationError,
  RpcExperimentVariantNotFoundError,
} from "../errors/Experiment.ts";
import { AuthMiddleware } from "../middlewares.ts";

export const RpcExperimentVariant = Schema.Struct({
  archivedAt: Schema.NullOr(Schema.Date),
  createdAt: Schema.NullOr(Schema.Date),
  experimentId: Schema.String,
  id: Schema.String,
  isControl: Schema.Boolean,
  key: Schema.String,
  name: Schema.String,
  updatedAt: Schema.NullOr(Schema.Date),
  weightBps: Schema.Number,
});

export const RpcExperimentTreatment = Schema.Struct({
  archivedAt: Schema.NullOr(Schema.Date),
  config: Schema.Unknown,
  createdAt: Schema.NullOr(Schema.Date),
  experimentId: Schema.String,
  id: Schema.String,
  treatmentType: Schema.String,
  updatedAt: Schema.NullOr(Schema.Date),
  variantId: Schema.String,
});

/** Summary of the backing feature flag (runtime assignment artifact). */
export const RpcExperimentBackingFlag = Schema.Struct({
  enabled: Schema.Boolean,
  id: Schema.String,
  key: Schema.String,
  rolloutBps: Schema.Number,
});

const experimentScalarFields = {
  archivedAt: Schema.NullOr(Schema.Date),
  createdAt: Schema.NullOr(Schema.Date),
  createdByUserId: Schema.NullOr(Schema.String),
  description: Schema.NullOr(Schema.String),
  endedAt: Schema.NullOr(Schema.Date),
  featureFlagId: Schema.String,
  hypothesis: Schema.NullOr(Schema.String),
  id: Schema.String,
  key: Schema.String,
  name: Schema.String,
  primaryMetricEventName: Schema.String,
  projectId: Schema.String,
  secondaryMetricEventNames: Schema.NullOr(Schema.Array(Schema.String)),
  startedAt: Schema.NullOr(Schema.Date),
  status: Schema.Number,
  updatedAt: Schema.NullOr(Schema.Date),
  updatedByUserId: Schema.NullOr(Schema.String),
  version: Schema.Number,
  winningVariantId: Schema.NullOr(Schema.String),
};

export const RpcExperiment = Schema.Struct({
  ...experimentScalarFields,
  backingFlag: Schema.NullOr(RpcExperimentBackingFlag),
  treatments: Schema.Array(RpcExperimentTreatment),
  variants: Schema.Array(RpcExperimentVariant),
});

export const RpcExperimentListItem = Schema.Struct({
  ...experimentScalarFields,
  variantCount: Schema.Number,
});

export const RpcExperimentVariantResult = Schema.Struct({
  conversionRate: Schema.Number,
  conversions: Schema.Number,
  exposures: Schema.Number,
  revenueUsd: Schema.Number,
  variantKey: Schema.String,
});

export const RpcExperimentResults = Schema.Struct({
  variants: Schema.Array(RpcExperimentVariantResult),
});

const RpcVariantInput = Schema.Struct({
  isControl: Schema.Boolean,
  key: Schema.String,
  name: Schema.String,
  weightBps: Schema.Number,
});

const commonError = Schema.Union([RpcExperimentServiceError, RpcActionForbiddenError]);
const notFoundError = Schema.Union([
  RpcExperimentServiceError,
  RpcExperimentNotFoundError,
  RpcActionForbiddenError,
]);
const editError = Schema.Union([
  RpcExperimentServiceError,
  RpcExperimentNotFoundError,
  RpcExperimentValidationError,
  RpcExperimentVariantNotFoundError,
  RpcActionForbiddenError,
]);

export class ExperimentRpcsDef extends RpcGroup.make(
  Rpc.make("ListExperiments", {
    error: commonError,
    payload: {
      includeArchived: Schema.optional(Schema.Boolean),
      projectId: Schema.String,
    },
    success: Schema.Array(RpcExperimentListItem),
  }),
  Rpc.make("GetExperiment", {
    error: notFoundError,
    payload: { id: Schema.String },
    success: RpcExperiment,
  }),
  Rpc.make("CreateExperiment", {
    error: Schema.Union([
      RpcExperimentServiceError,
      RpcExperimentKeyAlreadyExistsError,
      RpcActionForbiddenError,
    ]),
    payload: {
      description: Schema.optional(Schema.String),
      hypothesis: Schema.optional(Schema.String),
      key: Schema.String,
      name: Schema.String,
      primaryMetricEventName: Schema.String,
      projectId: Schema.String,
      secondaryMetricEventNames: Schema.optional(Schema.Array(Schema.String)),
    },
    success: Schema.Struct({ id: Schema.String }),
  }),
  Rpc.make("UpdateExperiment", {
    error: Schema.Union([
      RpcExperimentServiceError,
      RpcExperimentNotFoundError,
      RpcExperimentValidationError,
      RpcActionForbiddenError,
    ]),
    payload: {
      description: Schema.optional(Schema.NullOr(Schema.String)),
      hypothesis: Schema.optional(Schema.NullOr(Schema.String)),
      id: Schema.String,
      name: Schema.optional(Schema.String),
      primaryMetricEventName: Schema.optional(Schema.String),
      secondaryMetricEventNames: Schema.optional(Schema.NullOr(Schema.Array(Schema.String))),
    },
    success: RpcExperiment,
  }),
  Rpc.make("ReplaceExperimentVariants", {
    error: editError,
    payload: {
      experimentId: Schema.String,
      variants: Schema.Array(RpcVariantInput),
    },
    success: Schema.Void,
  }),
  Rpc.make("UpsertExperimentTreatment", {
    error: editError,
    payload: {
      config: Schema.Unknown,
      experimentId: Schema.String,
      treatmentType: Schema.String,
      variantId: Schema.String,
    },
    success: Schema.Struct({ id: Schema.String }),
  }),
  Rpc.make("RemoveExperimentTreatment", {
    error: Schema.Union([
      RpcExperimentServiceError,
      RpcExperimentTreatmentNotFoundError,
      RpcExperimentValidationError,
      RpcExperimentNotFoundError,
      RpcActionForbiddenError,
    ]),
    payload: { id: Schema.String },
    success: Schema.Void,
  }),
  Rpc.make("StartExperiment", {
    error: Schema.Union([
      RpcExperimentServiceError,
      RpcExperimentNotFoundError,
      RpcExperimentValidationError,
      RpcActionForbiddenError,
    ]),
    payload: { id: Schema.String },
    success: Schema.Void,
  }),
  Rpc.make("PauseExperiment", {
    error: Schema.Union([
      RpcExperimentServiceError,
      RpcExperimentNotFoundError,
      RpcExperimentValidationError,
      RpcActionForbiddenError,
    ]),
    payload: { id: Schema.String },
    success: Schema.Void,
  }),
  Rpc.make("ConcludeExperiment", {
    error: editError,
    payload: {
      id: Schema.String,
      winningVariantId: Schema.optional(Schema.String),
    },
    success: Schema.Void,
  }),
  Rpc.make("ArchiveExperiment", {
    error: notFoundError,
    payload: { id: Schema.String },
    success: Schema.Void,
  }),
  Rpc.make("RestoreExperiment", {
    error: notFoundError,
    payload: { id: Schema.String },
    success: Schema.Void,
  }),
  Rpc.make("GetExperimentResults", {
    error: commonError,
    payload: {
      days: Schema.optional(Schema.Number),
      experimentId: Schema.String,
    },
    success: RpcExperimentResults,
  }),
).middleware(AuthMiddleware) {}
