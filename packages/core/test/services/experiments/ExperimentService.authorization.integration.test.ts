import { ActionForbiddenError, type UserSession } from "@voidhash/core/domain/auth/Auth";
import { ExperimentService, FeatureFlagService } from "@voidhash/core/services";
import {
  Db,
  ExperimentStatus,
  auditLogs,
  eq,
  experimentTreatments,
  experimentVariants,
  experiments,
} from "@voidhash/db";
import { generateId } from "@voidhash/core/utils";
import { CoreAuthSession } from "@testing/CoreAuthSession";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";
import { CoreTestFixture } from "@testing/CoreTestFixture";
import { DateTime, Effect, Layer } from "effect";
import { expect } from "vitest";

const { test } = CoreIntegrationTestHarness.make();

const ServiceUnderTest = ExperimentService.layer.pipe(Layer.provide(FeatureFlagService.layer));
const EPOCH = DateTime.toDateUtc(DateTime.makeUnsafe(0));
const suffix = generateId("test");
const experimentId = `it_experiment_auth_${suffix}`;
const controlId = `it_experiment_variant_control_${suffix}`;
const treatmentId = `it_experiment_treatment_${suffix}`;
const unauthorizedCreateName = `it experiment create forbidden ${suffix}`;

const sessionWithoutProjectAccess = (): UserSession => ({
  cookie: null,
  method: "user",
  name: `${CoreTestFixture.userName} <${CoreTestFixture.userEmail}>`,
  organizations: [],
  person: null,
  projects: [],
  user: {
    createdAt: EPOCH,
    email: CoreTestFixture.userEmail,
    emailVerified: true,
    id: CoreTestFixture.userId,
    image: null,
    name: CoreTestFixture.userName,
    role: null,
    updatedAt: EPOCH,
    workosUserId: CoreTestFixture.workosUserId,
  },
});

const asUnauthorized = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(CoreAuthSession.authenticate(sessionWithoutProjectAccess()));

test(
  "every experiment management operation rejects a cross-tenant caller before mutation",
  Effect.gen(function* () {
    const db = yield* Db;
    const service = yield* ExperimentService;

    yield* db.insert(experiments).values({
      featureFlagId: `it_feature_flag_auth_${suffix}`,
      id: experimentId,
      name: "Original experiment",
      primaryMetricEventName: "purchase",
      projectId: CoreTestFixture.projectId,
      status: ExperimentStatus.draft,
      version: 1,
    });
    yield* db.insert(experimentVariants).values([
      {
        experimentId,
        id: controlId,
        isControl: true,
        name: "Variant A",
        weightBps: 5_000,
      },
      {
        experimentId,
        id: `it_experiment_variant_treatment_${suffix}`,
        isControl: false,
        name: "Variant B",
        weightBps: 5_000,
      },
    ]);
    yield* db.insert(experimentTreatments).values({
      config: {
        paywallId: "foreign-paywall",
        paywallLocationId: "foreign-location",
        paywallReleaseId: "foreign-release",
      },
      experimentId,
      id: treatmentId,
      treatmentType: "paywall_location",
      variantId: controlId,
    });

    const expectForbidden = <A, E, R>(operation: Effect.Effect<A, E, R>) =>
      Effect.gen(function* () {
        const error = yield* asUnauthorized(operation).pipe(Effect.flip);
        expect(error).toBeInstanceOf(ActionForbiddenError);
      });

    yield* expectForbidden(
      service.createExperiment({
        name: unauthorizedCreateName,
        projectId: CoreTestFixture.projectId,
      }),
    );
    yield* expectForbidden(service.listExperiments({ projectId: CoreTestFixture.projectId }));
    yield* expectForbidden(service.getExperiment({ id: experimentId }));
    yield* expectForbidden(service.saveSetup({ id: experimentId, name: "Compromised" }));
    yield* expectForbidden(
      service.saveSetup({
        id: experimentId,
        variants: [
          {
            isControl: true,
            name: "Variant A",
            treatments: [
              {
                paywallId: "attacker-paywall",
                paywallLocationId: "attacker-location",
              },
            ],
            weightBps: 10_000,
          },
        ],
      }),
    );
    yield* expectForbidden(service.startExperiment({ id: experimentId }));
    yield* expectForbidden(service.pauseExperiment({ id: experimentId }));
    yield* expectForbidden(service.concludeExperiment({ id: experimentId }));
    yield* expectForbidden(service.archiveExperiment({ id: experimentId }));
    yield* expectForbidden(service.restoreExperiment({ id: experimentId }));

    const experiment = yield* db.query.experiments.findFirst({ where: { id: experimentId } });
    const variants = yield* db.query.experimentVariants.findMany({ where: { experimentId } });
    const treatment = yield* db.query.experimentTreatments.findFirst({
      where: { id: treatmentId },
    });
    const forbiddenCreate = yield* db.query.experiments.findFirst({
      where: { name: unauthorizedCreateName, projectId: CoreTestFixture.projectId },
    });
    expect(experiment).toMatchObject({
      archivedAt: null,
      name: "Original experiment",
      status: ExperimentStatus.draft,
    });
    expect(variants).toHaveLength(2);
    expect(treatment?.id).toBe(treatmentId);
    expect(forbiddenCreate).toBeUndefined();
  }).pipe(
    Effect.ensuring(
      Effect.gen(function* () {
        const db = yield* Db;
        yield* db
          .delete(auditLogs)
          .where(eq(auditLogs.parentEntityId, experimentId))
          .pipe(Effect.ignore);
        yield* db.delete(auditLogs).where(eq(auditLogs.entityId, experimentId)).pipe(Effect.ignore);
        yield* db
          .delete(experimentTreatments)
          .where(eq(experimentTreatments.experimentId, experimentId))
          .pipe(Effect.ignore);
        yield* db
          .delete(experimentVariants)
          .where(eq(experimentVariants.experimentId, experimentId))
          .pipe(Effect.ignore);
        yield* db.delete(experiments).where(eq(experiments.id, experimentId)).pipe(Effect.ignore);
      }),
    ),
    Effect.provide(ServiceUnderTest),
    CoreAuthSession.authenticate(),
  ),
);
