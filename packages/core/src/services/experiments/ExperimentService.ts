import { Context, Effect, Layer, Schema } from "effect";

import {
  type InsertExperiment,
  type PaywallLocationTreatmentConfig,
  AuditLogAction,
  AuditLogEntityType,
  Db,
  ExperimentStatus,
  and,
  eq,
  experimentTreatments,
  experimentVariants,
  experiments,
  isNull,
  paywallLocationShowings,
  PaywallLocationShowingType,
  ReleaseStatus,
} from "@voidhash/db";
import { compileVariantPayload } from "@voidhash/rpc";

import { AuthSession } from "../../domain/auth/Auth.ts";
import {
  ExperimentNotFoundError,
  ExperimentValidationError,
  ExperimentVariantNotFoundError,
} from "../../domain/experiment/Experiment.ts";
import { generateId } from "../../utils/generate-id.ts";
import { checkProjectPermission } from "../../utils/permissions.ts";
import { AuditLogPort } from "../auditLog/AuditLogPort.ts";
import {
  EXPERIMENT_FLAG_OWNER_TYPE,
  FeatureFlagService,
} from "../featureFlags/FeatureFlagService.ts";

/**
 * Catch-all experiment service error. Wraps `DbError`/`SqlError`, backing-flag
 * failures, and other infrastructural faults at the public-method boundary so
 * callers see one stable error tag.
 */
export class ExperimentServiceError extends Schema.TaggedErrorClass<ExperimentServiceError>(
  "ExperimentServiceError",
)("ExperimentServiceError", { cause: Schema.String }) {}

/**
 * A variant as supplied to `saveSetup`: the arm, its weight, and the paywall
 * placements it serves. `id` is present for variants that already exist and
 * absent for newly added ones.
 */
interface SaveVariantInput {
  readonly id?: string;
  readonly name: string;
  readonly isControl: boolean;
  readonly weightBps: number;
  readonly treatments: ReadonlyArray<PaywallLocationTreatmentConfig>;
}

const paywallLocationConfig = (config: unknown): PaywallLocationTreatmentConfig =>
  config as PaywallLocationTreatmentConfig;

/**
 * `ExperimentService` is the authoring + analysis + lifecycle entry point for
 * the experiment aggregate. An experiment owns exactly one internal
 * (`ownerType='experiment'`) feature flag which is the runtime assignment
 * artifact: variants + weights are synced into `feature_flag_variant` rows and
 * each variant's treatments are compiled into that row's `payload`, so the hot
 * serve path reads only the flag. Lifecycle (`start`/`pause`/`conclude`) flips
 * the flag's `enabled`/`rolloutBps` and wires the paywall-location showings.
 *
 * `Db`, `AuthSession`, `AuditLogPort`, and `FeatureFlagService` are provided
 * by the application root. It deliberately does NOT depend on
 * `PaywallLocationService` (which depends on it, at serve time) — lifecycle
 * writes showing rows directly to avoid a service cycle.
 */
export class ExperimentService extends Context.Service<ExperimentService>()("ExperimentService", {
  make: Effect.gen(function* () {
    const auditLog = yield* AuditLogPort;
    const db = yield* Db;
    const featureFlagService = yield* FeatureFlagService;

    /** Fold any infra/backing-flag error into the stable service error. */
    const toServiceError = (error: { readonly cause?: unknown; readonly message?: unknown }) =>
      Effect.fail(
        new ExperimentServiceError({ cause: String(error.cause ?? error.message ?? error) }),
      );

    /**
     * Compile the experiment's variants + treatments into the backing flag's
     * variant rows: weights carry through and each variant's treatments compile
     * into its runtime `payload` (the per-location map). Reuses
     * `FeatureFlagService.updateFlagVariants` (transactional delete + reinsert,
     * enforces sum===10000 and unique keys). Self-contained error-wise: only
     * `EffectDrizzleQueryError` (from its own read) escapes untranslated.
     */
    const syncVariantsToFlag = (experimentId: string) =>
      Effect.gen(function* () {
        const experiment = yield* db.query.experiments.findFirst({
          where: { id: experimentId },
          with: {
            variants: { where: { archivedAt: { isNull: true } } },
            treatments: { where: { archivedAt: { isNull: true } } },
          },
        });
        if (!experiment) {
          return yield* Effect.fail(
            new ExperimentServiceError({
              cause: `Experiment ${experimentId} not found during sync`,
            }),
          );
        }
        const treatmentsByVariant = new Map<
          string,
          Array<{ treatmentType: string; config: unknown }>
        >();
        for (const t of experiment.treatments) {
          const arr = treatmentsByVariant.get(t.variantId) ?? [];
          arr.push({ treatmentType: t.treatmentType, config: t.config });
          treatmentsByVariant.set(t.variantId, arr);
        }
        // Flag variants are keyed by the experiment variant's id — the one
        // identifier that is stable across renames, so bucketed subjects stay
        // in their arm no matter how the arm is relabelled.
        const variants = experiment.variants.map((v) => ({
          key: v.id,
          name: v.name,
          weightBps: v.weightBps,
          payload: compileVariantPayload(treatmentsByVariant.get(v.id) ?? []),
        }));
        yield* featureFlagService
          .updateFlagVariants({ featureFlagId: experiment.featureFlagId, variants })
          .pipe(
            Effect.catchTags({
              ActionForbiddenError: toServiceError,
              AuditLogPortError: toServiceError,
              FeatureFlagNotFoundError: toServiceError,
              FeatureFlagServiceError: toServiceError,
            }),
          );
      });

    /** Load an experiment (no relations) or fail with not-found. */
    const loadExperiment = (id: string) =>
      Effect.gen(function* () {
        const experiment = yield* db.query.experiments.findFirst({ where: { id } });
        if (!experiment) {
          return yield* Effect.fail(new ExperimentNotFoundError({ experimentId: id }));
        }
        return experiment;
      });

    /** Load an experiment with variants + treatments + backing flag. */
    const loadExperimentWithRelations = (id: string) =>
      Effect.gen(function* () {
        const experiment = yield* db.query.experiments.findFirst({
          where: { id },
          with: {
            variants: { where: { archivedAt: { isNull: true } } },
            treatments: { where: { archivedAt: { isNull: true } } },
            featureFlag: true,
          },
        });
        if (!experiment) {
          return yield* Effect.fail(new ExperimentNotFoundError({ experimentId: id }));
        }
        return experiment;
      });

    /** Distinct paywall-location ids targeted by any of the experiment's treatments. */
    const targetLocationIds = (
      treatments: ReadonlyArray<{ treatmentType: string; config: unknown }>,
    ): string[] => {
      const ids = new Set<string>();
      for (const t of treatments) {
        if (t.treatmentType === "paywall_location") {
          ids.add(paywallLocationConfig(t.config).paywallLocationId);
        }
      }
      return [...ids];
    };

    /**
     * Create a draft experiment. Deliberately takes nothing but a name: a draft
     * assigns no traffic, so variants, treatments and the metric definition are
     * all authored afterwards on the detail page.
     */
    const createExperiment = Effect.fn("createExperiment")(
      function* (input: { readonly projectId: string; readonly name: string }) {
        const session = yield* AuthSession;
        yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);

        yield* checkProjectPermission(
          input.projectId,
          "project:all",
          `User ${session?.user?.id} is not authorized to create experiments for project ${input.projectId}`,
        );

        const experimentId = generateId("experiment");
        yield* Effect.annotateCurrentSpan("voidhash.experiment.id", experimentId);

        // The backing flag key is namespaced by the (globally unique) experiment
        // id so it can never collide with a customer flag key in the project.
        const { id: featureFlagId } = yield* featureFlagService
          .createInternalFlag({
            projectId: input.projectId,
            key: `__exp_${experimentId}`,
            name: `A/B Test: ${input.name}`,
            ownerType: EXPERIMENT_FLAG_OWNER_TYPE,
            ownerId: experimentId,
          })
          .pipe(Effect.catchTags({ FeatureFlagServiceError: toServiceError }));

        const newExperiment: InsertExperiment = {
          id: experimentId,
          projectId: input.projectId,
          featureFlagId,
          name: input.name,
          description: null,
          hypothesis: null,
          status: ExperimentStatus.draft,
          primaryMetricEventName: null,
          secondaryMetricEventNames: null,
          createdByUserId: session?.user?.id ?? null,
          updatedByUserId: session?.user?.id ?? null,
          version: 1,
        };

        yield* db.transaction((tx) =>
          Effect.gen(function* () {
            yield* tx.insert(experiments).values(newExperiment);
            // Seed a control + treatment arm at an even 50/50 split.
            yield* tx.insert(experimentVariants).values([
              {
                id: generateId("experimentVariant"),
                experimentId,
                name: "Variant A",
                isControl: true,
                weightBps: 5000,
              },
              {
                id: generateId("experimentVariant"),
                experimentId,
                name: "Variant B",
                isControl: false,
                weightBps: 5000,
              },
            ]);
          }),
        );

        yield* syncVariantsToFlag(experimentId);

        yield* auditLog
          .append({
            projectId: input.projectId,
            entityType: AuditLogEntityType.Experiment,
            entityId: experimentId,
            action: AuditLogAction.Created,
            changes: { snapshot: newExperiment },
          })
          .pipe(Effect.ignore);

        yield* Effect.log(`Created experiment ${experimentId} for project ${input.projectId}`);
        return { id: experimentId };
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: toServiceError,
            SqlError: toServiceError,
          }),
        ),
    );

    const getExperiment = Effect.fn("getExperiment")(
      function* (input: { readonly id: string }) {
        const experiment = yield* loadExperimentWithRelations(input.id);
        yield* checkProjectPermission(
          experiment.projectId,
          "project:all",
          `Not authorized to read experiment ${input.id}`,
        );
        return experiment;
      },
      (effect) => effect.pipe(Effect.catchTags({ EffectDrizzleQueryError: toServiceError })),
    );

    /**
     * List a project's experiments with the two facts the index table needs
     * beyond the scalars: how many arms each has, and which paywall locations
     * it targets (which is what scopes its engagement metrics).
     */
    const listExperiments = Effect.fn("listExperiments")(
      function* (input: { readonly projectId: string; readonly includeArchived?: boolean }) {
        yield* checkProjectPermission(
          input.projectId,
          "project:all",
          `Not authorized to list experiments for project ${input.projectId}`,
        );
        const rows = yield* db.query.experiments.findMany({
          where: {
            projectId: input.projectId,
            ...(input.includeArchived ? {} : { archivedAt: { isNull: true } }),
          },
          with: {
            treatments: { where: { archivedAt: { isNull: true } } },
            variants: { where: { archivedAt: { isNull: true } } },
          },
        });
        return rows.map((r) => {
          const { treatments, variants, ...rest } = r;
          return {
            ...rest,
            paywallLocationIds: targetLocationIds(treatments),
            variantCount: variants.length,
          };
        });
      },
      (effect) => effect.pipe(Effect.catchTags({ EffectDrizzleQueryError: toServiceError })),
    );

    /**
     * The single write behind the detail page's Save Changes bar. Applies the
     * staged scalar edits and — when `variants` is provided — replaces the
     * whole setup matrix (arms, weights, and each arm's paywall placements) in
     * one transaction, so a half-edited matrix can never be persisted.
     * Omitted sections are left untouched. Field-level locks: metrics only
     * change while the test is a draft; variants are frozen while it runs.
     */
    const saveSetup = Effect.fn("saveExperimentSetup")(
      function* (input: {
        readonly id: string;
        readonly name?: string;
        readonly description?: string | null;
        readonly hypothesis?: string | null;
        readonly primaryMetricEventName?: string | null;
        readonly secondaryMetricEventNames?: ReadonlyArray<string> | null;
        readonly variants?: ReadonlyArray<SaveVariantInput>;
      }) {
        const session = yield* AuthSession;
        const experiment = yield* loadExperiment(input.id);
        yield* checkProjectPermission(
          experiment.projectId,
          "project:all",
          `Not authorized to update experiment ${input.id}`,
        );

        // Metric definition is locked once the experiment leaves draft so the
        // analysis denominator can't shift mid-flight.
        const changingMetrics =
          input.primaryMetricEventName !== undefined ||
          input.secondaryMetricEventNames !== undefined;
        if (changingMetrics && experiment.status !== ExperimentStatus.draft) {
          return yield* Effect.fail(
            new ExperimentValidationError({
              message: "Metrics can only be changed while the A/B test is a draft",
            }),
          );
        }
        if (input.variants && experiment.status === ExperimentStatus.running) {
          return yield* Effect.fail(
            new ExperimentValidationError({
              message: "Variants and placements are locked while the A/B test is running",
            }),
          );
        }
        if (input.variants) {
          const controls = input.variants.filter((v) => v.isControl);
          if (controls.length !== 1) {
            return yield* Effect.fail(
              new ExperimentValidationError({ message: "Exactly one variant must be the control" }),
            );
          }
          const totalWeight = input.variants.reduce((sum, v) => sum + v.weightBps, 0);
          if (totalWeight !== 10000) {
            return yield* Effect.fail(
              new ExperimentValidationError({
                message: `Variant weights must sum to 10000, got ${totalWeight}`,
              }),
            );
          }
          for (const v of input.variants) {
            if (v.name.trim().length === 0) {
              return yield* Effect.fail(
                new ExperimentValidationError({ message: "Every variant needs a name" }),
              );
            }
            const locationIds = new Set<string>();
            for (const t of v.treatments) {
              if (locationIds.has(t.paywallLocationId)) {
                return yield* Effect.fail(
                  new ExperimentValidationError({
                    message: `Variant '${v.name}' has two paywalls for the same location`,
                  }),
                );
              }
              locationIds.add(t.paywallLocationId);
            }
          }
        }

        const updates: Record<string, unknown> = { updatedByUserId: session?.user?.id ?? null };
        if (input.name !== undefined) updates.name = input.name;
        if (input.description !== undefined) updates.description = input.description;
        if (input.hypothesis !== undefined) updates.hypothesis = input.hypothesis;
        if (input.primaryMetricEventName !== undefined)
          updates.primaryMetricEventName = input.primaryMetricEventName;
        if (input.secondaryMetricEventNames !== undefined)
          updates.secondaryMetricEventNames = input.secondaryMetricEventNames
            ? [...input.secondaryMetricEventNames]
            : null;

        yield* db.transaction((tx) =>
          Effect.gen(function* () {
            yield* tx.update(experiments).set(updates).where(eq(experiments.id, input.id));

            if (!input.variants) {
              return;
            }
            const existing = yield* tx.query.experimentVariants.findMany({
              where: { experimentId: input.id, archivedAt: { isNull: true } },
            });
            const existingIds = new Set(existing.map((v) => v.id));
            for (const v of input.variants) {
              if (v.id && !existingIds.has(v.id)) {
                return yield* Effect.fail(new ExperimentVariantNotFoundError({ variantId: v.id }));
              }
            }

            // Upsert by id so surviving variants keep their identity (and the
            // traffic already bucketed into them); removed variants disappear
            // together with their placements.
            const keptIds = new Set(
              input.variants.flatMap((v) => (v.id !== undefined ? [v.id] : [])),
            );
            for (const ex of existing) {
              if (!keptIds.has(ex.id)) {
                yield* tx.delete(experimentVariants).where(eq(experimentVariants.id, ex.id));
              }
            }
            // Placements are replaced wholesale — the matrix is the full
            // picture, so diffing row-by-row buys nothing.
            yield* tx
              .delete(experimentTreatments)
              .where(eq(experimentTreatments.experimentId, input.id));

            for (const v of input.variants) {
              let variantId = v.id;
              if (variantId) {
                yield* tx
                  .update(experimentVariants)
                  .set({ name: v.name, isControl: v.isControl, weightBps: v.weightBps })
                  .where(eq(experimentVariants.id, variantId));
              } else {
                variantId = generateId("experimentVariant");
                yield* tx.insert(experimentVariants).values({
                  id: variantId,
                  experimentId: input.id,
                  name: v.name,
                  isControl: v.isControl,
                  weightBps: v.weightBps,
                });
              }
              for (const treatment of v.treatments) {
                yield* tx.insert(experimentTreatments).values({
                  id: generateId("experimentTreatment"),
                  experimentId: input.id,
                  variantId,
                  treatmentType: "paywall_location",
                  config: { ...treatment },
                });
              }
            }
          }),
        );

        if (input.variants) {
          yield* syncVariantsToFlag(input.id);
        }

        yield* auditLog
          .append({
            projectId: experiment.projectId,
            entityType: AuditLogEntityType.Experiment,
            entityId: input.id,
            action: AuditLogAction.Updated,
            changes: { before: experiment, after: input },
          })
          .pipe(Effect.ignore);

        return yield* loadExperimentWithRelations(input.id);
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: toServiceError,
            SqlError: toServiceError,
          }),
        ),
    );

    const startExperiment = Effect.fn("startExperiment")(
      function* (input: { readonly id: string }) {
        const session = yield* AuthSession;
        const experiment = yield* loadExperimentWithRelations(input.id);
        yield* checkProjectPermission(
          experiment.projectId,
          "project:all",
          `Not authorized to start experiment ${input.id}`,
        );
        if (experiment.status === ExperimentStatus.concluded) {
          return yield* Effect.fail(
            new ExperimentValidationError({
              message: "A concluded experiment cannot be restarted",
            }),
          );
        }

        const locationIds = targetLocationIds(experiment.treatments);

        // Treatments follow a paywall's active published release, so a paywall
        // that was never published would leave its cell dark — refuse to start
        // until everything placed in the matrix is actually servable.
        const paywallIds = new Set<string>();
        for (const treatment of experiment.treatments) {
          if (treatment.treatmentType === "paywall_location") {
            paywallIds.add(paywallLocationConfig(treatment.config).paywallId);
          }
        }
        for (const paywallId of paywallIds) {
          const release = yield* db.query.paywallReleases.findFirst({
            where: { paywallId, isActive: true, status: ReleaseStatus.released },
          });
          if (!release) {
            const paywall = yield* db.query.paywalls.findFirst({ where: { id: paywallId } });
            return yield* Effect.fail(
              new ExperimentValidationError({
                message: `Paywall "${paywall?.name ?? paywallId}" has no published version yet`,
              }),
            );
          }
        }

        // Mutual exclusion: refuse to start if any target location is already
        // running a DIFFERENT experiment. A plain paywall_release showing is
        // clobbered (this is the "launch experiment here" action).
        for (const locationId of locationIds) {
          const active = yield* db.query.paywallLocationShowings.findFirst({
            where: { paywallLocationId: locationId, endedAt: { isNull: true } },
          });
          if (
            active &&
            active.type === PaywallLocationShowingType.featureFlag &&
            active.featureFlagId
          ) {
            const otherFlag = yield* db.query.featureFlags.findFirst({
              where: { id: active.featureFlagId },
            });
            if (otherFlag?.ownerId && otherFlag.ownerId !== experiment.id) {
              return yield* Effect.fail(
                new ExperimentValidationError({
                  message: `Paywall location ${locationId} is already running another experiment`,
                }),
              );
            }
          }
        }

        yield* featureFlagService
          .setInternalFlagState({
            featureFlagId: experiment.featureFlagId,
            enabled: true,
            rolloutBps: 10000,
          })
          .pipe(
            Effect.catchTags({
              FeatureFlagNotFoundError: toServiceError,
              FeatureFlagServiceError: toServiceError,
            }),
          );

        const now = new Date();
        yield* db.transaction((tx) =>
          Effect.gen(function* () {
            for (const locationId of locationIds) {
              yield* tx
                .update(paywallLocationShowings)
                .set({ endedAt: now })
                .where(
                  and(
                    eq(paywallLocationShowings.paywallLocationId, locationId),
                    isNull(paywallLocationShowings.endedAt),
                  ),
                );
              yield* tx.insert(paywallLocationShowings).values({
                id: generateId("paywallLocationShowing"),
                projectId: experiment.projectId,
                paywallLocationId: locationId,
                type: PaywallLocationShowingType.featureFlag,
                paywallId: null,
                paywallReleaseId: null,
                featureFlagId: experiment.featureFlagId,
                startedAt: now,
                createdByUserId: session?.user?.id ?? null,
              });
            }
            yield* tx
              .update(experiments)
              .set({ status: ExperimentStatus.running, startedAt: now })
              .where(eq(experiments.id, input.id));
          }),
        );

        yield* auditLog
          .append({
            projectId: experiment.projectId,
            entityType: AuditLogEntityType.Experiment,
            entityId: input.id,
            action: AuditLogAction.Updated,
            changes: { status: "running", locationIds },
          })
          .pipe(Effect.ignore);
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: toServiceError,
            SqlError: toServiceError,
          }),
        ),
    );

    const pauseExperiment = Effect.fn("pauseExperiment")(
      function* (input: { readonly id: string }) {
        const experiment = yield* loadExperiment(input.id);
        yield* checkProjectPermission(
          experiment.projectId,
          "project:all",
          `Not authorized to pause experiment ${input.id}`,
        );
        if (experiment.status !== ExperimentStatus.running) {
          return yield* Effect.fail(
            new ExperimentValidationError({ message: "Only a running experiment can be paused" }),
          );
        }
        // Freeze assignment: everyone falls back to control at serve time.
        yield* featureFlagService
          .setInternalFlagState({ featureFlagId: experiment.featureFlagId, enabled: false })
          .pipe(
            Effect.catchTags({
              FeatureFlagNotFoundError: toServiceError,
              FeatureFlagServiceError: toServiceError,
            }),
          );
        yield* db
          .update(experiments)
          .set({ status: ExperimentStatus.paused })
          .where(eq(experiments.id, input.id));
        yield* auditLog
          .append({
            projectId: experiment.projectId,
            entityType: AuditLogEntityType.Experiment,
            entityId: input.id,
            action: AuditLogAction.Updated,
            changes: { status: "paused" },
          })
          .pipe(Effect.ignore);
      },
      (effect) => effect.pipe(Effect.catchTags({ EffectDrizzleQueryError: toServiceError })),
    );

    const concludeExperiment = Effect.fn("concludeExperiment")(
      function* (input: { readonly id: string; readonly winningVariantId?: string }) {
        const experiment = yield* loadExperimentWithRelations(input.id);
        yield* checkProjectPermission(
          experiment.projectId,
          "project:all",
          `Not authorized to conclude experiment ${input.id}`,
        );

        const control = experiment.variants.find((v) => v.isControl);
        const winnerId = input.winningVariantId ?? control?.id;
        const winner = experiment.variants.find((v) => v.id === winnerId);
        if (input.winningVariantId && !winner) {
          return yield* Effect.fail(
            new ExperimentVariantNotFoundError({ variantId: input.winningVariantId }),
          );
        }

        // Promote the winner (falling back to control) at each target location:
        // replace the experiment's featureFlag showing with a normal
        // paywall_release showing so no location is ever left dangling.
        const locationIds = targetLocationIds(experiment.treatments);
        const configForLocation = (locationId: string) => {
          const pick = (variantId: string | undefined) =>
            experiment.treatments.find(
              (t) =>
                t.variantId === variantId &&
                t.treatmentType === "paywall_location" &&
                paywallLocationConfig(t.config).paywallLocationId === locationId,
            );
          const chosen = pick(winner?.id) ?? pick(control?.id);
          return chosen ? paywallLocationConfig(chosen.config) : null;
        };

        // Stop assignment first.
        yield* featureFlagService
          .setInternalFlagState({ featureFlagId: experiment.featureFlagId, enabled: false })
          .pipe(
            Effect.catchTags({
              FeatureFlagNotFoundError: toServiceError,
              FeatureFlagServiceError: toServiceError,
            }),
          );

        const now = new Date();
        yield* db.transaction((tx) =>
          Effect.gen(function* () {
            for (const locationId of locationIds) {
              yield* tx
                .update(paywallLocationShowings)
                .set({ endedAt: now })
                .where(
                  and(
                    eq(paywallLocationShowings.paywallLocationId, locationId),
                    isNull(paywallLocationShowings.endedAt),
                  ),
                );
              const config = configForLocation(locationId);
              if (config) {
                // Treatments name a paywall, not a release (legacy rows still
                // pin one) — promote whatever its active published version is
                // right now, or leave the location empty rather than pin
                // something unpublished.
                const releaseId =
                  config.paywallReleaseId ??
                  (yield* tx.query.paywallReleases.findFirst({
                    where: {
                      paywallId: config.paywallId,
                      isActive: true,
                      status: ReleaseStatus.released,
                    },
                  }))?.id;
                if (releaseId) {
                  yield* tx.insert(paywallLocationShowings).values({
                    id: generateId("paywallLocationShowing"),
                    projectId: experiment.projectId,
                    paywallLocationId: locationId,
                    type: PaywallLocationShowingType.paywallRelease,
                    paywallId: config.paywallId,
                    paywallReleaseId: releaseId,
                    featureFlagId: null,
                    startedAt: now,
                  });
                }
              }
            }
            yield* tx
              .update(experiments)
              .set({
                status: ExperimentStatus.concluded,
                endedAt: now,
                winningVariantId: winnerId ?? null,
              })
              .where(eq(experiments.id, input.id));
          }),
        );

        yield* auditLog
          .append({
            projectId: experiment.projectId,
            entityType: AuditLogEntityType.Experiment,
            entityId: input.id,
            action: AuditLogAction.Completed,
            changes: { status: "concluded", winningVariantId: winnerId },
          })
          .pipe(Effect.ignore);
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: toServiceError,
            SqlError: toServiceError,
          }),
        ),
    );

    const archiveExperiment = Effect.fn("archiveExperiment")(
      function* (input: { readonly id: string }) {
        const experiment = yield* loadExperiment(input.id);
        yield* checkProjectPermission(
          experiment.projectId,
          "project:all",
          `Not authorized to archive experiment ${input.id}`,
        );
        // Disable the backing flag so nothing keeps assigning after archive.
        yield* featureFlagService
          .setInternalFlagState({ featureFlagId: experiment.featureFlagId, enabled: false })
          .pipe(
            Effect.catchTags({
              FeatureFlagNotFoundError: toServiceError,
              FeatureFlagServiceError: toServiceError,
            }),
          );
        yield* db
          .update(experiments)
          .set({ archivedAt: new Date() })
          .where(eq(experiments.id, input.id));
        yield* auditLog
          .append({
            projectId: experiment.projectId,
            entityType: AuditLogEntityType.Experiment,
            entityId: input.id,
            action: AuditLogAction.Archived,
          })
          .pipe(Effect.ignore);
      },
      (effect) => effect.pipe(Effect.catchTags({ EffectDrizzleQueryError: toServiceError })),
    );

    const restoreExperiment = Effect.fn("restoreExperiment")(
      function* (input: { readonly id: string }) {
        const experiment = yield* loadExperiment(input.id);
        yield* checkProjectPermission(
          experiment.projectId,
          "project:all",
          `Not authorized to restore experiment ${input.id}`,
        );
        yield* db.update(experiments).set({ archivedAt: null }).where(eq(experiments.id, input.id));
        yield* auditLog
          .append({
            projectId: experiment.projectId,
            entityType: AuditLogEntityType.Experiment,
            entityId: input.id,
            action: AuditLogAction.Restored,
          })
          .pipe(Effect.ignore);
      },
      (effect) => effect.pipe(Effect.catchTags({ EffectDrizzleQueryError: toServiceError })),
    );

    /**
     * Shared assignment primitive — the reuse core every surface calls. Resolves
     * the experiment (by id, key, OR backing-flag id) and evaluates it for the
     * subject via the existing feature-flag engine (deterministic bucketing).
     * Returns the assigned variant + its compiled runtime payload, PLUS the
     * control variant's key/payload so a surface can fall back to control when a
     * subject isn't enrolled (flag disabled / paused) — the paywall serve path
     * uses this so a location backed by an experiment is never dark.
     *
     * Surface-agnostic: it returns compiled payloads (never touches flag or
     * paywall concepts in its signature) and does NOT emit exposure or require
     * `RuntimeContext` — the caller (which has org/token/runtime) emits. No
     * permission check: called from the SDK serve path (publishable-key session).
     */
    const assignVariant = Effect.fn("assignVariant")(
      function* (input: {
        readonly projectId: string;
        readonly experimentId?: string;
        readonly featureFlagId?: string;
        readonly personId?: string;
        readonly distinctId?: string;
      }) {
        const experiment = yield* db.query.experiments.findFirst({
          where: {
            projectId: input.projectId,
            archivedAt: { isNull: true },
            ...(input.experimentId ? { id: input.experimentId } : {}),
            ...(input.featureFlagId ? { featureFlagId: input.featureFlagId } : {}),
          },
          with: {
            featureFlag: true,
            variants: { where: { archivedAt: { isNull: true } } },
            treatments: { where: { archivedAt: { isNull: true } } },
          },
        });
        if (!experiment || !experiment.featureFlag) return null;

        const control = experiment.variants.find((v) => v.isControl);
        const controlPayload = control
          ? compileVariantPayload(
              experiment.treatments
                .filter((t) => t.variantId === control.id)
                .map((t) => ({ treatmentType: t.treatmentType, config: t.config })),
            )
          : null;

        const results = yield* featureFlagService
          .evaluateFlagsBatch({
            projectId: input.projectId,
            keys: [experiment.featureFlag.key],
            personId: input.personId,
            distinctId: input.distinctId,
          })
          .pipe(Effect.catchTags({ FeatureFlagServiceError: toServiceError }));
        const result = results[0];
        return {
          experimentId: experiment.id,
          assigned: result?.enabled ?? false,
          variantKey: result?.variantKey ?? null,
          payload: result?.payload ?? null,
          controlVariantKey: control?.id ?? null,
          controlPayload,
        };
      },
      (effect) => effect.pipe(Effect.catchTags({ EffectDrizzleQueryError: toServiceError })),
    );

    return {
      archiveExperiment,
      assignVariant,
      concludeExperiment,
      createExperiment,
      getExperiment,
      listExperiments,
      pauseExperiment,
      restoreExperiment,
      saveSetup,
      startExperiment,
    } as const;
  }),
}) {
  static layer = Layer.effect(ExperimentService)(ExperimentService.make);
}
