import { constant } from "@voidhash/lib/lang";
import { Context, DateTime, Effect, Layer, Schema } from "effect";

import { type AnyAuthSession, AuthSession } from "../../domain/auth/Auth.ts";
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
  type PersonOriginValue,
  eq,
  persons,
} from "@voidhash/db";
import { checkProjectPermission } from "../../utils/permissions.ts";
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
    identities: identities.map(
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
 * `createPerson` is a thin wrapper that calls `resolveDistinctId` with
 * `shouldCreatePerson: true` and reloads the canonical profile.
 */
export class PersonService extends Context.Service<PersonService>()("PersonService", {
  make: Effect.gen(function* () {
    const personIdentityService = yield* PersonIdentityService;
    const db = yield* Db;

    const findCanonicalPersonById = (personId: string) =>
      Effect.gen(function* () {
        let current = yield* db.query.persons.findFirst({
          where: { id: personId },
        });
        while (current?.mergedIntoPersonId) {
          const mergedInto = yield* db.query.persons.findFirst({
            where: { id: current.mergedIntoPersonId },
          });
          if (!mergedInto) {
            return current;
          }
          current = mergedInto;
        }
        return current;
      });

    /**
     * Resolves a raw person row to its public {@link PersonProfile}. Returns
     * `undefined` when the person has no identities to surface.
     */
    const loadProfileRaw = Effect.fn("loadProfileRaw")(function* (personId: string) {
      yield* Effect.annotateCurrentSpan("voidhash.person.id", personId);
      const dbPerson = yield* findCanonicalPersonById(personId);
      if (!dbPerson) {
        return undefined;
      }
      yield* Effect.annotateCurrentSpan("voidhash.project.id", dbPerson.projectId);
      if (dbPerson.mergedIntoPersonId) {
        yield* Effect.annotateCurrentSpan(
          "voidhash.person.merged_into_id",
          dbPerson.mergedIntoPersonId,
        );
      }
      const identities = yield* db.query.personIdentities.findMany({
        where: { personId: dbPerson.id, projectId: dbPerson.projectId },
      });
      yield* Effect.annotateCurrentSpan("voidhash.person.identity_count", identities.length);
      return buildPerson(dbPerson, identities).toProfile();
    });

    const getPersonById = Effect.fn("getPersonById")(
      function* (personId: string) {
        yield* Effect.annotateCurrentSpan("voidhash.person.id", personId);
        const session = yield* AuthSession;
        yield* annotateSessionIdentity(session);
        const dbPerson = yield* findCanonicalPersonById(personId);
        if (!dbPerson) {
          return yield* Effect.fail(new PersonNotFoundError({ id: personId }));
        }
        yield* Effect.annotateCurrentSpan("voidhash.project.id", dbPerson.projectId);
        if (dbPerson.mergedIntoPersonId) {
          yield* Effect.annotateCurrentSpan(
            "voidhash.person.merged_into_id",
            dbPerson.mergedIntoPersonId,
          );
        }

        yield* checkProjectPermission(
          dbPerson.projectId,
          "project:all",
          `User ${session?.user?.id} is not authorized to access person ${personId} for project ${dbPerson.projectId}`,
        );

        const identities = yield* db.query.personIdentities.findMany({
          where: { personId: dbPerson.id, projectId: dbPerson.projectId },
        });
        yield* Effect.annotateCurrentSpan("voidhash.person.identity_count", identities.length);
        const profile = buildPerson(dbPerson, identities).toProfile();
        if (!profile) {
          return yield* Effect.fail(new PersonNotFoundError({ id: personId }));
        }
        return profile;
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
        yield* annotateSessionIdentity(session);
        const mapping = yield* db.query.personIdentities.findFirst({
          where: { distinctId, projectId },
        });
        if (!mapping) {
          return yield* Effect.fail(new PersonNotFoundError({ id: distinctId }));
        }

        const dbPerson = yield* findCanonicalPersonById(mapping.personId);
        if (!dbPerson) {
          return yield* Effect.fail(new PersonNotFoundError({ id: distinctId }));
        }
        yield* Effect.annotateCurrentSpan("voidhash.person.id", dbPerson.id);
        if (dbPerson.mergedIntoPersonId) {
          yield* Effect.annotateCurrentSpan(
            "voidhash.person.merged_into_id",
            dbPerson.mergedIntoPersonId,
          );
        }

        yield* checkProjectPermission(
          dbPerson.projectId,
          "project:all",
          `User ${session?.user?.id} is not authorized to access person ${distinctId} for project ${dbPerson.projectId}`,
        );

        const identities = yield* db.query.personIdentities.findMany({
          where: { personId: dbPerson.id, projectId: dbPerson.projectId },
        });
        yield* Effect.annotateCurrentSpan("voidhash.person.identity_count", identities.length);
        const profile = buildPerson(dbPerson, identities).toProfile();
        if (!profile) {
          return yield* Effect.fail(new PersonNotFoundError({ id: distinctId }));
        }
        return profile;
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
        yield* annotateSessionIdentity(session);
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
        const profiles = yield* Effect.all(personRows.map((person) => loadProfileRaw(person.id)));
        const activeProfiles = profiles.filter(
          (profile): profile is PersonProfile => typeof profile !== "undefined",
        );
        const result = Array.from(
          activeProfiles
            .reduce((deduped, profile) => {
              deduped.set(profile.personId, profile);
              return deduped;
            }, new Map<string, PersonProfile>())
            .values(),
        ).sort((left, right) => getCreatedAtTime(right) - getCreatedAtTime(left));
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

    const createPerson = Effect.fn("createPerson")(
      function* (input: {
        readonly projectId: string;
        readonly distinctId: string;
        readonly name: string | null;
        readonly email: string | null;
        readonly origin: PersonOriginValue;
      }) {
        yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
        yield* Effect.annotateCurrentSpan("voidhash.person.distinct_id", input.distinctId);
        yield* Effect.annotateCurrentSpan("voidhash.person.origin", input.origin);
        const eventTimestamp = yield* DateTime.nowAsDate;
        const result = yield* personIdentityService.resolveDistinctId({
          distinctId: input.distinctId,
          email: input.email ?? undefined,
          eventTimestamp,
          name: input.name ?? undefined,
          origin: input.origin,
          projectId: input.projectId,
          setAttributes: {},
          setOnceAttributes: {},
          shouldCreatePerson: true,
        });

        if (!result.identity.personId) {
          return yield* Effect.die(
            new Error("resolveDistinctId created a person without a personId"),
          );
        }

        const dbPerson = yield* findCanonicalPersonById(result.identity.personId);
        if (!dbPerson) {
          return yield* Effect.die(new Error("Created person could not be loaded by id"));
        }
        yield* Effect.annotateCurrentSpan("voidhash.person.id", dbPerson.id);
        if (dbPerson.mergedIntoPersonId) {
          yield* Effect.annotateCurrentSpan(
            "voidhash.person.merged_into_id",
            dbPerson.mergedIntoPersonId,
          );
        }

        const identities = yield* db.query.personIdentities.findMany({
          where: { personId: dbPerson.id, projectId: dbPerson.projectId },
        });
        yield* Effect.annotateCurrentSpan("voidhash.person.identity_count", identities.length);
        const profile = buildPerson(dbPerson, identities).toProfile();
        if (!profile) {
          return yield* Effect.die(new Error("Created person could not be resolved to a profile"));
        }

        yield* Effect.log(
          `Created person ${profile.personId} for distinct id ${profile.distinctId}`,
        );
        return profile;
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
      mergePersons,
    });
  }),
}) {
  static layer = Layer.effect(PersonService)(PersonService.make);
}

const getCreatedAtTime = (profile: PersonProfile) => profile.createdAt?.getTime() ?? 0;

/**
 * Stamps the current span with the request-wide identity dimension derived from
 * the {@link AuthSession} (auth method, acting user id, active organization id).
 * Nullable fields are guarded so no `"null"` strings are emitted; no PII (email
 * / name) or cookie material is ever attached.
 */
const annotateSessionIdentity = (session: AnyAuthSession | null | undefined) =>
  Effect.gen(function* () {
    if (!session) {
      return;
    }
    yield* Effect.annotateCurrentSpan("voidhash.auth.method", session.method);
    if (session.user?.id) {
      yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
    }
    const organizationId = session.organizations[0]?.id;
    if (organizationId) {
      yield* Effect.annotateCurrentSpan("voidhash.organization.id", organizationId);
    }
  });
