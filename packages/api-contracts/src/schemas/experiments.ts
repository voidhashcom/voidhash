/**
 * Experiment (A/B test) request/response schemas for the public HTTP API.
 * Mirrors the shapes served by `ExperimentRpcsDef`, with one translation: the
 * `status` small-int column is exposed under its name rather than its number,
 * because the public surface also filters on it (`GET /experiments?status=`).
 */
import * as Schema from "effect/Schema";

import { PageParams } from "../Pagination.ts";

/**
 * Lifecycle state of an experiment. `draft` assigns no traffic, `running`
 * splits it, `paused` freezes assignment onto control, and `concluded` has
 * promoted a winner and can never run again.
 */
export const ExperimentStatus = Schema.Literals(["draft", "running", "paused", "concluded"]);
export type ExperimentStatus = typeof ExperimentStatus.Type;

/** Summary of the backing feature flag that performs runtime assignment. */
export class ExperimentBackingFlag extends Schema.Class<ExperimentBackingFlag>(
  "ExperimentBackingFlag",
)({
  enabled: Schema.Boolean,
  id: Schema.String,
  key: Schema.String,
  rolloutBps: Schema.Number,
}) {}

/** One arm of the test. `weightBps` is the arm's share of traffic in basis points. */
export class ExperimentVariant extends Schema.Class<ExperimentVariant>("ExperimentVariant")({
  archivedAt: Schema.NullOr(Schema.Date),
  createdAt: Schema.NullOr(Schema.Date),
  experimentId: Schema.String,
  id: Schema.String,
  isControl: Schema.Boolean,
  name: Schema.String,
  updatedAt: Schema.NullOr(Schema.Date),
  weightBps: Schema.Number,
}) {}

/** What one arm shows at one placement. `config` is keyed by `treatmentType`. */
export class ExperimentTreatment extends Schema.Class<ExperimentTreatment>("ExperimentTreatment")({
  archivedAt: Schema.NullOr(Schema.Date),
  config: Schema.Unknown,
  createdAt: Schema.NullOr(Schema.Date),
  experimentId: Schema.String,
  id: Schema.String,
  treatmentType: Schema.String,
  updatedAt: Schema.NullOr(Schema.Date),
  variantId: Schema.String,
}) {}

/** An experiment with its variants, treatments and backing flag inlined. */
export class Experiment extends Schema.Class<Experiment>("Experiment")({
  archivedAt: Schema.NullOr(Schema.Date),
  backingFlag: Schema.NullOr(ExperimentBackingFlag),
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
  status: ExperimentStatus,
  treatments: Schema.Array(ExperimentTreatment),
  updatedAt: Schema.NullOr(Schema.Date),
  updatedByUserId: Schema.NullOr(Schema.String),
  variants: Schema.Array(ExperimentVariant),
  version: Schema.Number,
  winningVariantId: Schema.NullOr(Schema.String),
}) {}

/**
 * Collection projection: variant rows collapse to a count, and the placements
 * collapse to the distinct paywall locations the test targets — the traffic it
 * actually splits.
 */
export class ExperimentListItem extends Schema.Class<ExperimentListItem>("ExperimentListItem")({
  archivedAt: Schema.NullOr(Schema.Date),
  createdAt: Schema.NullOr(Schema.Date),
  createdByUserId: Schema.NullOr(Schema.String),
  description: Schema.NullOr(Schema.String),
  endedAt: Schema.NullOr(Schema.Date),
  featureFlagId: Schema.String,
  hypothesis: Schema.NullOr(Schema.String),
  id: Schema.String,
  name: Schema.String,
  paywallLocationIds: Schema.Array(Schema.String),
  primaryMetricEventName: Schema.NullOr(Schema.String),
  projectId: Schema.String,
  secondaryMetricEventNames: Schema.NullOr(Schema.Array(Schema.String)),
  startedAt: Schema.NullOr(Schema.Date),
  status: ExperimentStatus,
  updatedAt: Schema.NullOr(Schema.Date),
  updatedByUserId: Schema.NullOr(Schema.String),
  variantCount: Schema.Number,
  version: Schema.Number,
  winningVariantId: Schema.NullOr(Schema.String),
}) {}

/** Per-arm outcome over the requested window. `variantKey` is the variant's id. */
export class ExperimentVariantResult extends Schema.Class<ExperimentVariantResult>(
  "ExperimentVariantResult",
)({
  conversionRate: Schema.Number,
  conversions: Schema.Number,
  exposures: Schema.Number,
  revenueUsd: Schema.Number,
  variantKey: Schema.String,
}) {}

/** Body of `GET /experiments/:experimentId/results`. */
export class ExperimentResults extends Schema.Class<ExperimentResults>("ExperimentResults")({
  variants: Schema.Array(ExperimentVariantResult),
}) {}

/** Query parameters accepted by `GET /experiments`. */
export const ListExperimentsParams = Schema.Struct({
  ...PageParams.fields,
  includeArchived: Schema.optional(Schema.Literals(["true", "false"])),
  projectId: Schema.optional(Schema.String),
  status: Schema.optional(ExperimentStatus),
}).annotate({ identifier: "ListExperimentsParams" });
export type ListExperimentsParams = typeof ListExperimentsParams.Type;

/**
 * Query parameters accepted by `GET /experiments/:experimentId/results`.
 * `days` is the look-back window; it is capped at a year, which is far longer
 * than any test should run.
 */
export const ExperimentResultsParams = Schema.Struct({
  days: Schema.optional(
    Schema.FiniteFromString.check(Schema.isBetween({ maximum: 365, minimum: 1 })),
  ),
}).annotate({ identifier: "ExperimentResultsParams" });
export type ExperimentResultsParams = typeof ExperimentResultsParams.Type;

/**
 * Body of `POST /experiments`. A new test lands in `draft` with a seeded
 * 50/50 control + treatment pair; the matrix and metrics are authored with
 * `PATCH`. `projectId` is optional for a secret key, which is scoped to
 * exactly one project, and required otherwise.
 */
export class CreateExperimentBody extends Schema.Class<CreateExperimentBody>(
  "CreateExperimentBody",
)({
  name: Schema.String,
  projectId: Schema.optional(Schema.String),
}) {}

/**
 * One placement for an arm: which paywall to show at which location. Only the
 * paywall is named — the serve path always follows its active published
 * release.
 */
const ExperimentVariantTreatmentInput = Schema.Struct({
  paywallId: Schema.String,
  paywallLocationId: Schema.String,
});

/**
 * An arm as submitted in the setup matrix. `id` is present for arms that
 * already exist, so they keep their identity — and their share of already
 * bucketed traffic — across saves, and absent for newly added ones.
 */
const ExperimentVariantInput = Schema.Struct({
  id: Schema.optional(Schema.String),
  isControl: Schema.Boolean,
  name: Schema.String,
  treatments: Schema.Array(ExperimentVariantTreatmentInput),
  weightBps: Schema.Number,
});

/**
 * Body of `PATCH /experiments/:experimentId`. Omitted fields are left
 * untouched. Two field-level locks apply: the metric definition may only
 * change while the test is a draft (so the analysis denominator cannot shift
 * mid-flight), and the variant matrix is frozen while it runs — both surface
 * as `409`.
 *
 * `variants`, when present, **replaces the whole matrix**: arms missing from
 * the array are removed together with their placements, and every arm's
 * placements are rewritten from what is supplied. Exactly one arm must be the
 * control and `weightBps` must sum to 10000.
 */
export class UpdateExperimentBody extends Schema.Class<UpdateExperimentBody>(
  "UpdateExperimentBody",
)({
  description: Schema.optional(Schema.NullOr(Schema.String)),
  hypothesis: Schema.optional(Schema.NullOr(Schema.String)),
  name: Schema.optional(Schema.String),
  primaryMetricEventName: Schema.optional(Schema.NullOr(Schema.String)),
  secondaryMetricEventNames: Schema.optional(Schema.NullOr(Schema.Array(Schema.String))),
  variants: Schema.optional(Schema.Array(ExperimentVariantInput)),
}) {}

/**
 * Body of `POST /experiments/:experimentId/conclude`. The winner is promoted
 * to a plain paywall showing at every targeted location; omitting it promotes
 * the control arm.
 */
export class ConcludeExperimentBody extends Schema.Class<ConcludeExperimentBody>(
  "ConcludeExperimentBody",
)({
  winningVariantId: Schema.optional(Schema.String),
}) {}
