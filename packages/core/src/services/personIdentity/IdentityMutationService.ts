import { Context, Effect, Layer } from "effect";

import {
  type DbError,
  type DbTransaction,
  type Person as DbPerson,
  type PersonIdentity as DbPersonIdentity,
  PersonIdentityKind,
  type PersonIdentityKindValue,
  PersonOrigin,
  type PersonOriginValue,
  eq,
  identityAssertions,
  persons,
  sql,
} from "@voidhash/db";

import {
  applyTraitWrite,
  combineTraitStates,
  materializeTraitState,
  type TraitFoldState,
} from "../../domain/person/IdentityGraph.ts";
import {
  type PersonIdentityEventV1,
  type PersonSnapshotEventV1,
  isAnonymousDistinctId,
} from "../../domain/person/Person.ts";
import { ACCOUNT_TOKEN_SERVICE_ID, deriveAccountToken } from "../../utils/crypto/account-token.ts";
import { generateId } from "../../utils/generate-id.ts";

/** Default {@link PersonOrigin} stamped on persons created without one. */
export const DEFAULT_ORIGIN = PersonOrigin.API;

/** Shared per-mutation preamble: when/where the change happened and its origin. */
export interface MutationContext {
  readonly eventTimestamp: Date;
  /** Stable per-event id — the deterministic same-timestamp LWW tie-break. */
  readonly eventId: string;
  readonly origin: PersonOriginValue;
  readonly projectId: string;
}

/** A resolved `(distinctId → person)` mapping with both the raw and canonical person. */
export interface MappingResolution {
  readonly canonicalPerson: DbPerson;
  readonly mapping: DbPersonIdentity;
  readonly rawPerson: DbPerson;
}

/** Outcome of {@link IdentityMutationService.ensureCanonicalPersonForDistinctId}. */
export interface CanonicalPersonResolution {
  readonly person: DbPerson;
  readonly mappingEvent?: PersonIdentityEventV1;
  readonly rawMapping?: DbPersonIdentity;
  readonly wasCreated: boolean;
}

const toPersonVersion = (person: DbPerson): number =>
  person.updatedAt?.getTime() ?? person.createdAt?.getTime() ?? Date.now();

const deriveIdentityKind = (distinctId: string): PersonIdentityKindValue =>
  isAnonymousDistinctId(distinctId) ? PersonIdentityKind.Anonymous : PersonIdentityKind.Identified;

const toMappingEvent = ({
  changedAt,
  personId,
  distinctId,
  previousDistinctId,
  kind,
  projectId,
  version,
}: {
  readonly changedAt: string;
  readonly personId: string;
  readonly distinctId: string;
  readonly previousDistinctId?: string;
  readonly kind: PersonIdentityKindValue;
  readonly projectId: string;
  readonly version: number;
}): PersonIdentityEventV1 => ({
  changedAt,
  personId,
  distinctId,
  ...(previousDistinctId ? { previousDistinctId } : {}),
  isDeleted: false,
  kind,
  projectId,
  schemaVersion: 1,
  version,
});

/**
 * Person-identity write operations, each running on a caller-supplied
 * transaction handle (`tx`) so the surrounding service or workflow controls
 * commit/rollback. Consumed by {@link PersonIdentityService} (synchronous
 * resolve/identify) and the identity completion workflow (durable source-side
 * merge). Pure projection types and trait/version rules live in the
 * `domain/person` model; this service owns only the database mutations.
 */
export class IdentityMutationService extends Context.Service<IdentityMutationService>()(
  "IdentityMutationService",
  {
    make: Effect.gen(function* () {
      const findPersonById = Effect.fn("findPersonById")(
        (db: DbTransaction, { personId }: { readonly personId: string }) =>
          Effect.gen(function* () {
            yield* Effect.annotateCurrentSpan("voidhash.person.id", personId);

            return yield* db.query.persons.findFirst({
              where: { id: personId },
            });
          }),
      );

      const resolveCanonicalPerson = Effect.fn("resolveCanonicalPerson")(
        (
          db: DbTransaction,
          {
            person,
          }: {
            readonly person: DbPerson;
          },
        ): Effect.Effect<DbPerson, DbError> =>
          Effect.gen(function* () {
            yield* Effect.annotateCurrentSpan("voidhash.person.id", person.id);
            if (person.mergedIntoPersonId) {
              yield* Effect.annotateCurrentSpan(
                "voidhash.person.merged_into_id",
                person.mergedIntoPersonId,
              );
            }

            let current = person;

            while (current.mergedIntoPersonId) {
              const mergedIntoPerson = yield* findPersonById(db, {
                personId: current.mergedIntoPersonId,
              });
              if (!mergedIntoPerson) {
                return current;
              }
              current = mergedIntoPerson;
            }

            return current;
          }),
      );

      const findDistinctIdMapping = Effect.fn("findDistinctIdMapping")(
        (
          db: DbTransaction,
          {
            distinctId,
            projectId,
          }: {
            readonly distinctId: string;
            readonly projectId: string;
          },
        ): Effect.Effect<MappingResolution | undefined, DbError> =>
          Effect.gen(function* () {
            yield* Effect.annotateCurrentSpan("voidhash.project.id", projectId);
            yield* Effect.annotateCurrentSpan("voidhash.person.distinct_id", distinctId);

            const mapping = yield* db.query.personIdentities.findFirst({
              where: { projectId, distinctId },
            });
            if (!mapping) {
              return undefined;
            }

            yield* Effect.annotateCurrentSpan("voidhash.person_identity.id", mapping.id);
            yield* Effect.annotateCurrentSpan(
              "voidhash.person_identity.kind",
              deriveIdentityKind(distinctId),
            );

            const rawPerson = yield* findPersonById(db, {
              personId: mapping.personId,
            });
            if (!rawPerson) {
              return undefined;
            }

            const canonicalPerson = yield* resolveCanonicalPerson(db, {
              person: rawPerson,
            });
            yield* Effect.annotateCurrentSpan("voidhash.person.id", canonicalPerson.id);

            return {
              canonicalPerson,
              mapping,
              rawPerson,
            };
          }),
      );

      const findPersonlessIdentity = Effect.fn("findPersonlessIdentity")(
        (
          db: DbTransaction,
          {
            distinctId,
            projectId,
          }: {
            readonly distinctId: string;
            readonly projectId: string;
          },
        ) =>
          Effect.gen(function* () {
            yield* Effect.annotateCurrentSpan("voidhash.project.id", projectId);
            yield* Effect.annotateCurrentSpan("voidhash.person.distinct_id", distinctId);

            return yield* db.query.personPersonlessIdentities.findFirst({
              where: { projectId, distinctId },
            });
          }),
      );

      const ensurePersonlessIdentity = Effect.fn("ensurePersonlessIdentity")(
        (
          db: DbTransaction,
          {
            distinctId,
            projectId,
          }: {
            readonly distinctId: string;
            readonly projectId: string;
          },
        ) =>
          Effect.gen(function* () {
            yield* Effect.annotateCurrentSpan("voidhash.project.id", projectId);
            yield* Effect.annotateCurrentSpan("voidhash.person.distinct_id", distinctId);

            yield* db.execute(sql`
              INSERT INTO person_personless_identity
                (project_id, distinct_id, is_merged, created_at, updated_at)
              VALUES
                (${projectId}, ${distinctId}, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              ON CONFLICT (project_id, distinct_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
            `);
          }),
      );

      const markPersonlessIdentityMerged = Effect.fn("markPersonlessIdentityMerged")(
        (
          db: DbTransaction,
          {
            distinctId,
            projectId,
          }: {
            readonly distinctId: string;
            readonly projectId: string;
          },
        ) =>
          Effect.gen(function* () {
            yield* Effect.annotateCurrentSpan("voidhash.project.id", projectId);
            yield* Effect.annotateCurrentSpan("voidhash.person.distinct_id", distinctId);

            yield* db.execute(sql`
              UPDATE person_personless_identity
              SET is_merged = true, updated_at = CURRENT_TIMESTAMP
              WHERE project_id = ${projectId} AND distinct_id = ${distinctId}
            `);
          }),
      );

      const createPersonRow = Effect.fn("createPersonRow")(
        (
          db: DbTransaction,
          {
            context,
            email,
            name,
            setAttributes,
            setOnceAttributes,
          }: {
            readonly context: MutationContext;
            readonly email?: string;
            readonly name?: string;
            readonly setAttributes: Record<string, unknown>;
            readonly setOnceAttributes: Record<string, unknown>;
          },
        ): Effect.Effect<DbPerson, DbError> =>
          Effect.gen(function* () {
            const folded = applyTraitWrite(
              { meta: {}, traits: {} },
              {
                eventId: context.eventId,
                eventTs: context.eventTimestamp.getTime(),
                set: setAttributes,
                setOnce: setOnceAttributes,
              },
            );
            const person = {
              archivedAt: null,
              createdAt: context.eventTimestamp,
              email: email ?? null,
              firstSeenAt: context.eventTimestamp,
              id: generateId("person"),
              lastSeenAt: context.eventTimestamp,
              mergedIntoPersonId: null,
              name: name ?? null,
              origin: context.origin,
              projectId: context.projectId,
              traits: folded.traits,
              traitsMeta: folded.meta,
              updatedAt: context.eventTimestamp,
            } as DbPerson;

            yield* Effect.annotateCurrentSpan("voidhash.project.id", context.projectId);
            yield* Effect.annotateCurrentSpan("voidhash.person.id", person.id);
            yield* Effect.annotateCurrentSpan("voidhash.person.origin", context.origin);

            yield* db.insert(persons).values({
              email: person.email,
              firstSeenAt: person.firstSeenAt,
              id: person.id,
              lastSeenAt: person.lastSeenAt,
              mergedIntoPersonId: person.mergedIntoPersonId,
              name: person.name,
              origin: person.origin,
              projectId: person.projectId,
              traits: person.traits,
              traitsMeta: person.traitsMeta,
            });

            return person;
          }),
      );

      const updatePersonProfile = Effect.fn("updatePersonProfile")(
        (
          db: DbTransaction,
          {
            person,
            email,
            eventId,
            eventTimestamp,
            mergeTraitsFrom,
            name,
            setAttributes,
            setOnceAttributes,
          }: {
            readonly person: DbPerson;
            readonly email?: string | null;
            readonly eventId: string;
            readonly eventTimestamp: Date;
            /**
             * When present, the source person whose trait state is merged into
             * `person` via per-key LWW before applying this event's writes.
             * Used by the identify merge so the surviving person inherits the
             * other side's traits deterministically.
             */
            readonly mergeTraitsFrom?: DbPerson;
            readonly name?: string | null;
            readonly setAttributes: Record<string, unknown>;
            readonly setOnceAttributes: Record<string, unknown>;
          },
        ): Effect.Effect<DbPerson, DbError> =>
          Effect.gen(function* () {
            yield* Effect.annotateCurrentSpan("voidhash.project.id", person.projectId);
            yield* Effect.annotateCurrentSpan("voidhash.person.id", person.id);

            const nextFirstSeen =
              person.firstSeenAt && person.firstSeenAt.getTime() <= eventTimestamp.getTime()
                ? person.firstSeenAt
                : eventTimestamp;
            const nextLastSeen =
              person.lastSeenAt && person.lastSeenAt.getTime() >= eventTimestamp.getTime()
                ? person.lastSeenAt
                : eventTimestamp;

            // Per-key LWW: combine the other person's state (on merge), then
            // fold this event's writes. Order-independent, so out-of-order
            // events can't regress a newer trait value.
            const targetState = materializeTraitState(person.traits, person.traitsMeta);
            const baseState: TraitFoldState = mergeTraitsFrom
              ? combineTraitStates(
                  targetState,
                  materializeTraitState(mergeTraitsFrom.traits, mergeTraitsFrom.traitsMeta),
                )
              : targetState;
            const folded = applyTraitWrite(baseState, {
              eventId,
              eventTs: eventTimestamp.getTime(),
              set: setAttributes,
              setOnce: setOnceAttributes,
            });

            const nextEmail = typeof email === "undefined" ? person.email : (email ?? person.email);
            const nextName = typeof name === "undefined" ? person.name : (name ?? person.name);

            yield* db
              .update(persons)
              .set({
                email: nextEmail,
                firstSeenAt: nextFirstSeen,
                lastSeenAt: nextLastSeen,
                name: nextName,
                traits: folded.traits,
                traitsMeta: folded.meta,
              })
              .where(eq(persons.id, person.id));

            return {
              ...person,
              email: nextEmail,
              firstSeenAt: nextFirstSeen,
              lastSeenAt: nextLastSeen,
              name: nextName,
              traits: folded.traits,
              traitsMeta: folded.meta,
              updatedAt: eventTimestamp,
            };
          }),
      );

      const archivePerson = Effect.fn("archivePerson")(
        (
          db: DbTransaction,
          {
            person,
            eventTimestamp,
            mergedIntoPersonId,
          }: {
            readonly person: DbPerson;
            readonly eventTimestamp: Date;
            readonly mergedIntoPersonId: string;
          },
        ): Effect.Effect<DbPerson, DbError> =>
          Effect.gen(function* () {
            yield* Effect.annotateCurrentSpan("voidhash.project.id", person.projectId);
            yield* Effect.annotateCurrentSpan("voidhash.person.id", person.id);
            yield* Effect.annotateCurrentSpan("voidhash.person.merged_into_id", mergedIntoPersonId);

            if (person.archivedAt !== null && person.mergedIntoPersonId === mergedIntoPersonId) {
              return person;
            }

            yield* db
              .update(persons)
              .set({
                archivedAt: eventTimestamp,
                mergedIntoPersonId,
              })
              .where(eq(persons.id, person.id));

            return {
              ...person,
              archivedAt: eventTimestamp,
              mergedIntoPersonId,
              updatedAt: eventTimestamp,
            };
          }),
      );

      const upsertPersonIdentity = Effect.fn("upsertPersonIdentity")(
        (
          db: DbTransaction,
          {
            changedAt,
            personId,
            distinctId,
            previousDistinctId,
            identityId,
            projectId,
            version,
          }: {
            readonly changedAt: Date;
            readonly personId: string;
            readonly distinctId: string;
            /**
             * When set, emits an identity *override* mapping event so events
             * carrying `previousDistinctId` are re-attributed to `personId` in
             * the analytics projection, independent of the merge direction.
             */
            readonly previousDistinctId?: string;
            readonly identityId: string;
            readonly projectId: string;
            readonly version: number;
          },
        ): Effect.Effect<PersonIdentityEventV1, DbError> =>
          Effect.gen(function* () {
            const kind = deriveIdentityKind(distinctId);

            yield* Effect.annotateCurrentSpan("voidhash.project.id", projectId);
            yield* Effect.annotateCurrentSpan("voidhash.person.id", personId);
            yield* Effect.annotateCurrentSpan("voidhash.person.distinct_id", distinctId);
            yield* Effect.annotateCurrentSpan("voidhash.person_identity.id", identityId);
            yield* Effect.annotateCurrentSpan("voidhash.person_identity.kind", kind);

            yield* db.execute(sql`
              INSERT INTO person_identity
                (id, project_id, distinct_id, person_id, kind, version, created_at, updated_at)
              VALUES
                (
                  ${identityId},
                  ${projectId},
                  ${distinctId},
                  ${personId},
                  ${kind},
                  ${version},
                  CURRENT_TIMESTAMP,
                  CURRENT_TIMESTAMP
                )
              ON CONFLICT (project_id, distinct_id) DO UPDATE SET
                person_id = EXCLUDED.person_id,
                kind = EXCLUDED.kind,
                version = EXCLUDED.version,
                updated_at = CURRENT_TIMESTAMP
            `);

            return toMappingEvent({
              changedAt: changedAt.toISOString(),
              personId,
              distinctId,
              previousDistinctId,
              kind,
              projectId,
              version,
            });
          }),
      );

      /**
       * Pre-registers the deterministic account token of a distinctId (see
       * `utils/crypto/account-token.ts`) as a `person_external_identifier` row
       * under {@link ACCOUNT_TOKEN_SERVICE_ID}, so an App Store / Google Play
       * webhook that carries only the token resolves to the right person even
       * when it arrives before any SDK transaction sync.
       *
       * Idempotent and repointing: the UNIQUE `(projectId, serviceId, identifier)`
       * key serializes concurrent writers, and `ON CONFLICT ... DO UPDATE
       * person_id` moves an existing binding onto the new canonical person —
       * which is exactly what an identify-merge needs (the completion workflow
       * does not repoint external identifiers).
       */
      const upsertAccountTokenBinding = Effect.fn("upsertAccountTokenBinding")(
        (
          db: DbTransaction,
          {
            distinctId,
            personId,
            projectId,
          }: {
            readonly distinctId: string;
            readonly personId: string;
            readonly projectId: string;
          },
        ): Effect.Effect<void, DbError> =>
          Effect.gen(function* () {
            const token = yield* deriveAccountToken(distinctId);

            yield* Effect.annotateCurrentSpan("voidhash.project.id", projectId);
            yield* Effect.annotateCurrentSpan("voidhash.person.id", personId);
            yield* Effect.annotateCurrentSpan("voidhash.person.account_token", token);

            yield* db.execute(sql`
              INSERT INTO person_external_identifier
                (id, project_id, person_id, service_id, is_default, identifier, created_at)
              VALUES
                (
                  ${generateId("personDistinctId")},
                  ${projectId},
                  ${personId},
                  ${ACCOUNT_TOKEN_SERVICE_ID},
                  ${true},
                  ${token},
                  CURRENT_TIMESTAMP
                )
              ON CONFLICT (project_id, service_id, identifier) DO UPDATE SET
                person_id = EXCLUDED.person_id,
                updated_at = CURRENT_TIMESTAMP
            `);
          }),
      );

      const selectPrimaryDistinctId = Effect.fn("selectPrimaryDistinctId")(
        (
          db: DbTransaction,
          {
            personId,
            projectId,
          }: {
            readonly personId: string;
            readonly projectId: string;
          },
        ) =>
          Effect.gen(function* () {
            yield* Effect.annotateCurrentSpan("voidhash.project.id", projectId);
            yield* Effect.annotateCurrentSpan("voidhash.person.id", personId);

            const mappings = yield* db.query.personIdentities.findMany({
              where: { personId, projectId },
            });
            if (mappings.length === 0) {
              return undefined;
            }

            const sortedMappings = [...mappings].sort((left, right) => {
              if (left.kind !== right.kind) {
                return right.kind - left.kind;
              }

              const leftUpdatedAt = left.updatedAt?.getTime() ?? 0;
              const rightUpdatedAt = right.updatedAt?.getTime() ?? 0;
              if (leftUpdatedAt !== rightUpdatedAt) {
                return rightUpdatedAt - leftUpdatedAt;
              }

              const leftCreatedAt = left.createdAt?.getTime() ?? 0;
              const rightCreatedAt = right.createdAt?.getTime() ?? 0;
              if (leftCreatedAt !== rightCreatedAt) {
                return rightCreatedAt - leftCreatedAt;
              }

              return left.distinctId.localeCompare(right.distinctId);
            });

            return sortedMappings[0]?.distinctId;
          }),
      );

      const toPersonEvent = Effect.fn("toPersonEvent")(
        (
          db: DbTransaction,
          {
            person,
          }: {
            readonly person: DbPerson;
          },
        ): Effect.Effect<PersonSnapshotEventV1, DbError> =>
          Effect.gen(function* () {
            yield* Effect.annotateCurrentSpan("voidhash.project.id", person.projectId);
            yield* Effect.annotateCurrentSpan("voidhash.person.id", person.id);

            const primaryDistinctId = yield* selectPrimaryDistinctId(db, {
              personId: person.id,
              projectId: person.projectId,
            });
            if (primaryDistinctId) {
              yield* Effect.annotateCurrentSpan("voidhash.person.distinct_id", primaryDistinctId);
            }

            return {
              changedAt:
                person.updatedAt?.toISOString() ??
                person.createdAt?.toISOString() ??
                new Date().toISOString(),
              personId: person.id,
              ...(person.email ? { email: person.email } : {}),
              isArchived: person.archivedAt !== null,
              ...(person.mergedIntoPersonId
                ? { mergedIntoPersonId: person.mergedIntoPersonId }
                : {}),
              ...(person.name ? { name: person.name } : {}),
              ...(primaryDistinctId ? { primaryDistinctId } : {}),
              projectId: person.projectId,
              schemaVersion: 1,
              traits: (person.traits ?? {}) as Record<string, unknown>,
              version: toPersonVersion(person),
            };
          }),
      );

      const ensureCanonicalPersonForDistinctId = Effect.fn("ensureCanonicalPersonForDistinctId")(
        (
          db: DbTransaction,
          {
            context,
            distinctId,
            email,
            name,
            setAttributes,
            setOnceAttributes,
          }: {
            readonly context: MutationContext;
            readonly distinctId: string;
            readonly email?: string;
            readonly name?: string;
            readonly setAttributes: Record<string, unknown>;
            readonly setOnceAttributes: Record<string, unknown>;
          },
        ): Effect.Effect<CanonicalPersonResolution, DbError> =>
          Effect.gen(function* () {
            yield* Effect.annotateCurrentSpan("voidhash.project.id", context.projectId);
            yield* Effect.annotateCurrentSpan("voidhash.person.distinct_id", distinctId);

            // Serialise concurrent resolution of the SAME (project, distinctId)
            // identity slot. `FOR UPDATE` (see lockDistinctIdRows) cannot lock a
            // row that does not exist yet, so two concurrent records for a brand
            // new distinct id would both fall through to `createPersonRow` and
            // race the `ON CONFLICT DO UPDATE` upsert, leaving two persons. A
            // transaction-scoped advisory lock keyed on the slot blocks the
            // second resolver here until the first commits; it then finds the
            // mapping below and adopts that person. Re-entrant within a
            // transaction and released at commit/rollback. The identify path
            // pre-acquires these (sorted) via lockDistinctIdRows, so acquiring
            // here is a no-op there and never reorders against that path.
            yield* db.execute(
              sql`SELECT pg_advisory_xact_lock(hashtext(${context.projectId} || ':' || ${distinctId}))`,
            );

            const mapped = yield* findDistinctIdMapping(db, {
              distinctId,
              projectId: context.projectId,
            });
            if (mapped) {
              yield* Effect.annotateCurrentSpan("voidhash.identity.was_created", false);
              yield* Effect.annotateCurrentSpan("voidhash.person.id", mapped.canonicalPerson.id);

              return {
                person: mapped.canonicalPerson,
                rawMapping: mapped.mapping,
                wasCreated: false,
              };
            }

            const person = yield* createPersonRow(db, {
              context,
              email,
              name,
              setAttributes,
              setOnceAttributes,
            });
            yield* Effect.annotateCurrentSpan("voidhash.identity.was_created", true);
            yield* Effect.annotateCurrentSpan("voidhash.person.id", person.id);
            yield* Effect.annotateCurrentSpan("voidhash.person.origin", context.origin);

            const mappingEvent = yield* upsertPersonIdentity(db, {
              changedAt: context.eventTimestamp,
              personId: person.id,
              distinctId,
              identityId: generateId("personDistinctId"),
              projectId: context.projectId,
              version: 0,
            });

            return {
              person,
              mappingEvent,
              wasCreated: true,
            };
          }),
      );

      const lockDistinctIdRows = Effect.fn("lockDistinctIdRows")(
        (
          db: DbTransaction,
          {
            distinctIds,
            projectId,
          }: {
            readonly distinctIds: ReadonlyArray<string>;
            readonly projectId: string;
          },
        ) =>
          Effect.gen(function* () {
            yield* Effect.annotateCurrentSpan("voidhash.project.id", projectId);

            const orderedDistinctIds = [...new Set(distinctIds)].sort((left, right) =>
              left.localeCompare(right),
            );

            for (const distinctId of orderedDistinctIds) {
              // Acquire the per-slot advisory lock FIRST, in the same sorted
              // order as the loop, so a multi-distinct-id transaction (identify)
              // can never deadlock against another acquiring the slots in the
              // opposite order. This also serialises the create-new-person path
              // that `FOR UPDATE` cannot (no row to lock yet); the matching
              // acquisition in ensureCanonicalPersonForDistinctId is then a
              // re-entrant no-op.
              yield* db.execute(
                sql`SELECT pg_advisory_xact_lock(hashtext(${projectId} || ':' || ${distinctId}))`,
              );
              yield* db.execute(sql`
                SELECT distinct_id
                FROM person_identity
                WHERE project_id = ${projectId} AND distinct_id = ${distinctId}
                FOR UPDATE
              `);
              yield* db.execute(sql`
                SELECT distinct_id
                FROM person_personless_identity
                WHERE project_id = ${projectId} AND distinct_id = ${distinctId}
                FOR UPDATE
              `);
            }
          }),
      );

      const lockPersonRows = Effect.fn("lockPersonRows")(
        (
          db: DbTransaction,
          {
            personIds,
          }: {
            readonly personIds: ReadonlyArray<string>;
          },
        ) =>
          Effect.gen(function* () {
            const orderedPersonIds = [...new Set(personIds)].sort((left, right) =>
              left.localeCompare(right),
            );

            for (const personId of orderedPersonIds) {
              yield* db.execute(sql`
                SELECT id
                FROM person
                WHERE id = ${personId}
                FOR UPDATE
              `);
            }
          }),
      );

      /**
       * Lists every `(distinctId, id, version)` currently mapped to a person.
       * Used by the merge to repoint the *whole* loser cluster onto the survivor
       * so the analytics overrides stay canonical (and the squash converges in a
       * single pass) rather than only the one distinct id named by the identify.
       */
      const listMappedDistinctIds = Effect.fn("listMappedDistinctIds")(
        (
          db: DbTransaction,
          {
            personId,
            projectId,
          }: {
            readonly personId: string;
            readonly projectId: string;
          },
        ): Effect.Effect<
          ReadonlyArray<{
            readonly id: string;
            readonly distinctId: string;
            readonly version: number;
          }>,
          DbError
        > =>
          Effect.gen(function* () {
            const rows = yield* db.query.personIdentities.findMany({
              where: { projectId, personId },
            });
            return rows.map((row) => ({
              distinctId: row.distinctId,
              id: row.id,
              version: row.version,
            }));
          }),
      );

      /**
       * Appends one immutable {@link identityAssertions} row recording that two
       * distinct ids name the same person — the source of truth for the
       * order-agnostic projection. The pair is stored canonically sorted so an
       * unordered edge has a single representation, and the insert is idempotent
       * on `(projectId, dedupKey)` so a retried identify logs exactly once.
       */
      const appendAssertion = Effect.fn("appendIdentityAssertion")(
        (
          db: DbTransaction,
          {
            distinctId,
            previousDistinctId,
            projectId,
            eventTimestamp,
            dedupKey,
            source,
          }: {
            readonly distinctId: string;
            readonly previousDistinctId: string;
            readonly projectId: string;
            readonly eventTimestamp: Date;
            readonly dedupKey: string;
            readonly source: PersonOriginValue;
          },
        ): Effect.Effect<void, DbError> =>
          Effect.gen(function* () {
            const [distinctIdA, distinctIdB] =
              previousDistinctId <= distinctId
                ? [previousDistinctId, distinctId]
                : [distinctId, previousDistinctId];

            yield* Effect.annotateCurrentSpan("voidhash.project.id", projectId);
            yield* Effect.annotateCurrentSpan("voidhash.identity_assertion.dedup_key", dedupKey);

            yield* db
              .insert(identityAssertions)
              .values({
                dedupKey,
                distinctIdA,
                distinctIdB,
                eventTs: eventTimestamp,
                id: generateId("identityAssertion"),
                projectId,
                source,
              })
              .onConflictDoNothing({
                target: [identityAssertions.projectId, identityAssertions.dedupKey],
              });
          }),
      );

      return {
        appendAssertion,
        archivePerson,
        ensureCanonicalPersonForDistinctId,
        ensurePersonlessIdentity,
        findDistinctIdMapping,
        findPersonlessIdentity,
        listMappedDistinctIds,
        lockDistinctIdRows,
        lockPersonRows,
        markPersonlessIdentityMerged,
        toPersonEvent,
        updatePersonProfile,
        upsertAccountTokenBinding,
        upsertPersonIdentity,
      } as const;
    }),
  },
) {
  static layer = Layer.effect(IdentityMutationService)(IdentityMutationService.make);
}
