import * as Arr from "effect/Array";
import { constant } from "@voidhash/lib/lang";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Order from "effect/Order";
import * as Schema from "effect/Schema";

import { ActionForbiddenError, type AnyAuthSession, AuthSession } from "../../domain/auth/Auth.ts";
import {
  type Person as DomainPerson,
  Person,
  PersonIdentity,
  type PersonIdentityKindValue,
  PersonNotFoundError,
  type PersonProfile,
} from "../../domain/person/Person.ts";
import {
  type Person as DbPerson,
  type PersonIdentity as DbPersonIdentity,
  Db,
  type DbError,
  type PersonOriginValue,
  and,
  desc,
  eq,
  isNull,
  persons,
  sql,
} from "@voidhash/db";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../../utils/pagination.ts";
import { checkProjectPermission } from "../../utils/permissions.ts";
import { unexpectedError } from "../../effect-boundary.ts";
import { PersonIdentityService } from "../personIdentity/PersonIdentityService.ts";

/**
 * Catch-all service error. Wraps `DbError` (and other infrastructural
 * failures) at the public-method boundary so callers see one stable error tag.
 */
export class PersonServiceError extends Schema.TaggedErrorClass<PersonServiceError>(
  "PersonServiceError",
)("PersonServiceError", { cause: Schema.String }) {}

/** `person_identity.kind` is a plain smallint column mirroring `PersonIdentityKind`. */
const asPersonIdentityKind = (kind: any): PersonIdentityKindValue => kind;

/**
 * Builds the {@link DomainPerson} aggregate from raw DB rows. Kept private to
 * the service per the "Drizzle-first with Schema at boundaries" convention —
 * the only Schema.Class with mapping logic is `Person`, and its mapping lives
 * with its single consumer.
 */
const buildPerson = (row: DbPerson, identities: ReadonlyArray<DbPersonIdentity>): DomainPerson =>
  new Person({
    id: row.id,
    projectId: row.projectId,
    email: row.email ?? null,
    name: row.name ?? null,
    archivedAt: row.archivedAt ?? null,
    createdAt: row.createdAt ?? null,
    mergedIntoPersonId: row.mergedIntoPersonId ?? null,
    identities: Arr.map(
      identities,
      (identity) =>
        new PersonIdentity({
          id: identity.id,
          distinctId: identity.distinctId,
          personId: identity.personId,
          projectId: identity.projectId,
          kind: asPersonIdentityKind(identity.kind),
          version: identity.version,
          createdAt: identity.createdAt ?? null,
          updatedAt: identity.updatedAt ?? null,
        }),
    ),
  });

/**
 * `PersonService` exposes the persons aggregate for the dashboard / admin
 * surface. Mutating identity goes through {@link PersonIdentityService} —
 * `createPerson` and `setPersonAttributes` are thin wrappers that call
 * `resolveDistinctId` with `shouldCreatePerson: true` and reload the canonical
 * profile.
 */
export class PersonService extends Context.Service<PersonService>()("PersonService", {
  make: Effect.gen(function* () {
    const personIdentityService = yield* PersonIdentityService;
    const db = yield* Db;

    const findCanonicalPersonById = Effect.fn("findCanonicalPersonById")(function* (
      personId: string,
    ) {
      const initial = Option.fromNullishOr(
        yield* db.query.persons.findFirst({
          where: { id: personId },
        }),
      );
      const followMerge = (current: DbPerson): Effect.Effect<Option.Option<DbPerson>, DbError> =>
        Option.match(Option.fromNullishOr(current.mergedIntoPersonId), {
          onNone: () => Effect.succeed(Option.some(current)),
          onSome: (id) =>
            db.query.persons.findFirst({ where: { id } }).pipe(
              Effect.flatMap((person) =>
                Option.match(Option.fromNullishOr(person), {
                  onNone: () => Effect.succeed(Option.some(current)),
                  onSome: followMerge,
                }),
              ),
            ),
        });
      return yield* Option.match(initial, {
        onNone: () => Effect.succeed(Option.none<DbPerson>()),
        onSome: followMerge,
      });
    });

    /**
     * Resolves a raw person row to its public {@link PersonProfile}. Returns
     * `None` when the person has no identities to surface.
     */
    const loadProfileRaw = Effect.fn("loadProfileRaw")(function* (personId: string) {
      yield* Effect.annotateCurrentSpan("voidhash.person.id", personId);
      const dbPerson = yield* findCanonicalPersonById(personId);
      if (Option.isNone(dbPerson)) {
        return Option.none<PersonProfile>();
      }
      yield* Effect.annotateCurrentSpan("voidhash.project.id", dbPerson.value.projectId);
      if (dbPerson.value.mergedIntoPersonId) {
        yield* Effect.annotateCurrentSpan(
          "voidhash.person.merged_into_id",
          dbPerson.value.mergedIntoPersonId,
        );
      }
      const identities = yield* db.query.personIdentities.findMany({
        where: { personId: dbPerson.value.id, projectId: dbPerson.value.projectId },
      });
      yield* Effect.annotateCurrentSpan("voidhash.person.identity_count", identities.length);
      return buildPerson(dbPerson.value, identities).toProfile();
    });

    const getPersonById = Effect.fn("getPersonById")(
      function* (personId: string) {
        yield* Effect.annotateCurrentSpan("voidhash.person.id", personId);
        const session = yield* AuthSession;
        yield* annotateSessionIdentity(Option.fromNullishOr(session));
        const dbPerson = yield* findCanonicalPersonById(personId);
        if (Option.isNone(dbPerson)) {
          return yield* Effect.fail(new PersonNotFoundError({ id: personId }));
        }
        yield* Effect.annotateCurrentSpan("voidhash.project.id", dbPerson.value.projectId);
        if (dbPerson.value.mergedIntoPersonId) {
          yield* Effect.annotateCurrentSpan(
            "voidhash.person.merged_into_id",
            dbPerson.value.mergedIntoPersonId,
          );
        }

        yield* checkProjectPermission(
          dbPerson.value.projectId,
          "project:all",
          `User ${session?.user?.id} is not authorized to access person ${personId} for project ${dbPerson.value.projectId}`,
        );

        const identities = yield* db.query.personIdentities.findMany({
          where: { personId: dbPerson.value.id, projectId: dbPerson.value.projectId },
        });
        yield* Effect.annotateCurrentSpan("voidhash.person.identity_count", identities.length);
        const profile = buildPerson(dbPerson.value, identities).toProfile();
        if (Option.isNone(profile)) {
          return yield* Effect.fail(new PersonNotFoundError({ id: personId }));
        }
        return profile.value;
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new PersonServiceError({ cause: String(error.cause) })),
          }),
        ),
    );

    const getPersonByDistinctId = Effect.fn("getPersonByDistinctId")(
      function* (distinctId: string, projectId: string) {
        yield* Effect.annotateCurrentSpan("voidhash.person.distinct_id", distinctId);
        yield* Effect.annotateCurrentSpan("voidhash.project.id", projectId);
        const session = yield* AuthSession;
        yield* annotateSessionIdentity(Option.fromNullishOr(session));
        const mapping = yield* db.query.personIdentities.findFirst({
          where: { distinctId, projectId },
        });
        if (!mapping) {
          return yield* Effect.fail(new PersonNotFoundError({ id: distinctId }));
        }

        const dbPerson = yield* findCanonicalPersonById(mapping.personId);
        if (Option.isNone(dbPerson)) {
          return yield* Effect.fail(new PersonNotFoundError({ id: distinctId }));
        }
        yield* Effect.annotateCurrentSpan("voidhash.person.id", dbPerson.value.id);
        if (dbPerson.value.mergedIntoPersonId) {
          yield* Effect.annotateCurrentSpan(
            "voidhash.person.merged_into_id",
            dbPerson.value.mergedIntoPersonId,
          );
        }

        yield* checkProjectPermission(
          dbPerson.value.projectId,
          "project:all",
          `User ${session?.user?.id} is not authorized to access person ${distinctId} for project ${dbPerson.value.projectId}`,
        );

        const identities = yield* db.query.personIdentities.findMany({
          where: { personId: dbPerson.value.id, projectId: dbPerson.value.projectId },
        });
        yield* Effect.annotateCurrentSpan("voidhash.person.identity_count", identities.length);
        const profile = buildPerson(dbPerson.value, identities).toProfile();
        if (Option.isNone(profile)) {
          return yield* Effect.fail(new PersonNotFoundError({ id: distinctId }));
        }
        return profile.value;
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new PersonServiceError({ cause: String(error.cause) })),
          }),
        ),
    );

    const getPersons = Effect.fn("getPersons")(
      function* (input: { readonly projectId: string }) {
        yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
        const session = yield* AuthSession;
        yield* annotateSessionIdentity(Option.fromNullishOr(session));
        yield* checkProjectPermission(
          input.projectId,
          "project:all",
          `User ${session?.user?.id} is not authorized to access persons for project ${input.projectId}`,
        );

        const personRows = yield* db.query.persons.findMany({
          where: {
            projectId: input.projectId,
            archivedAt: { isNull: true },
            deletedAt: { isNull: true },
            mergedIntoPersonId: { isNull: true },
          },
          orderBy: { createdAt: "desc" },
        });
        const profiles = yield* Effect.all(
          personRows.map((person) => loadProfileRaw(person.id)),
          { concurrency: 1 },
        );
        const activeProfiles = Arr.flatMap(profiles, Arr.fromOption);
        const deduped = Arr.reduce(
          activeProfiles,
          HashMap.empty<string, PersonProfile>(),
          (profilesById, profile) => HashMap.set(profilesById, profile.personId, profile),
        );
        const result = Arr.sort(
          Arr.fromIterable(HashMap.values(deduped)),
          Order.make((left: PersonProfile, right: PersonProfile) => {
            const leftCreatedAt = getCreatedAtTime(left);
            const rightCreatedAt = getCreatedAtTime(right);
            if (leftCreatedAt === rightCreatedAt) return 0;
            return leftCreatedAt > rightCreatedAt ? -1 : 1;
          }),
        );
        yield* Effect.annotateCurrentSpan("voidhash.person.result_count", result.length);
        return result;
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new PersonServiceError({ cause: String(error.cause) })),
          }),
        ),
    );

    /**
     * Loads the identities for one page of person rows in a single query,
     * grouped by person id, so paging does not fan out into per-row reads.
     */
    const loadIdentitiesFor = Effect.fn("loadIdentitiesFor")(function* (
      projectId: string,
      rows: ReadonlyArray<DbPerson>,
    ) {
      if (Arr.isReadonlyArrayEmpty(rows)) {
        return HashMap.empty<string, ReadonlyArray<DbPersonIdentity>>();
      }
      const identities = yield* db.query.personIdentities.findMany({
        where: { projectId, personId: { in: Arr.map(rows, (row) => row.id) } },
      });
      return Arr.reduce(
        identities,
        HashMap.empty<string, ReadonlyArray<DbPersonIdentity>>(),
        (grouped, identity) =>
          HashMap.modifyAt(grouped, identity.personId, (existing) =>
            Option.some([...Option.getOrElse(existing, () => []), identity]),
          ),
      );
    });

    const getPersonsPage = Effect.fn("getPersonsPage")(
      function* (input: {
        readonly projectId: string;
        readonly after?: string;
        readonly email?: string;
        readonly limit?: number;
      }) {
        yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
        const session = yield* AuthSession;
        yield* annotateSessionIdentity(Option.fromNullishOr(session));
        yield* checkProjectPermission(
          input.projectId,
          "project:all",
          `User ${session?.user?.id} is not authorized to access persons for project ${input.projectId}`,
        );

        const limit = Math.min(input.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
        const conditions = [
          eq(persons.projectId, input.projectId),
          isNull(persons.archivedAt),
          isNull(persons.deletedAt),
          isNull(persons.mergedIntoPersonId),
        ];
        if (input.email !== undefined) {
          conditions.push(sql`lower(${persons.email}) = ${input.email.toLowerCase()}`);
        }

        if (input.after !== undefined) {
          const anchorRows = yield* db
            .select({ createdAt: persons.createdAt, id: persons.id })
            .from(persons)
            .where(and(eq(persons.projectId, input.projectId), eq(persons.id, input.after)))
            .limit(1);
          const cursorRow = anchorRows[0];
          // The cursor names a row that is no longer visible; replaying page
          // one would look like a scroll that never terminates.
          if (cursorRow === undefined) {
            return yield* Effect.fail(
              new ActionForbiddenError({
                message: "Pagination cursor no longer refers to a known item.",
              }),
            );
          }
          // `created_at` is nullable, so both sides are coalesced to the epoch
          // to keep the sort total and the row-value comparison well defined.
          conditions.push(
            sql`(coalesce(${persons.createdAt}, ${EPOCH}), ${persons.id}) < (coalesce(${cursorRow.createdAt}::timestamptz, ${EPOCH}), ${cursorRow.id}::text)`,
          );
        }

        // One row beyond the page answers `hasNextPage` without a COUNT.
        const rows = yield* db
          .select()
          .from(persons)
          .where(and(...conditions))
          .orderBy(sql`coalesce(${persons.createdAt}, ${EPOCH}) desc`, desc(persons.id))
          .limit(limit + 1);

        const hasNextPage = rows.length > limit;
        const pageRows = rows.slice(0, limit);
        const identitiesByPerson = yield* loadIdentitiesFor(input.projectId, pageRows);
        const profiles = Arr.flatMap(pageRows, (row) =>
          Arr.fromOption(
            buildPerson(
              row,
              Option.getOrElse(HashMap.get(identitiesByPerson, row.id), () => []),
            ).toProfile(),
          ),
        );

        // The cursor is the last *row* of the page, not the last profile: a row
        // whose identities were filtered out is still a valid keyset anchor.
        const endCursorId = hasNextPage
          ? Option.map(Arr.last(pageRows), (row) => row.id)
          : Option.none<string>();

        yield* Effect.annotateCurrentSpan("voidhash.person.result_count", profiles.length);
        return { endCursorId, hasNextPage, profiles };
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new PersonServiceError({ cause: String(error.cause) })),
          }),
        ),
    );

    const createPerson = Effect.fn("createPerson")(
      function* (input: {
        readonly projectId: string;
        readonly distinctId: string;
        readonly name: Option.Option<string>;
        readonly email: Option.Option<string>;
        readonly origin: PersonOriginValue;
      }) {
        yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
        yield* Effect.annotateCurrentSpan("voidhash.person.distinct_id", input.distinctId);
        yield* Effect.annotateCurrentSpan("voidhash.person.origin", input.origin);
        const eventTimestamp = yield* DateTime.nowAsDate;
        const result = yield* personIdentityService.resolveDistinctId({
          distinctId: input.distinctId,
          email: Option.getOrUndefined(input.email),
          eventTimestamp,
          name: Option.getOrUndefined(input.name),
          origin: input.origin,
          projectId: input.projectId,
          setAttributes: {},
          setOnceAttributes: {},
          shouldCreatePerson: true,
        });

        if (!result.identity.personId) {
          return yield* Effect.die(
            unexpectedError("resolveDistinctId created a person without a personId"),
          );
        }

        const dbPerson = yield* findCanonicalPersonById(result.identity.personId);
        if (Option.isNone(dbPerson)) {
          return yield* Effect.die(unexpectedError("Created person could not be loaded by id"));
        }
        yield* Effect.annotateCurrentSpan("voidhash.person.id", dbPerson.value.id);
        if (dbPerson.value.mergedIntoPersonId) {
          yield* Effect.annotateCurrentSpan(
            "voidhash.person.merged_into_id",
            dbPerson.value.mergedIntoPersonId,
          );
        }

        const identities = yield* db.query.personIdentities.findMany({
          where: { personId: dbPerson.value.id, projectId: dbPerson.value.projectId },
        });
        yield* Effect.annotateCurrentSpan("voidhash.person.identity_count", identities.length);
        const profile = buildPerson(dbPerson.value, identities).toProfile();
        if (Option.isNone(profile)) {
          return yield* Effect.die(
            unexpectedError("Created person could not be resolved to a profile"),
          );
        }
        const resolvedProfile = profile.value;

        yield* Effect.log(
          `Created person ${resolvedProfile.personId} for distinct id ${resolvedProfile.distinctId}`,
        );
        return resolvedProfile;
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            PersonServiceError: (error) =>
              Effect.fail(new PersonServiceError({ cause: String(error.cause) })),
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new PersonServiceError({ cause: String(error.cause) })),
          }),
        ),
    );

    const setPersonAttributes = Effect.fn("setPersonAttributes")(
      function* (input: {
        readonly projectId: string;
        readonly distinctId: string;
        readonly name?: string;
        readonly email?: string;
        readonly traits?: Readonly<Record<string, Schema.Json>>;
        readonly setOnce?: Readonly<Record<string, Schema.Json>>;
        readonly origin: PersonOriginValue;
      }) {
        yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
        yield* Effect.annotateCurrentSpan("voidhash.person.distinct_id", input.distinctId);
        yield* Effect.annotateCurrentSpan("voidhash.person.origin", input.origin);

        const eventTimestamp = yield* DateTime.nowAsDate;
        const result = yield* personIdentityService.resolveDistinctId({
          distinctId: input.distinctId,
          email: input.email,
          eventTimestamp,
          name: input.name,
          origin: input.origin,
          projectId: input.projectId,
          setAttributes: input.traits ?? {},
          setOnceAttributes: input.setOnce ?? {},
          // A backend writes attributes for people it already knows about, so
          // an unseen distinct id is a first write rather than an error — same
          // as `createPerson`.
          shouldCreatePerson: true,
        });

        if (!result.identity.personId) {
          return yield* Effect.die(
            unexpectedError("resolveDistinctId resolved without a personId"),
          );
        }

        const profile = yield* loadProfileRaw(result.identity.personId);
        if (Option.isNone(profile)) {
          return yield* Effect.die(
            unexpectedError("Person could not be resolved to a profile after an attribute write"),
          );
        }
        return profile.value;
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            PersonServiceError: (error) =>
              Effect.fail(new PersonServiceError({ cause: String(error.cause) })),
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new PersonServiceError({ cause: String(error.cause) })),
          }),
        ),
    );

    const mergePersons = Effect.fn("mergePersons")(
      function* (fromPersonId: string, toPersonId: string) {
        yield* Effect.annotateCurrentSpan("voidhash.person.source_id", fromPersonId);
        yield* Effect.annotateCurrentSpan("voidhash.person.target_id", toPersonId);
        yield* Effect.annotateCurrentSpan("voidhash.person.merged_into_id", toPersonId);
        const archivedAt = yield* DateTime.nowAsDate;
        yield* db
          .update(persons)
          .set({
            archivedAt,
            mergedIntoPersonId: toPersonId,
          })
          .where(eq(persons.id, fromPersonId));

        return { id: fromPersonId };
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new PersonServiceError({ cause: String(error.cause) })),
          }),
        ),
    );

    return constant({
      createPerson,
      getPersonByDistinctId,
      getPersonById,
      getPersons,
      getPersonsPage,
      mergePersons,
      setPersonAttributes,
    });
  }),
}) {
  static layer = Layer.effect(PersonService)(PersonService.make);
}

const getCreatedAtTime = (profile: PersonProfile) => profile.createdAt?.getTime() ?? 0;

/** Sort-key floor for persons whose nullable `created_at` was never stamped. */
const EPOCH = sql`'epoch'::timestamptz`;

/**
 * Stamps the current span with the request-wide identity dimension derived from
 * the {@link AuthSession} (auth method, acting user id, active organization id).
 * Nullable fields are guarded so no `"null"` strings are emitted; no PII (email
 * / name) or cookie material is ever attached.
 */
const annotateSessionIdentity = (session: Option.Option<AnyAuthSession>) =>
  Effect.gen(function* () {
    if (Option.isNone(session)) {
      return;
    }
    yield* Effect.annotateCurrentSpan("voidhash.auth.method", session.value.method);
    if (session.value.user?.id) {
      yield* Effect.annotateCurrentSpan("voidhash.user.id", session.value.user.id);
    }
    const organizationId = session.value.organizations[0]?.id;
    if (organizationId) {
      yield* Effect.annotateCurrentSpan("voidhash.organization.id", organizationId);
    }
  });
