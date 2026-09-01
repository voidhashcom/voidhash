import * as Arr from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Order from "effect/Order";

import { constant } from "@voidhash/lib/lang";

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
  readonly mappingEvent: Option.Option<PersonIdentityEventV1>;
  readonly rawMapping: Option.Option<DbPersonIdentity>;
  readonly wasCreated: boolean;
}

/** Row version = last write time, falling back to `nowMillis` for a row with neither stamp. */
const toPersonVersion = (person: DbPerson, nowMillis: number): number =>
  person.updatedAt?.getTime() ?? person.createdAt?.getTime() ?? nowMillis;

const deriveIdentityKind = (distinctId: string): PersonIdentityKindValue => {
  if (isAnonymousDistinctId(distinctId)) return PersonIdentityKind.Anonymous;
  return PersonIdentityKind.Identified;
};

/** Keeps the earliest/latest of two timestamps for the first/last-seen stamps. */
const earliestOf = (current: Option.Option<Date>, candidate: Date): Date =>
  Option.match(current, {
    onNone: () => candidate,
    onSome: (value) => (value.getTime() <= candidate.getTime() ? value : candidate),
  });

const latestOf = (current: Option.Option<Date>, candidate: Date): Date =>
  Option.match(current, {
    onNone: () => candidate,
    onSome: (value) => (value.getTime() >= candidate.getTime() ? value : candidate),
  });

/**
 * Patch semantics for a nullable column: `undefined` leaves the stored value
 * untouched, `null` falls back to it, anything else overwrites.
 */
const patchNullable = <T>(next: Option.Option<T>, current: Option.Option<T>): Option.Option<T> =>
  Option.orElse(next, () => current);

/** Lexicographically ordered pair — the canonical `(distinctIdA, distinctIdB)` assertion key. */
const orderedPair = (first: string, second: string): readonly [string, string] => {
  if (first <= second) return [first, second];
  return [second, first];
};

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
  ...(previousDistinctId && { previousDistinctId }),
  isDeleted: false,
  kind,
  projectId,
  schemaVersion: 1,
  version,
});

/**
 * Person-identity write operations, each running on a caller-supplied
 * transaction handle (`tx`) so the surrounding service controls
 * commit/rollback. Consumed by {@link PersonIdentityService} for synchronous
 * resolve and identify operations. Pure projection types and trait/version
 * rules live in the `domain/person` model; this service owns only the database
 * mutations.
 */
export class IdentityMutationService extends Context.Service<IdentityMutationService>()(
  "IdentityMutationService",
  {
    make: Effect.sync(() => {
      const findPersonById = Effect.fn("findPersonById")(function* (
        db: DbTransaction,
        { personId }: { readonly personId: string },
      ) {
        yield* Effect.annotateCurrentSpan("voidhash.person.id", personId);

        return Option.fromNullishOr(
          yield* db.query.persons.findFirst({
            where: { id: personId },
          }),
        );
      });

      const resolveCanonicalPerson = Effect.fn("resolveCanonicalPerson")(function* (
        db: DbTransaction,
        {
          person,
        }: {
          readonly person: DbPerson;
        },
      ) {
        yield* Effect.annotateCurrentSpan("voidhash.person.id", person.id);
        if (person.mergedIntoPersonId) {
          yield* Effect.annotateCurrentSpan(
            "voidhash.person.merged_into_id",
            person.mergedIntoPersonId,
          );
        }

        const followMerge = (current: DbPerson): Effect.Effect<DbPerson, DbError> =>
          Option.match(Option.fromNullishOr(current.mergedIntoPersonId), {
            onNone: () => Effect.succeed(current),
            onSome: (personId) =>
              findPersonById(db, { personId }).pipe(
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.succeed(current),
                    onSome: followMerge,
                  }),
                ),
              ),
          });

        return yield* followMerge(person);
      });

      const findDistinctIdMapping = Effect.fn("findDistinctIdMapping")(function* (
        db: DbTransaction,
        {
          distinctId,
          projectId,
        }: {
          readonly distinctId: string;
          readonly projectId: string;
        },
      ) {
        yield* Effect.annotateCurrentSpan("voidhash.project.id", projectId);
        yield* Effect.annotateCurrentSpan("voidhash.person.distinct_id", distinctId);

        const mapping = yield* db.query.personIdentities.findFirst({
          where: { projectId, distinctId },
        });
        if (!mapping) {
          return Option.none<MappingResolution>();
        }

        yield* Effect.annotateCurrentSpan("voidhash.person_identity.id", mapping.id);
        yield* Effect.annotateCurrentSpan(
          "voidhash.person_identity.kind",
          deriveIdentityKind(distinctId),
        );

        const rawPerson = yield* findPersonById(db, {
          personId: mapping.personId,
        });
        if (Option.isNone(rawPerson)) {
          return Option.none<MappingResolution>();
        }

        const canonicalPerson = yield* resolveCanonicalPerson(db, {
          person: rawPerson.value,
        });
        yield* Effect.annotateCurrentSpan("voidhash.person.id", canonicalPerson.id);

        return Option.some({
          canonicalPerson,
          mapping,
          rawPerson: rawPerson.value,
        });
      });

      const findPersonlessIdentity = Effect.fn("findPersonlessIdentity")(function* (
        db: DbTransaction,
        {
          distinctId,
          projectId,
        }: {
          readonly distinctId: string;
          readonly projectId: string;
        },
      ) {
        yield* Effect.annotateCurrentSpan("voidhash.project.id", projectId);
        yield* Effect.annotateCurrentSpan("voidhash.person.distinct_id", distinctId);

        return Option.fromNullishOr(
          yield* db.query.personPersonlessIdentities.findFirst({
            where: { projectId, distinctId },
          }),
        );
      });

      const ensurePersonlessIdentity = Effect.fn("ensurePersonlessIdentity")(function* (
        db: DbTransaction,
        {
          distinctId,
          projectId,
        }: {
          readonly distinctId: string;
          readonly projectId: string;
        },
      ) {
        yield* Effect.annotateCurrentSpan("voidhash.project.id", projectId);
        yield* Effect.annotateCurrentSpan("voidhash.person.distinct_id", distinctId);

        yield* db.execute(sql`
              INSERT INTO person_personless_identity
                (project_id, distinct_id, is_merged, created_at, updated_at)
              VALUES
                (${projectId}, ${distinctId}, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              ON CONFLICT (project_id, distinct_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
            `);
      });

      const markPersonlessIdentityMerged = Effect.fn("markPersonlessIdentityMerged")(function* (
        db: DbTransaction,
        {
          distinctId,
          projectId,
        }: {
          readonly distinctId: string;
          readonly projectId: string;
        },
      ) {
        yield* Effect.annotateCurrentSpan("voidhash.project.id", projectId);
        yield* Effect.annotateCurrentSpan("voidhash.person.distinct_id", distinctId);

        yield* db.execute(sql`
              UPDATE person_personless_identity
              SET is_merged = true, updated_at = CURRENT_TIMESTAMP
              WHERE project_id = ${projectId} AND distinct_id = ${distinctId}
            `);
      });

      const createPersonRow = Effect.fn("createPersonRow")(function* (
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
      ) {
        const folded = applyTraitWrite(
          { meta: {}, traits: {} },
          {
            eventId: context.eventId,
            eventTs: context.eventTimestamp.getTime(),
            set: setAttributes,
            setOnce: setOnceAttributes,
          },
        );
        const person: DbPerson = {
          archivedAt: null,
          createdAt: context.eventTimestamp,
          deletedAt: null,
          deletionReason: null,
          email: email ?? null,
          firstSeenAt: context.eventTimestamp,
          id: generateId("person"),
          lastSeenAt: context.eventTimestamp,
          mergedIntoPersonId: null,
          name: name ?? null,
          origin: context.origin,
          primaryDistinctId: null,
          projectId: context.projectId,
          traits: folded.traits,
          traitsMeta: folded.meta,
          updatedAt: context.eventTimestamp,
        };

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
      });

      const updatePersonProfile = Effect.fn("updatePersonProfile")(function* (
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
          readonly email: Option.Option<string>;
          readonly eventId: string;
          readonly eventTimestamp: Date;
          /**
           * When present, the source person whose trait state is merged into
           * `person` via per-key LWW before applying this event's writes.
           * Used by the identify merge so the surviving person inherits the
           * other side's traits deterministically.
           */
          readonly mergeTraitsFrom: Option.Option<DbPerson>;
          readonly name: Option.Option<string>;
          readonly setAttributes: Record<string, unknown>;
          readonly setOnceAttributes: Record<string, unknown>;
        },
      ) {
        yield* Effect.annotateCurrentSpan("voidhash.project.id", person.projectId);
        yield* Effect.annotateCurrentSpan("voidhash.person.id", person.id);

        const nextFirstSeen = earliestOf(Option.fromNullishOr(person.firstSeenAt), eventTimestamp);
        const nextLastSeen = latestOf(Option.fromNullishOr(person.lastSeenAt), eventTimestamp);

        // Per-key LWW: combine the other person's state (on merge), then
        // fold this event's writes. Order-independent, so out-of-order
        // events can't regress a newer trait value.
        const targetState = materializeTraitState(
          Option.fromNullishOr(person.traits),
          Option.fromNullishOr(person.traitsMeta),
        );
        const baseState: TraitFoldState = Option.match(mergeTraitsFrom, {
          onNone: () => targetState,
          onSome: (source) =>
            combineTraitStates(
              targetState,
              materializeTraitState(
                Option.fromNullishOr(source.traits),
                Option.fromNullishOr(source.traitsMeta),
              ),
            ),
        });
        const folded = applyTraitWrite(baseState, {
          eventId,
          eventTs: eventTimestamp.getTime(),
          set: setAttributes,
          setOnce: setOnceAttributes,
        });

        const nextEmail = patchNullable(email, Option.fromNullishOr(person.email));
        const nextName = patchNullable(name, Option.fromNullishOr(person.name));

        yield* db
          .update(persons)
          .set({
            email: Option.getOrNull(nextEmail),
            firstSeenAt: nextFirstSeen,
            lastSeenAt: nextLastSeen,
            name: Option.getOrNull(nextName),
            traits: folded.traits,
            traitsMeta: folded.meta,
          })
          .where(eq(persons.id, person.id));

        return {
          ...person,
          email: Option.getOrNull(nextEmail),
          firstSeenAt: nextFirstSeen,
          lastSeenAt: nextLastSeen,
          name: Option.getOrNull(nextName),
          traits: folded.traits,
          traitsMeta: folded.meta,
          updatedAt: eventTimestamp,
        };
      });

      const archivePerson = Effect.fn("archivePerson")(function* (
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
      ) {
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
      });

      const upsertPersonIdentity = Effect.fn("upsertPersonIdentity")(function* (
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
      ) {
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
      });

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
       * exactly what a synchronous identify merge needs.
       */
      const upsertAccountTokenBinding = Effect.fn("upsertAccountTokenBinding")(function* (
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
      ) {
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
      });

      const selectPrimaryDistinctId = Effect.fn("selectPrimaryDistinctId")(function* (
        db: DbTransaction,
        {
          personId,
          projectId,
        }: {
          readonly personId: string;
          readonly projectId: string;
        },
      ) {
        yield* Effect.annotateCurrentSpan("voidhash.project.id", projectId);
        yield* Effect.annotateCurrentSpan("voidhash.person.id", personId);

        const mappings = yield* db.query.personIdentities.findMany({
          where: { personId, projectId },
        });
        if (Arr.isReadonlyArrayEmpty(mappings)) {
          return Option.none<string>();
        }

        const sortedMappings = Arr.sort(
          mappings,
          Order.make((left: DbPersonIdentity, right: DbPersonIdentity) => {
            if (left.kind !== right.kind) {
              return left.kind > right.kind ? -1 : 1;
            }

            const leftUpdatedAt = left.updatedAt?.getTime() ?? 0;
            const rightUpdatedAt = right.updatedAt?.getTime() ?? 0;
            if (leftUpdatedAt !== rightUpdatedAt) {
              return leftUpdatedAt > rightUpdatedAt ? -1 : 1;
            }

            const leftCreatedAt = left.createdAt?.getTime() ?? 0;
            const rightCreatedAt = right.createdAt?.getTime() ?? 0;
            if (leftCreatedAt !== rightCreatedAt) {
              return leftCreatedAt > rightCreatedAt ? -1 : 1;
            }

            if (left.distinctId < right.distinctId) return -1;
            if (left.distinctId > right.distinctId) return 1;
            return 0;
          }),
        );

        return Option.map(Arr.head(sortedMappings), (mapping) => mapping.distinctId);
      });

      const toPersonEvent = Effect.fn("toPersonEvent")(function* (
        db: DbTransaction,
        {
          person,
        }: {
          readonly person: DbPerson;
        },
      ) {
        yield* Effect.annotateCurrentSpan("voidhash.project.id", person.projectId);
        yield* Effect.annotateCurrentSpan("voidhash.person.id", person.id);

        const primaryDistinctId = yield* selectPrimaryDistinctId(db, {
          personId: person.id,
          projectId: person.projectId,
        });
        if (Option.isSome(primaryDistinctId)) {
          yield* Effect.annotateCurrentSpan("voidhash.person.distinct_id", primaryDistinctId.value);
        }

        const now = yield* DateTime.nowAsDate;
        return {
          changedAt:
            person.updatedAt?.toISOString() ?? person.createdAt?.toISOString() ?? now.toISOString(),
          personId: person.id,
          ...(person.email && { email: person.email }),
          isArchived: person.archivedAt !== null,
          ...(person.mergedIntoPersonId && {
            mergedIntoPersonId: person.mergedIntoPersonId,
          }),
          ...(person.name && { name: person.name }),
          ...Option.match(primaryDistinctId, {
            onNone: () => ({}),
            onSome: (value) => ({ primaryDistinctId: value }),
          }),
          projectId: person.projectId,
          schemaVersion: 1,
          traits: person.traits ?? {},
          version: toPersonVersion(person, now.getTime()),
        } satisfies PersonSnapshotEventV1;
      });

      const ensureCanonicalPersonForDistinctId = Effect.fn("ensureCanonicalPersonForDistinctId")(
        function* (
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
        ) {
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
          if (Option.isSome(mapped)) {
            yield* Effect.annotateCurrentSpan("voidhash.identity.was_created", false);
            yield* Effect.annotateCurrentSpan(
              "voidhash.person.id",
              mapped.value.canonicalPerson.id,
            );

            return {
              mappingEvent: Option.none(),
              person: mapped.value.canonicalPerson,
              rawMapping: Option.some(mapped.value.mapping),
              wasCreated: false,
            } satisfies CanonicalPersonResolution;
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
            mappingEvent: Option.some(mappingEvent),
            person,
            rawMapping: Option.none(),
            wasCreated: true,
          } satisfies CanonicalPersonResolution;
        },
      );

      const lockDistinctIdRows = Effect.fn("lockDistinctIdRows")(function* (
        db: DbTransaction,
        {
          distinctIds,
          projectId,
        }: {
          readonly distinctIds: ReadonlyArray<string>;
          readonly projectId: string;
        },
      ) {
        yield* Effect.annotateCurrentSpan("voidhash.project.id", projectId);

        const orderedDistinctIds = Arr.sort(
          Arr.fromIterable(HashSet.fromIterable(distinctIds)),
          Order.String,
        );

        yield* Effect.forEach(
          orderedDistinctIds,
          Effect.fn("lockDistinctIdRows.lock")(function* (distinctId) {
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
          }),
          { concurrency: 1, discard: true },
        );
      });

      const lockPersonRows = Effect.fn("lockPersonRows")(function* (
        db: DbTransaction,
        {
          personIds,
        }: {
          readonly personIds: ReadonlyArray<string>;
        },
      ) {
        const orderedPersonIds = Arr.sort(
          Arr.fromIterable(HashSet.fromIterable(personIds)),
          Order.String,
        );

        yield* Effect.forEach(
          orderedPersonIds,
          (personId) =>
            db.execute(sql`
                SELECT id
                FROM person
                WHERE id = ${personId}
                FOR UPDATE
              `),
          { concurrency: 1, discard: true },
        );
      });

      /**
       * Lists every `(distinctId, id, version)` currently mapped to a person.
       * Used by the merge to repoint the *whole* loser cluster onto the survivor
       * so the analytics overrides stay canonical (and the squash converges in a
       * single pass) rather than only the one distinct id named by the identify.
       */
      const listMappedDistinctIds = Effect.fn("listMappedDistinctIds")(function* (
        db: DbTransaction,
        {
          personId,
          projectId,
        }: {
          readonly personId: string;
          readonly projectId: string;
        },
      ) {
        const rows = yield* db.query.personIdentities.findMany({
          where: { projectId, personId },
        });
        return Arr.map(rows, (row) => ({
          distinctId: row.distinctId,
          id: row.id,
          version: row.version,
        }));
      });

      /**
       * Appends one immutable {@link identityAssertions} row recording that two
       * distinct ids name the same person — the source of truth for the
       * order-agnostic projection. The pair is stored canonically sorted so an
       * unordered edge has a single representation, and the insert is idempotent
       * on `(projectId, dedupKey)` so a retried identify logs exactly once.
       */
      const appendAssertion = Effect.fn("appendIdentityAssertion")(function* (
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
      ) {
        const [distinctIdA, distinctIdB] = orderedPair(previousDistinctId, distinctId);

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
      });

      return constant({
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
      });
    }),
  },
) {
  static layer = Layer.effect(IdentityMutationService)(IdentityMutationService.make);
}
