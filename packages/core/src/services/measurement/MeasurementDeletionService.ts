import {
  CaptureInvalidRequestError,
  CaptureUnauthorizedError,
  type MeasurementDeletionRequest,
} from "@voidhash/api-contracts/event-capture";
import {
  and,
  apiKeys,
  Db,
  eq,
  lt,
  measurementDeletionRequests,
  projects,
  protectedMeasurementEvidence,
} from "@voidhash/db";
import { Context, Effect, Layer } from "effect";

import { validateCaptureToken } from "../analyticsIngest/EventCaptureService.ts";

export interface MeasurementDeletionResult {
  readonly accepted: true;
  readonly deletedProtectedEvidence: number;
  readonly requestId: string;
  readonly status: "completed";
}

/** Coordinates idempotent, project-scoped protected measurement deletion. */
export class MeasurementDeletionService extends Context.Service<MeasurementDeletionService>()(
  "MeasurementDeletionService",
  {
    make: Effect.gen(function* () {
      const db = yield* Db;

      const resolveProject = Effect.fn("MeasurementDeletionService.resolveProject")(function* (
        rawToken: string,
      ) {
        const token = yield* validateCaptureToken(rawToken);
        const [project] = yield* db
          .select({ projectId: apiKeys.projectId })
          .from(apiKeys)
          .innerJoin(projects, eq(projects.id, apiKeys.projectId))
          .where(and(eq(apiKeys.isPublic, true), eq(apiKeys.key, token)))
          .limit(1);
        if (!project) {
          return yield* Effect.fail(
            new CaptureUnauthorizedError({ code: "unauthorized", error: "invalid token" }),
          );
        }
        return project.projectId;
      });

      const request = Effect.fn("MeasurementDeletionService.request")(function* (
        input: typeof MeasurementDeletionRequest.Type,
      ) {
        const projectId = yield* resolveProject(input.token);
        const [existing] = yield* db
          .select()
          .from(measurementDeletionRequests)
          .where(
            and(
              eq(measurementDeletionRequests.projectId, projectId),
              eq(measurementDeletionRequests.requestId, input.requestId),
            ),
          )
          .limit(1);
        if (existing) {
          if (
            existing.installationId !== input.installationId ||
            (existing.personId ?? undefined) !== input.personId
          ) {
            return yield* Effect.fail(
              new CaptureInvalidRequestError({
                code: "invalid_request",
                error: "requestId is already bound to another deletion subject",
              }),
            );
          }
          return {
            accepted: true,
            deletedProtectedEvidence: existing.deletedProtectedEvidence,
            requestId: existing.requestId,
            status: "completed",
          } as const;
        }

        const completedAt = new Date();
        const deleted = yield* db.transaction((tx) =>
          Effect.gen(function* () {
            const purged = yield* tx
              .update(protectedMeasurementEvidence)
              .set({ ciphertext: null, deletionState: "deleted", updatedAt: completedAt })
              .where(
                and(
                  eq(protectedMeasurementEvidence.projectId, projectId),
                  eq(protectedMeasurementEvidence.installationId, input.installationId),
                ),
              )
              .returning({ id: protectedMeasurementEvidence.id });
            yield* tx.insert(measurementDeletionRequests).values({
              completedAt,
              deletedProtectedEvidence: purged.length,
              id: `measurement_deletion_${crypto.randomUUID()}`,
              installationId: input.installationId,
              personId: input.personId,
              projectId,
              requestedAt: input.requestedAt,
              requestId: input.requestId,
              status: "completed",
            });
            return purged.length;
          }),
        );
        return {
          accepted: true,
          deletedProtectedEvidence: deleted,
          requestId: input.requestId,
          status: "completed",
        } as const;
      });

      const purgeExpiredEphemeral = Effect.fn(
        "MeasurementDeletionService.purgeExpiredEphemeral",
      )(function* (cutoff: Date) {
        const purged = yield* db
          .update(protectedMeasurementEvidence)
          .set({ ciphertext: null, deletionState: "deleted", updatedAt: new Date() })
          .where(
            and(
              eq(protectedMeasurementEvidence.retentionClass, "ephemeral"),
              eq(protectedMeasurementEvidence.deletionState, "active"),
              lt(protectedMeasurementEvidence.createdAt, cutoff),
            ),
          )
          .returning({ id: protectedMeasurementEvidence.id });
        return purged.length;
      });

      return { purgeExpiredEphemeral, request } as const;
    }),
  },
) {
  static readonly layer: Layer.Layer<MeasurementDeletionService, never, Db> = Layer.effect(
    MeasurementDeletionService,
  )(MeasurementDeletionService.make);
}
