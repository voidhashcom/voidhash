import * as Arr from "effect/Array";
import { constant } from "@voidhash/lib/lang";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { Db, and, eq, personIdentities, persons, pushPersonDeviceTokens, sql } from "@voidhash/db";

import {
  type DistinctIdMapping,
  type IdentityAssertion,
  planProjectionRebuild,
} from "../../domain/person/IdentityGraph.ts";
import { PersonServiceError } from "../persons/PersonService.ts";

/** Outcome of a {@link IdentityProjectionRebuildService.rebuildProject} run. */
export interface IdentityProjectionRebuildResult {
  readonly mappingsRepointed: number;
  readonly personsMerged: number;
}

/**
 * Recomputes the Postgres identity projection (`person_identity.person_id` +
 * `person.merged_into_person_id`) for a project from the append-only
 * `identity_assertion` log — the disaster-recovery / stitching-rule-change tool
 * the event-sourced ("Option B") model exists to enable. The actual graph logic
 * is the pure, order-agnostic {@link planProjectionRebuild}; this service only
 * reads the inputs and writes the diff in one transaction.
 *
 * It is idempotent: re-running it only touches rows whose canonical person
 * actually changed, so it converges. It is a batch admin operation (whole
 * project), not a per-request path.
 */
export class IdentityProjectionRebuildService extends Context.Service<IdentityProjectionRebuildService>()(
  "IdentityProjectionRebuildService",
  {
    make: Effect.gen(function* () {
      const db = yield* Db;

      const rebuildProject = Effect.fn("rebuildIdentityProjection")(
        function* (input: { readonly projectId: string }) {
          yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);

          return yield* db.transaction(
            Effect.fn("IdentityProjectionRebuildService.rebuildProject.transaction")(
              function* (tx) {
                const mappingRows = yield* tx.query.personIdentities.findMany({
                  where: { projectId: input.projectId },
                });
                if (Arr.isReadonlyArrayEmpty(mappingRows)) {
                  return { mappingsRepointed: 0, personsMerged: 0 };
                }

                const assertionRows = yield* tx.query.identityAssertions.findMany({
                  where: { projectId: input.projectId },
                });
                const personIds = Arr.fromIterable(
                  HashSet.fromIterable(Arr.map(mappingRows, (row) => row.personId)),
                );
                const personRows = yield* tx.query.persons.findMany({
                  where: { id: { in: personIds } },
                });
                const personById = HashMap.fromIterable(
                  Arr.map(personRows, (person) => [person.id, person] as const),
                );

                const mappings = Arr.flatMap(mappingRows, (row) =>
                  Arr.fromOption(
                    Option.map(
                      HashMap.get(personById, row.personId),
                      (person) =>
                        ({
                          distinctId: row.distinctId,
                          person: {
                            createdAt: Option.fromNullishOr(person.createdAt),
                            firstSeenAt: Option.fromNullishOr(person.firstSeenAt),
                            id: person.id,
                          },
                        }) satisfies DistinctIdMapping,
                    ),
                  ),
                );
                const assertions: ReadonlyArray<IdentityAssertion> = Arr.map(
                  assertionRows,
                  (row) => ({
                    distinctIdA: row.distinctIdA,
                    distinctIdB: row.distinctIdB,
                    eventTs: row.eventTs.getTime(),
                  }),
                );

                const plan = planProjectionRebuild({ assertions, mappings });

                const currentPersonByDistinct = HashMap.fromIterable(
                  Arr.map(mappingRows, (row) => [row.distinctId, row.personId] as const),
                );
                const mappingUpdates = yield* Effect.forEach(
                  Arr.fromIterable(plan.canonicalPersonOf),
                  ([distinctId, canonicalPersonId]) =>
                    Option.contains(
                      HashMap.get(currentPersonByDistinct, distinctId),
                      canonicalPersonId,
                    )
                      ? Effect.succeed(0)
                      : tx
                          .update(personIdentities)
                          .set({ personId: canonicalPersonId })
                          .where(
                            and(
                              eq(personIdentities.projectId, input.projectId),
                              eq(personIdentities.distinctId, distinctId),
                            ),
                          )
                          .pipe(Effect.as(1)),
                  { concurrency: 1 },
                );
                const mappingsRepointed = Arr.reduce(
                  mappingUpdates,
                  0,
                  (total, count) => total + count,
                );

                const now = yield* DateTime.nowAsDate;
                const personUpdates = yield* Effect.forEach(
                  Arr.fromIterable(plan.mergedInto),
                  Effect.fn("IdentityProjectionRebuildService.rebuildProject.mergePerson")(
                    function* ([personId, canonicalPersonId]) {
                      const person = HashMap.get(personById, personId);
                      if (
                        Option.isNone(person) ||
                        person.value.mergedIntoPersonId === canonicalPersonId
                      ) {
                        return 0;
                      }

                      yield* tx
                        .update(persons)
                        .set({
                          archivedAt: person.value.archivedAt ?? now,
                          mergedIntoPersonId: canonicalPersonId,
                        })
                        .where(eq(persons.id, personId));
                      // Re-point push device-token links to the survivor in the same
                      // rebuild transaction (belt) — mirrors the live merge re-point.
                      // NOT EXISTS skips devices the survivor already owns (the
                      // (person_id, push_device_token_id) unique index is global), else
                      // a bare re-point would raise a unique violation and abort the
                      // rebuild. Skipped loser links stay reachable via send-time
                      // merged-loser expansion.
                      yield* tx
                        .update(pushPersonDeviceTokens)
                        .set({ personId: canonicalPersonId, updatedAt: now })
                        .where(
                          and(
                            eq(pushPersonDeviceTokens.projectId, input.projectId),
                            eq(pushPersonDeviceTokens.personId, personId),
                            sql`not exists (select 1 from push_person_device_token s where s.person_id = ${canonicalPersonId} and s.push_device_token_id = push_person_device_token.push_device_token_id)`,
                          ),
                        );
                      return 1;
                    },
                  ),
                  { concurrency: 1 },
                );
                const personsMerged = Arr.reduce(personUpdates, 0, (total, count) => total + count);

                yield* Effect.annotateCurrentSpan(
                  "voidhash.identity_rebuild.mappings_repointed",
                  mappingsRepointed,
                );
                yield* Effect.annotateCurrentSpan(
                  "voidhash.identity_rebuild.persons_merged",
                  personsMerged,
                );

                return {
                  mappingsRepointed,
                  personsMerged,
                } satisfies IdentityProjectionRebuildResult;
              },
            ),
          );
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new PersonServiceError({ cause: String(error.cause) })),
              SqlError: (error) =>
                Effect.fail(new PersonServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      return constant({ rebuildProject });
    }),
  },
) {
  static layer = Layer.effect(IdentityProjectionRebuildService)(
    IdentityProjectionRebuildService.make,
  );
}
