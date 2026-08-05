import {
  Db,
  PersonIdentityKind,
  PersonIdentityMigrationJobStatus,
  eq,
  personIdentityMigrationJobs,
  sql,
} from "@voidhash/db";
import {
  type PersonIdentityEventV1,
  type PersonSnapshotEventV1,
  nextMappingVersion,
} from "@voidhash/core/domain/person/Person";
import { IdentityMutationService } from "@voidhash/core/services/personIdentity/IdentityMutationService";
import { generateId } from "@voidhash/core/utils/generate-id";
import { WorkflowRunner } from "@voidhash/platform/Workflow";
import { Effect, Layer, Schema } from "effect";

import { IdentifyDistinctIdCompletionDefinition } from "./WorkflowDefinitions.ts";

/** Registers the Postgres-backed source-identity completion workflow. */
export const registerIdentityCompletionWorkflow = (
  runner: WorkflowRunner["Service"],
  database: Layer.Layer<Db>,
) =>
  runner.register(
    IdentifyDistinctIdCompletionDefinition,
    (input, context) =>
      Effect.gen(function* () {
        const jobId = input.jobId;
        const recordFailure = (message: string) =>
          Effect.gen(function* () {
            const db = yield* Db;
            yield* db
              .update(personIdentityMigrationJobs)
              .set({
                lastError: message,
                status: PersonIdentityMigrationJobStatus.Failed,
              })
              .where(eq(personIdentityMigrationJobs.id, jobId));
          }).pipe(
            Effect.provide(database),
            Effect.catchCause((cause) =>
              Effect.logError("Failed to record identity completion failure", {
                cause,
                jobId,
              }),
            ),
          );

        yield* context.step({
          name: `mark-in-progress-${jobId}`,
          success: Schema.Void,
          execute: Effect.gen(function* () {
            const db = yield* Db;
            yield* db
              .update(personIdentityMigrationJobs)
              .set({
                attemptCount: sql`${personIdentityMigrationJobs.attemptCount} + 1`,
                lastError: null,
                status: PersonIdentityMigrationJobStatus.InProgress,
              })
              .where(eq(personIdentityMigrationJobs.id, jobId));
          }).pipe(Effect.provide(database)),
        });

        yield* context.step({
          name: `migrate-${jobId}`,
          success: Schema.Void,
          execute: Effect.gen(function* () {
            const db = yield* Db;
            const identityMutations = yield* IdentityMutationService;
            yield* db.transaction((tx) =>
              Effect.gen(function* () {
                const eventTimestamp = new Date(input.eventTimestamp);
                const personEvents: PersonSnapshotEventV1[] = [];
                const mappingEvents: PersonIdentityEventV1[] = [];

                yield* identityMutations.lockDistinctIdRows(tx, {
                  distinctIds: [input.previousDistinctId, input.distinctId],
                  projectId: input.projectId,
                });

                const targetPerson = yield* tx.query.persons.findFirst({
                  where: { id: input.targetPersonId },
                });
                if (!targetPerson) {
                  return yield* Effect.die(
                    new Error(`Target person ${input.targetPersonId} does not exist`),
                  );
                }

                const sourceMapping = yield* identityMutations.findDistinctIdMapping(tx, {
                  distinctId: input.previousDistinctId,
                  projectId: input.projectId,
                });
                const sourcePersonless = yield* identityMutations.findPersonlessIdentity(tx, {
                  distinctId: input.previousDistinctId,
                  projectId: input.projectId,
                });

                yield* identityMutations.lockPersonRows(tx, {
                  personIds: [
                    input.targetPersonId,
                    ...(sourceMapping ? [sourceMapping.rawPerson.id] : []),
                  ],
                });

                const sourceIsConflictingIdentified =
                  sourceMapping &&
                  sourceMapping.canonicalPerson.id !== input.targetPersonId &&
                  sourceMapping.mapping.kind === PersonIdentityKind.Identified;

                if (!sourceIsConflictingIdentified) {
                  const hadHistoricalEvents = Boolean(
                    (sourceMapping && sourceMapping.rawPerson.id !== input.targetPersonId) ||
                    (sourcePersonless && !sourcePersonless.isMerged),
                  );
                  const mappingVersion = nextMappingVersion({
                    existingVersion: sourceMapping?.mapping.version,
                    hadHistoricalEvents,
                  });

                  if (
                    sourceMapping &&
                    sourceMapping.mapping.personId !== input.targetPersonId &&
                    sourceMapping.mapping.kind === PersonIdentityKind.Anonymous
                  ) {
                    const archivedSource = yield* identityMutations.archivePerson(tx, {
                      eventTimestamp,
                      mergedIntoPersonId: input.targetPersonId,
                      person: sourceMapping.rawPerson,
                    });
                    personEvents.push(
                      yield* identityMutations.toPersonEvent(tx, { person: archivedSource }),
                    );
                  }

                  if (
                    !sourceMapping ||
                    sourceMapping.mapping.personId !== input.targetPersonId ||
                    sourceMapping.mapping.version !== mappingVersion
                  ) {
                    mappingEvents.push(
                      yield* identityMutations.upsertPersonIdentity(tx, {
                        changedAt: eventTimestamp,
                        distinctId: input.previousDistinctId,
                        identityId: sourceMapping?.mapping.id ?? generateId("personDistinctId"),
                        personId: input.targetPersonId,
                        projectId: input.projectId,
                        version: mappingVersion,
                      }),
                    );
                  }

                  if (sourcePersonless && !sourcePersonless.isMerged) {
                    yield* identityMutations.markPersonlessIdentityMerged(tx, {
                      distinctId: input.previousDistinctId,
                      projectId: input.projectId,
                    });
                  }
                }

                yield* tx
                  .update(personIdentityMigrationJobs)
                  .set({ mappingEvents, personEvents })
                  .where(eq(personIdentityMigrationJobs.id, jobId));
              }),
            );
          }).pipe(
            Effect.provide(IdentityMutationService.layer),
            Effect.provide(database),
            Effect.tapCause((cause) =>
              recordFailure(`Failed to migrate source identity: ${String(cause)}`),
            ),
          ),
        });

        yield* context.step({
          name: `mark-succeeded-${jobId}`,
          success: Schema.Void,
          execute: Effect.gen(function* () {
            const db = yield* Db;
            yield* db
              .update(personIdentityMigrationJobs)
              .set({
                completedAt: new Date(),
                lastError: null,
                status: PersonIdentityMigrationJobStatus.Succeeded,
              })
              .where(eq(personIdentityMigrationJobs.id, jobId));
          }).pipe(Effect.provide(database)),
        });
      }),
  );
