import * as Str from "effect/String";
import * as Arr from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import {
  and,
  Db,
  eq,
  type Person as DbPerson,
  PersonIdentityKind,
  type PersonOriginValue,
  pushPersonDeviceTokens,
  sql,
} from "@voidhash/db";
import { constant } from "@voidhash/lib/lang";

import { comparePersonForMerge } from "../../domain/person/IdentityGraph.ts";
import {
  type PersonIdentityEventV1,
  type PersonSnapshotEventV1,
  isAnonymousDistinctId,
  nextMappingVersion,
} from "../../domain/person/Person.ts";
import { firstDefinedString } from "../../utils/first-defined-string.ts";
import { generateId } from "../../utils/generate-id.ts";
import { PersonServiceError } from "../persons/PersonService.ts";
import { IdentityProjectionPublisher } from "./IdentityProjectionPublisher.ts";
import { DEFAULT_ORIGIN, IdentityMutationService } from "./IdentityMutationService.ts";

export type { PersonIdentityEventV1, PersonSnapshotEventV1 } from "../../domain/person/Person.ts";

/**
 * Dedup key for an appended identity assertion: the originating event id when
 * present, otherwise a freshly minted id (so the write still lands exactly once).
 */
const assertionDedupKey = (eventId: Option.Option<string>): string =>
  Option.filter(eventId, Str.isNonEmpty).pipe(
    Option.getOrElse(() => generateId("identityAssertion")),
  );

export interface ResolvedAnalyticsIdentity {
  readonly personId?: string;
  readonly distinctId: string;
  readonly mode: "full" | "personless";
}

export interface ResolveDistinctIdInput {
  readonly distinctId: string;
  readonly email?: string;
  /**
   * Stable per-event id — the deterministic same-timestamp tie-break for
   * per-trait LWW. The analytics-ingest path supplies the capture id; other
   * callers (payment providers, SDK) may omit it and tie-break by timestamp.
   */
  readonly eventId?: string;
  readonly eventTimestamp: Date;
  readonly name?: string;
  readonly origin?: PersonOriginValue;
  readonly projectId: string;
  readonly setAttributes: Record<string, unknown>;
  readonly setOnceAttributes: Record<string, unknown>;
  readonly shouldCreatePerson: boolean;
}

export interface IdentifyDistinctIdInput {
  readonly previousDistinctId: string;
  readonly distinctId: string;
  readonly email?: string;
  /**
   * Stable per-event id — the deterministic same-timestamp tie-break for
   * per-trait LWW. The analytics-ingest path supplies the capture id; other
   * callers (payment providers, SDK) may omit it and tie-break by timestamp.
   */
  readonly eventId?: string;
  readonly eventTimestamp: Date;
  readonly name?: string;
  readonly origin?: PersonOriginValue;
  readonly projectId: string;
  readonly setAttributes: Record<string, unknown>;
  readonly setOnceAttributes: Record<string, unknown>;
}

export interface PersonIdentityResult {
  readonly personEvents: ReadonlyArray<PersonSnapshotEventV1>;
  readonly identity: ResolvedAnalyticsIdentity;
  readonly mappingEvents: ReadonlyArray<PersonIdentityEventV1>;
  readonly warnings: ReadonlyArray<string>;
}

/**
 * Orchestrates the person-identity-resolution aggregate.
 *
 * - `resolveDistinctId` — look up (or lazily create) a person record for a
 *   given distinct id; the result drives every SDK call that needs to attach a
 *   person to an analytics event.
 * - `identifyDistinctId` — promote an anonymous identity to an identified one.
 *   The transaction synchronously reconciles the full source and target state,
 *   then publishes the resulting projection events.
 */
export class PersonIdentityService extends Context.Service<PersonIdentityService>()(
  "PersonIdentityService",
  {
    make: Effect.gen(function* () {
      const db = yield* Db;
      const identityMutations = yield* IdentityMutationService;
      const publisher = yield* IdentityProjectionPublisher;

      const resolveDistinctId = Effect.fn("resolveDistinctId")(
        function* (input: ResolveDistinctIdInput) {
          yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
          yield* Effect.annotateCurrentSpan("voidhash.person.distinct_id", input.distinctId);
          yield* Effect.annotateCurrentSpan(
            "voidhash.person.origin",
            input.origin ?? DEFAULT_ORIGIN,
          );

          return yield* db.transaction(
            Effect.fn("PersonIdentityService.resolveDistinctId.transaction")(function* (tx) {
              const context = {
                eventId: input.eventId ?? "",
                eventTimestamp: input.eventTimestamp,
                origin: input.origin ?? DEFAULT_ORIGIN,
                projectId: input.projectId,
              };

              if (!input.shouldCreatePerson) {
                const existingMapping = yield* identityMutations.findDistinctIdMapping(tx, {
                  distinctId: input.distinctId,
                  projectId: input.projectId,
                });
                if (Option.isSome(existingMapping)) {
                  yield* Effect.annotateCurrentSpan("voidhash.identity.mode", "full");
                  yield* Effect.annotateCurrentSpan(
                    "voidhash.person.id",
                    existingMapping.value.canonicalPerson.id,
                  );

                  return {
                    personEvents: [],
                    identity: {
                      personId: existingMapping.value.canonicalPerson.id,
                      distinctId: input.distinctId,
                      mode: constant("full"),
                    },
                    mappingEvents: [],
                    warnings: [],
                  } satisfies PersonIdentityResult;
                }

                yield* identityMutations.ensurePersonlessIdentity(tx, {
                  distinctId: input.distinctId,
                  projectId: input.projectId,
                });

                yield* Effect.annotateCurrentSpan("voidhash.identity.mode", "personless");

                return {
                  personEvents: [],
                  identity: {
                    distinctId: input.distinctId,
                    mode: constant("personless"),
                  },
                  mappingEvents: [],
                  warnings: [],
                } satisfies PersonIdentityResult;
              }

              const resolved = yield* identityMutations.ensureCanonicalPersonForDistinctId(tx, {
                context,
                distinctId: input.distinctId,
                email: input.email,
                name: input.name,
                setAttributes: input.setAttributes,
                setOnceAttributes: input.setOnceAttributes,
              });
              const person = resolved.wasCreated
                ? yield* identityMutations
                    .upsertAccountTokenBinding(tx, {
                      distinctId: input.distinctId,
                      personId: resolved.person.id,
                      projectId: input.projectId,
                    })
                    .pipe(Effect.as(resolved.person))
                : yield* identityMutations.updatePersonProfile(tx, {
                    person: resolved.person,
                    email: Option.fromNullishOr(input.email),
                    eventId: input.eventId ?? "",
                    eventTimestamp: input.eventTimestamp,
                    mergeTraitsFrom: Option.none(),
                    name: Option.fromNullishOr(input.name),
                    setAttributes: input.setAttributes,
                    setOnceAttributes: input.setOnceAttributes,
                  });

              yield* Effect.annotateCurrentSpan("voidhash.identity.mode", "full");
              yield* Effect.annotateCurrentSpan(
                "voidhash.identity.was_created",
                resolved.wasCreated,
              );
              yield* Effect.annotateCurrentSpan("voidhash.person.id", person.id);

              return {
                personEvents: [yield* identityMutations.toPersonEvent(tx, { person })],
                identity: {
                  personId: person.id,
                  distinctId: input.distinctId,
                  mode: constant("full"),
                },
                mappingEvents: Arr.fromOption(resolved.mappingEvent),
                warnings: [],
              } satisfies PersonIdentityResult;
            }),
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

      const identifyDistinctId = Effect.fn("identifyDistinctId")(
        function* (input: IdentifyDistinctIdInput) {
          yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
          yield* Effect.annotateCurrentSpan("voidhash.person.distinct_id", input.distinctId);
          yield* Effect.annotateCurrentSpan(
            "voidhash.person.previous_distinct_id",
            input.previousDistinctId,
          );
          yield* Effect.annotateCurrentSpan(
            "voidhash.person.origin",
            input.origin ?? DEFAULT_ORIGIN,
          );

          const syncResult = yield* db.transaction(
            Effect.fn("PersonIdentityService.identifyDistinctId.transaction")(function* (tx) {
              const warnings: string[] = [];
              const personEvents: PersonSnapshotEventV1[] = [];
              const mappingEvents: PersonIdentityEventV1[] = [];
              const origin = input.origin ?? DEFAULT_ORIGIN;
              const context = {
                eventId: input.eventId ?? "",
                eventTimestamp: input.eventTimestamp,
                origin,
                projectId: input.projectId,
              };

              if (isAnonymousDistinctId(input.distinctId)) {
                return yield* Effect.fail(
                  new PersonServiceError({
                    cause: "identify target distinct id cannot use the anonymous prefix",
                  }),
                );
              }

              yield* identityMutations.lockDistinctIdRows(tx, {
                distinctIds: [input.previousDistinctId, input.distinctId],
                projectId: input.projectId,
              });

              const targetResolved = yield* identityMutations.ensureCanonicalPersonForDistinctId(
                tx,
                {
                  context,
                  distinctId: input.distinctId,
                  email: undefined,
                  name: undefined,
                  setAttributes: {},
                  setOnceAttributes: {},
                },
              );
              mappingEvents.push(...Arr.fromOption(targetResolved.mappingEvent));

              yield* Effect.annotateCurrentSpan(
                "voidhash.person.target_id",
                targetResolved.person.id,
              );

              const sourceMapping = yield* identityMutations.findDistinctIdMapping(tx, {
                distinctId: input.previousDistinctId,
                projectId: input.projectId,
              });
              if (Option.isSome(sourceMapping)) {
                yield* Effect.annotateCurrentSpan(
                  "voidhash.person.source_id",
                  sourceMapping.value.canonicalPerson.id,
                );
              }
              const sourcePersonless = yield* identityMutations.findPersonlessIdentity(tx, {
                distinctId: input.previousDistinctId,
                projectId: input.projectId,
              });

              yield* identityMutations.lockPersonRows(tx, {
                personIds: [
                  targetResolved.person.id,
                  ...Arr.fromOption(Option.map(sourceMapping, (mapping) => mapping.rawPerson.id)),
                ],
              });

              if (input.previousDistinctId === input.distinctId) {
                warnings.push("self-identify is a no-op");
              }

              const sourceIsConflictingIdentified = Option.exists(
                sourceMapping,
                (mapping) =>
                  mapping.canonicalPerson.id !== targetResolved.person.id &&
                  mapping.mapping.kind === PersonIdentityKind.Identified,
              );

              yield* Effect.annotateCurrentSpan(
                "voidhash.identity.source_conflict",
                Boolean(sourceIsConflictingIdentified),
              );

              if (sourceIsConflictingIdentified) {
                warnings.push("identify source already belongs to a different identified person");
              }

              // A real merge happens only when the source resolves to a
              // *different* existing person and is not a conflicting identified
              // person. The OLDER person wins (comparePersonForMerge) — an
              // order-independent decision, so a reversed identify chain
              // converges on the same surviving person. The full merge runs
              // synchronously in this transaction (no async completion workflow).
              const sourcePerson = Option.map(sourceMapping, (mapping) => mapping.canonicalPerson);
              const isRealMerge =
                !sourceIsConflictingIdentified &&
                input.previousDistinctId !== input.distinctId &&
                Option.exists(sourcePerson, (person) => person.id !== targetResolved.person.id);

              // True for any genuine identity stitch (person merge OR a
              // personless/absent source bound to the target) — i.e. anything
              // that asserts the two distinct ids are the same person and so
              // must be appended to the assertion log.
              const mergePeople = Effect.fn("PersonIdentityService.identifyDistinctId.merge")(
                function* (source: DbPerson) {
                  const sourceWins =
                    comparePersonForMerge(
                      {
                        createdAt: Option.fromNullishOr(source.createdAt),
                        firstSeenAt: Option.fromNullishOr(source.firstSeenAt),
                        id: source.id,
                      },
                      {
                        createdAt: Option.fromNullishOr(targetResolved.person.createdAt),
                        firstSeenAt: Option.fromNullishOr(targetResolved.person.firstSeenAt),
                        id: targetResolved.person.id,
                      },
                    ) <= 0;
                  const mergeRoles = () => {
                    if (sourceWins) {
                      return {
                        loser: targetResolved.person,
                        loserDistinctId: input.distinctId,
                        loserMapping: targetResolved.rawMapping,
                        winner: source,
                      };
                    }
                    return {
                      loser: source,
                      loserDistinctId: input.previousDistinctId,
                      loserMapping: Option.map(sourceMapping, (mapping) => mapping.mapping),
                      winner: targetResolved.person,
                    };
                  };
                  const { loser, loserDistinctId, loserMapping, winner } = mergeRoles();

                  yield* Effect.annotateCurrentSpan("voidhash.person.merge_winner_id", winner.id);
                  yield* Effect.annotateCurrentSpan("voidhash.person.merge_loser_id", loser.id);

                  const updatedWinner = yield* identityMutations.updatePersonProfile(tx, {
                    person: winner,
                    eventId: input.eventId ?? "",
                    eventTimestamp: input.eventTimestamp,
                    // Fold the loser's traits into the survivor via per-key LWW.
                    mergeTraitsFrom: Option.some(loser),
                    name: firstDefinedString(
                      Option.fromNullishOr(winner.name),
                      Option.fromNullishOr(loser.name),
                      Option.fromNullishOr(input.name),
                    ),
                    email: firstDefinedString(
                      Option.fromNullishOr(winner.email),
                      Option.fromNullishOr(loser.email),
                      Option.fromNullishOr(input.email),
                    ),
                    setAttributes: input.setAttributes,
                    setOnceAttributes: input.setOnceAttributes,
                  });
                  const archivedLoser = yield* identityMutations.archivePerson(tx, {
                    eventTimestamp: input.eventTimestamp,
                    mergedIntoPersonId: updatedWinner.id,
                    person: loser,
                  });

                  // Repoint the ENTIRE loser cluster onto the survivor as explicit
                  // overrides, so every distinct id that resolved to the loser
                  // re-attributes to the survivor — not just the one named by this
                  // identify. Keeping the overrides canonical this way is what makes
                  // the analytics squash transitively convergent in a single pass
                  // (no person-merge chain-following needed downstream).
                  const loserMappings = yield* identityMutations.listMappedDistinctIds(tx, {
                    personId: loser.id,
                    projectId: input.projectId,
                  });
                  const mappedRepoints = HashMap.fromIterable(
                    Arr.map(
                      loserMappings,
                      (mapping) =>
                        [
                          mapping.distinctId,
                          {
                            id: Option.some(mapping.id),
                            version: Option.some(mapping.version),
                          },
                        ] as const,
                    ),
                  );
                  // The involved loser distinct id was usually just created by
                  // ensureCanonical (so it is already listed) — include it defensively.
                  const repointed = HashMap.has(mappedRepoints, loserDistinctId)
                    ? mappedRepoints
                    : HashMap.set(mappedRepoints, loserDistinctId, {
                        id: Option.map(loserMapping, (mapping) => mapping.id),
                        version: Option.map(loserMapping, (mapping) => mapping.version),
                      });
                  const repointedEvents = yield* Effect.forEach(
                    Arr.fromIterable(repointed),
                    ([distinctId, existing]) =>
                      identityMutations.upsertPersonIdentity(tx, {
                        changedAt: input.eventTimestamp,
                        distinctId,
                        identityId: Option.getOrElse(existing.id, () =>
                          generateId("personDistinctId"),
                        ),
                        personId: updatedWinner.id,
                        previousDistinctId: distinctId,
                        projectId: input.projectId,
                        version: nextMappingVersion({
                          existingVersion: Option.getOrUndefined(existing.version),
                          hadHistoricalEvents: true,
                        }),
                      }),
                    { concurrency: 1 },
                  );
                  mappingEvents.push(...repointedEvents);

                  // Re-point the loser's push device-token links to the survivor in
                  // the SAME merge transaction, exactly like personIdentities — so a
                  // merged-away person's devices stay reachable. The NOT EXISTS guard
                  // skips links whose device the survivor ALREADY owns: the
                  // (person_id, push_device_token_id) unique index is global (ignores
                  // deleted_at), so a bare re-point would raise a unique violation and
                  // abort the whole merge. A skipped colliding loser link stays under
                  // the loser and remains reachable via the send-time merged-loser
                  // expansion (belt-and-suspenders). See
                  // PersonNotificationTokenService.repointLinksToSurvivor.
                  yield* tx
                    .update(pushPersonDeviceTokens)
                    .set({ personId: updatedWinner.id, updatedAt: yield* DateTime.nowAsDate })
                    .where(
                      and(
                        eq(pushPersonDeviceTokens.projectId, input.projectId),
                        eq(pushPersonDeviceTokens.personId, loser.id),
                        sql`not exists (select 1 from push_person_device_token s where s.person_id = ${updatedWinner.id} and s.push_device_token_id = push_person_device_token.push_device_token_id)`,
                      ),
                    );

                  if (Option.exists(sourcePersonless, (identity) => !identity.isMerged)) {
                    yield* identityMutations.markPersonlessIdentityMerged(tx, {
                      distinctId: input.previousDistinctId,
                      projectId: input.projectId,
                    });
                  }

                  personEvents.push(
                    yield* identityMutations.toPersonEvent(tx, { person: updatedWinner }),
                  );
                  personEvents.push(
                    yield* identityMutations.toPersonEvent(tx, { person: archivedLoser }),
                  );

                  return { canonicalPerson: updatedWinner, didStitch: true };
                },
              );

              const updateTarget = Effect.fn(
                "PersonIdentityService.identifyDistinctId.updateTarget",
              )(function* () {
                // No real merge (self / conflicting / same person / personless
                // source). Apply this event's writes to the target; for a
                // personless-or-absent source being stitched, point its distinct
                // id at the target.
                const updatedTarget = yield* identityMutations.updatePersonProfile(tx, {
                  person: targetResolved.person,
                  email: firstDefinedString(
                    Option.fromNullishOr(targetResolved.person.email),
                    Option.fromNullishOr(input.email),
                  ),
                  eventId: input.eventId ?? "",
                  eventTimestamp: input.eventTimestamp,
                  mergeTraitsFrom: Option.none(),
                  name: firstDefinedString(
                    Option.fromNullishOr(targetResolved.person.name),
                    Option.fromNullishOr(input.name),
                  ),
                  setAttributes: input.setAttributes,
                  setOnceAttributes: input.setOnceAttributes,
                });
                personEvents.push(
                  yield* identityMutations.toPersonEvent(tx, { person: updatedTarget }),
                );

                const shouldStitch =
                  !sourceIsConflictingIdentified &&
                  input.previousDistinctId !== input.distinctId &&
                  Option.isNone(sourcePerson);
                if (shouldStitch) {
                  mappingEvents.push(
                    yield* identityMutations.upsertPersonIdentity(tx, {
                      changedAt: input.eventTimestamp,
                      distinctId: input.previousDistinctId,
                      identityId: generateId("personDistinctId"),
                      personId: updatedTarget.id,
                      previousDistinctId: input.previousDistinctId,
                      projectId: input.projectId,
                      version: nextMappingVersion({
                        existingVersion: undefined,
                        hadHistoricalEvents: Boolean(
                          Option.exists(sourcePersonless, (identity) => !identity.isMerged),
                        ),
                      }),
                    }),
                  );
                  if (Option.exists(sourcePersonless, (identity) => !identity.isMerged)) {
                    yield* identityMutations.markPersonlessIdentityMerged(tx, {
                      distinctId: input.previousDistinctId,
                      projectId: input.projectId,
                    });
                  }
                }

                return { canonicalPerson: updatedTarget, didStitch: shouldStitch };
              });

              const { canonicalPerson, didStitch } =
                isRealMerge && Option.isSome(sourcePerson)
                  ? yield* mergePeople(sourcePerson.value)
                  : yield* updateTarget();

              // Account-token bindings: both distinct ids bind to the surviving
              // canonical person so provider webhooks (which carry the derived
              // token) resolve to it. Skipped for a conflicting identified source
              // (no merge; repointing would steal the other person's token).
              yield* identityMutations.upsertAccountTokenBinding(tx, {
                distinctId: input.distinctId,
                personId: canonicalPerson.id,
                projectId: input.projectId,
              });
              if (!sourceIsConflictingIdentified && input.previousDistinctId !== input.distinctId) {
                yield* identityMutations.upsertAccountTokenBinding(tx, {
                  distinctId: input.previousDistinctId,
                  personId: canonicalPerson.id,
                  projectId: input.projectId,
                });
              }

              yield* Effect.annotateCurrentSpan("voidhash.person.id", canonicalPerson.id);
              yield* Effect.annotateCurrentSpan("voidhash.identity.mode", "full");

              if (didStitch) {
                // Append the immutable identity assertion (the Option B log) for
                // any genuine stitch. Idempotent on (project, dedupKey); the
                // ingest path's capture id makes a retried identify log once.
                yield* identityMutations.appendAssertion(tx, {
                  dedupKey: assertionDedupKey(Option.fromNullishOr(input.eventId)),
                  distinctId: input.distinctId,
                  eventTimestamp: input.eventTimestamp,
                  previousDistinctId: input.previousDistinctId,
                  projectId: input.projectId,
                  source: origin,
                });
              }

              return {
                personEvents,
                identity: {
                  personId: canonicalPerson.id,
                  distinctId: input.distinctId,
                  mode: constant("full"),
                },
                mappingEvents,
                warnings,
              } satisfies PersonIdentityResult;
            }),
          );

          yield* publisher.publishIdentityResult(syncResult).pipe(
            Effect.catch((error) =>
              Effect.logError(
                "Failed to publish synchronous identity projection events; database is updated but downstream consumers will not receive these changes",
                {
                  cause: error,
                  distinctId: input.distinctId,
                  personId: syncResult.identity.personId,
                  projectId: input.projectId,
                },
              ),
            ),
          );

          return syncResult;
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(
                  new PersonServiceError({
                    cause: `Failed to identify distinct id: ${String(error.cause)}`,
                  }),
                ),
              SqlError: (error) =>
                Effect.fail(
                  new PersonServiceError({
                    cause: `Failed to identify distinct id: ${String(error.cause)}`,
                  }),
                ),
            }),
          ),
      );

      return constant({ identifyDistinctId, resolveDistinctId });
    }),
  },
) {
  static layer = Layer.effect(PersonIdentityService)(PersonIdentityService.make).pipe(
    Layer.provide(IdentityMutationService.layer),
  );
}
