import { Rpc, RpcGroup } from "effect/unstable/rpc";
import { Schema } from "effect";

import { RpcActionForbiddenError } from "../errors/common.ts";
import {
  RpcExperimentNotFoundError,
  RpcExperimentServiceError,
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
  name: Schema.String,
  primaryMetricEventName: Schema.NullOr(Schema.String),
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
  /**
   * Distinct paywall locations targeted by any of the test's treatments. The
   * index table scopes its engagement metrics to these, since that is the
   * traffic the test actually splits.
   */
  paywallLocationIds: Schema.Array(Schema.String),
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

/**
 * One paywall-location treatment for a variant: what to show where. Only the
 * paywall is named — the serve path always follows its active published
 * version.
 */
const RpcVariantTreatmentInput = Schema.Struct({
  paywallId: Schema.String,
  paywallLocationId: Schema.String,
});

/**
 * A variant as edited in the setup matrix. `id` is present for variants that
 * already exist (so they keep their identity — and their share of bucketed
 * traffic — across saves) and absent for newly added ones.
 */
const RpcSaveVariantInput = Schema.Struct({
  id: Schema.optional(Schema.String),
  isControl: Schema.Boolean,
  name: Schema.String,
  treatments: Schema.Array(RpcVariantTreatmentInput),
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
  // Creation asks for a name and nothing else: the test lands in `draft`, and
  // variants, treatments and metrics are all authored on the detail page.
  Rpc.make("CreateExperiment", {
    error: commonError,
    payload: {
      name: Schema.String,
      projectId: Schema.String,
    },
    success: Schema.Struct({ id: Schema.String }),
  }),
  // The one write behind the detail page's Save Changes bar: scalars, variants
  // and their placements land together, so a half-edited matrix can never be
  // persisted. Omitted sections are left untouched.
  Rpc.make("SaveExperimentSetup", {
    error: editError,
    payload: {
      description: Schema.optional(Schema.NullOr(Schema.String)),
      hypothesis: Schema.optional(Schema.NullOr(Schema.String)),
      id: Schema.String,
      name: Schema.optional(Schema.String),
      primaryMetricEventName: Schema.optional(Schema.NullOr(Schema.String)),
      secondaryMetricEventNames: Schema.optional(Schema.NullOr(Schema.Array(Schema.String))),
      variants: Schema.optional(Schema.Array(RpcSaveVariantInput)),
    },
    success: RpcExperiment,
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
