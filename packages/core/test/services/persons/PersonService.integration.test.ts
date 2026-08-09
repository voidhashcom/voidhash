/**
 * Integration tests for {@link PersonService}, run against the real backend
 * stack provisioned once by `test/_testing/globalSetup.ts` (live PlanetScale DB
 * + ClickHouse + WorkOS; only the project schema cache is an in-memory stub).
 *
 * `PersonService` is the dashboard / admin surface for querying persons. It is
 * a *read-heavy* service: the only writes are `createPerson` (delegated to
 * {@link PersonIdentityService.resolveDistinctId}) and `mergePersons` (a direct
 * `UPDATE` of the merge flags). Every test drives the service end-to-end and
 * verifies the *persisted* state read straight back from MySQL, not just the
 * method's return value.
 *
 * Dependency wiring: `PersonService` needs `PersonIdentityService`, which in
 * turn needs an `IdentityProjectionPublisher`. The test provides the
 * publisher's {@link IdentityProjectionPublisher.noop} test variant.
 *
 * Conventions used throughout (see PerkService.integration.test.ts):
 *  - Every test shares the one seeded fixture project ({@link CoreTestFixture})
 *    but cleans up after itself: {@link withPersonCleanup} deletes the persons
 *    (and their `person_identity` rows) it created on exit, success or failure.
 *    The global teardown sweep is only a backstop. Assertions stay membership-
 *    based (never exact `getPersons` counts) and distinct ids are unique per
 *    call so a leftover row from a crashed run can't collide.
 *  - Permission tests reuse the default authenticated effect and re-authenticate
 *    just the call under test via {@link asUnauthorized}; the inner provision
 *    shadows the harness's default full-permission session.
 *  - Typed failures are asserted with `Effect.flip` (project convention),
 *    narrowing the swapped error with `instanceof` before reading its fields.
 */
import { Clock, DateTime, Effect, Layer } from "effect";
import { describe, expect, test as vitestTest } from "vitest";

import { PersonService } from "@voidhash/core/services/persons/PersonService";
import { PersonIdentityService } from "@voidhash/core/services/personIdentity/PersonIdentityService";
import { IdentityProjectionPublisher } from "@voidhash/core/services/personIdentity/IdentityProjectionPublisher";
import { PersonIdentityKind, PersonNotFoundError } from "@voidhash/core/domain/person/Person";
import { ActionForbiddenError, type UserSession } from "@voidhash/core/domain/auth/Auth";
import { Db, PersonOrigin, inArray, personIdentities, persons } from "@voidhash/db";

import { CoreAuthSession } from "@testing/CoreAuthSession";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";
import { CoreTestFixture } from "@testing/CoreTestFixture";

const { test } = CoreIntegrationTestHarness.make();

const projectId = CoreTestFixture.projectId;

/** Monotonic counter so distinct ids stay unique even within one millisecond. */
let idSeq = 0;
const uniqueDistinctId = (label: string) =>
  Effect.map(Clock.currentTimeMillis, (now) => `it-person-${label}-${now}-${idSeq++}`);

/**
 * `PersonService` depends on `PersonIdentityService`, which itself needs an
 * `IdentityProjectionPublisher` and the abstract completion workflow. This
 * layer wires the full graph down to harness `Db`: the publisher is the no-op
 * seam variant and the completion workflow is a no-op (only dispatched by
 * `identifyDistinctId`, which `PersonService` never calls).
 */
const PersonServiceUnderTest = PersonService.layer.pipe(
  Layer.provideMerge(PersonIdentityService.layer),
  Layer.provide(IdentityProjectionPublisher.noop),
);

/** Read a person row straight from the database, bypassing the service. */
const findPersonRow = (id: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.persons.findFirst({ where: { id } });
  });

/** Read the identity-mapping row for a `(distinctId, projectId)` pair. */
const findIdentityRow = (distinctId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.personIdentities.findFirst({
      where: { distinctId, projectId },
    });
  });

/**
 * Insert a bare person row directly (bypassing the identity service) so tests
 * can set up exact merge-chain / archived / merged-source scenarios. Returns
 * the generated id.
 */
const insertPersonRow = (input: {
  readonly id: string;
  readonly name?: string | null;
  readonly email?: string | null;
  readonly archivedAt?: Date | null;
  readonly mergedIntoPersonId?: string | null;
  readonly createdAt?: Date;
}) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const seenAt = input.createdAt ?? (yield* DateTime.nowAsDate);
    yield* db.insert(persons).values({
      id: input.id,
      archivedAt: input.archivedAt ?? null,
      createdAt: seenAt,
      email: input.email ?? null,
      firstSeenAt: seenAt,
      lastSeenAt: seenAt,
      mergedIntoPersonId: input.mergedIntoPersonId ?? null,
      name: input.name ?? null,
      origin: PersonOrigin.Dashboard,
      projectId,
    });
    return input.id;
  });

/** Insert an identity-mapping row pointing a distinct id at a person. */
const insertIdentityRow = (input: {
  readonly id: string;
  readonly distinctId: string;
  readonly personId: string;
  readonly kind?: number;
}) =>
  Effect.gen(function* () {
    const db = yield* Db;
    yield* db.insert(personIdentities).values({
      id: input.id,
      distinctId: input.distinctId,
      kind: input.kind ?? PersonIdentityKind.Identified,
      personId: input.personId,
      projectId,
      version: 0,
    });
    return input.distinctId;
  });

/**
 * Delete the given persons and their identity-mapping rows. `person_identity`
 * cascades on a person delete via FK, but tests also create stand-alone
 * mappings, so both are cleared explicitly. Each delete is `ignore`d so a
 * missing row never turns the finalizer into a failure.
 */
const cleanupCreatedPersons = (ids: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    if (ids.length === 0) return;
    const db = yield* Db;
    const targets = [...ids];
    yield* db
      .delete(personIdentities)
      .where(inArray(personIdentities.personId, targets))
      .pipe(Effect.ignore);
    yield* db.delete(persons).where(inArray(persons.id, targets)).pipe(Effect.ignore);
  });

/**
 * Wrap a test body so every person it creates is removed afterward, regardless
 * of how the test exits. Pass each created person id to the `track` callback;
 * cleanup reads the collected ids lazily at finalization via `Effect.ensuring`,
 * so it sees every id tracked while the body ran (including on failure).
 */
const withPersonCleanup = <E, R>(
  body: (track: (id: string) => void) => Effect.Effect<void, E, R>,
): Effect.Effect<void, E, R | Db> => {
  const createdIds: string[] = [];
  return body((id) => {
    createdIds.push(id);
  }).pipe(Effect.ensuring(cleanupCreatedPersons(createdIds)));
};

/** Fixed epoch timestamp for synthetic session rows — a constant, not a clock read. */
const EPOCH_DATE = DateTime.toDateUtc(DateTime.makeUnsafe(0));

/** A `user`-method session for the fixture principal carrying no project access. */
const sessionWithoutProjectAccess = (): UserSession => ({
  cookie: null,
  method: "user",
  name: `${CoreTestFixture.userName} <${CoreTestFixture.userEmail}>`,
  organizations: [],
  person: null,
  projects: [],
  user: {
    createdAt: EPOCH_DATE,
    email: CoreTestFixture.userEmail,
    emailVerified: true,
    id: CoreTestFixture.userId,
    image: null,
    name: CoreTestFixture.userName,
    role: null,
    updatedAt: EPOCH_DATE,
    workosUserId: CoreTestFixture.workosUserId,
  },
});

/**
 * Run a single call as a caller with no project access. Re-authenticates just
 * this effect with the no-access session; the inner provision shadows the
 * harness's default full-permission session for the wrapped call only.
 */
const asUnauthorized = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(CoreAuthSession.authenticate(sessionWithoutProjectAccess()));

describe("PersonService.getPersonById", () => {
  test(
    "loads a person by id and projects it to a PersonProfile",
    withPersonCleanup((track) =>
      Effect.gen(function* () {
        const personService = yield* PersonService;

        const distinctId = yield* uniqueDistinctId("by-id");
        const created = yield* personService.createPerson({
          distinctId,
          email: "by-id@voidhash.test",
          name: "By Id",
          origin: PersonOrigin.Dashboard,
          projectId,
        });
        track(created.personId);

        const profile = yield* personService.getPersonById(created.personId);
        expect(profile.personId).toBe(created.personId);
        expect(profile.projectId).toBe(projectId);
        expect(profile.distinctId).toBe(distinctId);
        expect(profile.email).toBe("by-id@voidhash.test");
        expect(profile.name).toBe("By Id");
        expect(profile.kind).toBe(PersonIdentityKind.Identified);
        expect(profile.archivedAt).toBeNull();
        expect(profile.mergedIntoPersonId).toBeNull();
      }),
    ).pipe(Effect.provide(PersonServiceUnderTest), CoreAuthSession.authenticate()),
  );

  test(
    "fails with PersonNotFoundError for an unknown id",
    Effect.gen(function* () {
      const personService = yield* PersonService;
      const now = yield* Clock.currentTimeMillis;
      const missingId = `person_missing_${now}`;
      const error = yield* Effect.flip(personService.getPersonById(missingId));
      expect(error).toBeInstanceOf(PersonNotFoundError);
      if (error instanceof PersonNotFoundError) {
        expect(error.id).toBe(missingId);
      }
    }).pipe(Effect.provide(PersonServiceUnderTest), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all",
    withPersonCleanup((track) =>
      Effect.gen(function* () {
        const personService = yield* PersonService;

        const created = yield* personService.createPerson({
          distinctId: yield* uniqueDistinctId("by-id-forbidden"),
          email: null,
          name: null,
          origin: PersonOrigin.Dashboard,
          projectId,
        });
        track(created.personId);

        const error = yield* Effect.flip(
          asUnauthorized(personService.getPersonById(created.personId)),
        );
        expect(error).toBeInstanceOf(ActionForbiddenError);
      }),
    ).pipe(Effect.provide(PersonServiceUnderTest), CoreAuthSession.authenticate()),
  );

  test(
    "follows the merge chain and returns the canonical person",
    withPersonCleanup((track) =>
      Effect.gen(function* () {
        const personService = yield* PersonService;

        // Canonical person with its own identity, then a merged source that
        // points at it via mergedIntoPersonId. Looking up the *source* id must
        // resolve to the canonical person + its identity/profile.
        const now = yield* Clock.currentTimeMillis;
        const canonicalId = `person_canon_${now}_${idSeq++}`;
        const sourceId = `person_src_${now}_${idSeq++}`;
        const canonicalDistinctId = yield* uniqueDistinctId("chain-canon");

        yield* insertPersonRow({ id: canonicalId, email: "canon@voidhash.test", name: "Canon" });
        track(canonicalId);
        yield* insertIdentityRow({
          distinctId: canonicalDistinctId,
          id: `${canonicalId}_dist`,
          personId: canonicalId,
        });
        yield* insertPersonRow({
          id: sourceId,
          mergedIntoPersonId: canonicalId,
          archivedAt: yield* DateTime.nowAsDate,
        });
        track(sourceId);

        const profile = yield* personService.getPersonById(sourceId);
        expect(profile.personId).toBe(canonicalId);
        expect(profile.distinctId).toBe(canonicalDistinctId);
        expect(profile.email).toBe("canon@voidhash.test");
        expect(profile.name).toBe("Canon");
      }),
    ).pipe(Effect.provide(PersonServiceUnderTest), CoreAuthSession.authenticate()),
  );
});

describe("PersonService.getPersonByDistinctId", () => {
  test(
    "finds the mapping, follows to the canonical person, and returns the profile",
    withPersonCleanup((track) =>
      Effect.gen(function* () {
        const personService = yield* PersonService;

        const distinctId = yield* uniqueDistinctId("by-distinct");
        const created = yield* personService.createPerson({
          distinctId,
          email: "by-distinct@voidhash.test",
          name: "By Distinct",
          origin: PersonOrigin.Dashboard,
          projectId,
        });
        track(created.personId);

        const profile = yield* personService.getPersonByDistinctId(distinctId, projectId);
        expect(profile.personId).toBe(created.personId);
        expect(profile.distinctId).toBe(distinctId);
        expect(profile.email).toBe("by-distinct@voidhash.test");
        expect(profile.name).toBe("By Distinct");
      }),
    ).pipe(Effect.provide(PersonServiceUnderTest), CoreAuthSession.authenticate()),
  );

  test(
    "fails with PersonNotFoundError when no mapping exists",
    Effect.gen(function* () {
      const personService = yield* PersonService;
      const missing = yield* uniqueDistinctId("by-distinct-missing");
      const error = yield* Effect.flip(personService.getPersonByDistinctId(missing, projectId));
      expect(error).toBeInstanceOf(PersonNotFoundError);
      if (error instanceof PersonNotFoundError) {
        expect(error.id).toBe(missing);
      }
    }).pipe(Effect.provide(PersonServiceUnderTest), CoreAuthSession.authenticate()),
  );

  // The `if (!dbPerson)` branch in `getPersonByDistinctId` (PersonService.ts
  // ~line 171) is unreachable against real infra: an orphaned mapping cannot be
  // constructed. `person_identity.person_id` carries a FK to `person.id`
  // (schema.ts:362-364, `onDelete: "cascade"`), so PlanetScale rejects inserting
  // a mapping whose personId references a nonexistent person — the seed itself
  // raises a DatabaseError before the service runs. `findCanonicalPersonById`
  // also never returns undefined for a present mapping: a broken
  // `mergedIntoPersonId` chain returns the source row, not undefined. This is a
  // DB invariant, not a source bug; the defensive branch is correct to keep.
  vitestTest.todo(
    "fails with PersonNotFoundError when the mapping points at a missing person (orphaned) — unreachable: person_identity.person_id FK to person.id forbids orphaned mappings (insert raises DatabaseError before the service runs)",
  );

  test(
    "forbids callers without project:all",
    withPersonCleanup((track) =>
      Effect.gen(function* () {
        const personService = yield* PersonService;

        const distinctId = yield* uniqueDistinctId("by-distinct-forbidden");
        const created = yield* personService.createPerson({
          distinctId,
          email: null,
          name: null,
          origin: PersonOrigin.Dashboard,
          projectId,
        });
        track(created.personId);

        const error = yield* Effect.flip(
          asUnauthorized(personService.getPersonByDistinctId(distinctId, projectId)),
        );
        expect(error).toBeInstanceOf(ActionForbiddenError);
      }),
    ).pipe(Effect.provide(PersonServiceUnderTest), CoreAuthSession.authenticate()),
  );
});

describe("PersonService.getPersons", () => {
  test(
    "lists active persons, excludes merged sources, and deduplicates by personId",
    withPersonCleanup((track) =>
      Effect.gen(function* () {
        const personService = yield* PersonService;

        // Two ordinary persons created via the service.
        const distinctA = yield* uniqueDistinctId("list-a");
        const distinctB = yield* uniqueDistinctId("list-b");
        const a = yield* personService.createPerson({
          distinctId: distinctA,
          email: null,
          name: "List A",
          origin: PersonOrigin.Dashboard,
          projectId,
        });
        track(a.personId);
        const b = yield* personService.createPerson({
          distinctId: distinctB,
          email: null,
          name: "List B",
          origin: PersonOrigin.Dashboard,
          projectId,
        });
        track(b.personId);

        // A person with two identities — getPersons dedupes these to one entry.
        const now = yield* Clock.currentTimeMillis;
        const multiId = `person_multi_${now}_${idSeq++}`;
        const multiPrimary = yield* uniqueDistinctId("list-multi-primary");
        const multiSecondary = yield* uniqueDistinctId("list-multi-secondary");
        yield* insertPersonRow({ id: multiId, name: "Multi" });
        track(multiId);
        yield* insertIdentityRow({
          distinctId: multiPrimary,
          id: `${multiId}_dist_1`,
          personId: multiId,
        });
        yield* insertIdentityRow({
          distinctId: multiSecondary,
          id: `${multiId}_dist_2`,
          personId: multiId,
        });

        // A merged source that must NOT appear (mergedIntoPersonId is set).
        const mergedSourceId = `person_merged_src_${now}_${idSeq++}`;
        const mergedSourceDistinct = yield* uniqueDistinctId("list-merged-src");
        yield* insertPersonRow({
          id: mergedSourceId,
          mergedIntoPersonId: a.personId,
          archivedAt: yield* DateTime.nowAsDate,
        });
        track(mergedSourceId);
        yield* insertIdentityRow({
          distinctId: mergedSourceDistinct,
          id: `${mergedSourceId}_dist`,
          personId: mergedSourceId,
        });

        const list = yield* personService.getPersons({ projectId });

        expect(list.some((profile) => profile.personId === a.personId)).toBe(true);
        expect(list.some((profile) => profile.personId === b.personId)).toBe(true);
        expect(list.some((profile) => profile.personId === multiId)).toBe(true);
        // The merged source is filtered out by the isNull(mergedIntoPersonId) clause.
        expect(list.some((profile) => profile.personId === mergedSourceId)).toBe(false);
        // Dedup: the multi-identity person appears exactly once.
        expect(list.filter((profile) => profile.personId === multiId)).toHaveLength(1);
      }),
    ).pipe(Effect.provide(PersonServiceUnderTest), CoreAuthSession.authenticate()),
  );

  test(
    "returns an empty array for a project with no persons",
    Effect.gen(function* () {
      const personService = yield* PersonService;
      // A project id that exists in scope but never has persons under it: the
      // fixture project may carry rows from concurrent tests, so use a unique
      // synthetic project id and grant access to it via a custom session.
      const now = yield* Clock.currentTimeMillis;
      const emptyProjectId = `it_empty_project_${now}_${idSeq++}`;
      const list = yield* personService.getPersons({ projectId: emptyProjectId }).pipe(
        CoreAuthSession.authenticate({
          cookie: null,
          method: "user",
          name: `${CoreTestFixture.userName} <${CoreTestFixture.userEmail}>`,
          organizations: [],
          person: null,
          projects: [
            {
              id: emptyProjectId,
              logo: null,
              name: "Empty Project",
              organizationId: CoreTestFixture.organizationId,
              permissions: ["project:all"],
              slug: "it-empty-project",
            },
          ],
          user: {
            createdAt: EPOCH_DATE,
            email: CoreTestFixture.userEmail,
            emailVerified: true,
            id: CoreTestFixture.userId,
            image: null,
            name: CoreTestFixture.userName,
            role: null,
            updatedAt: EPOCH_DATE,
            workosUserId: CoreTestFixture.workosUserId,
          },
        }),
      );
      expect(list).toEqual([]);
    }).pipe(Effect.provide(PersonServiceUnderTest), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all",
    Effect.gen(function* () {
      const personService = yield* PersonService;
      const error = yield* Effect.flip(asUnauthorized(personService.getPersons({ projectId })));
      expect(error).toBeInstanceOf(ActionForbiddenError);
    }).pipe(Effect.provide(PersonServiceUnderTest), CoreAuthSession.authenticate()),
  );
});

describe("PersonService.createPerson", () => {
  test(
    "creates the canonical person + identity mapping and returns the projected profile",
    withPersonCleanup((track) =>
      Effect.gen(function* () {
        const personService = yield* PersonService;

        const distinctId = yield* uniqueDistinctId("create");
        const created = yield* personService.createPerson({
          distinctId,
          email: "create@voidhash.test",
          name: "Created Person",
          origin: PersonOrigin.API,
          projectId,
        });
        track(created.personId);

        // Returned profile carries the distinct id from the new mapping.
        expect(created.personId.startsWith("person_")).toBe(true);
        expect(created.distinctId).toBe(distinctId);
        expect(created.email).toBe("create@voidhash.test");
        expect(created.name).toBe("Created Person");
        expect(created.kind).toBe(PersonIdentityKind.Identified);
        expect(created.projectId).toBe(projectId);

        // Persisted person row.
        const personRow = yield* findPersonRow(created.personId);
        expect(personRow).toBeDefined();
        expect(personRow?.projectId).toBe(projectId);
        expect(personRow?.email).toBe("create@voidhash.test");
        expect(personRow?.name).toBe("Created Person");
        expect(personRow?.origin).toBe(PersonOrigin.API);

        // Persisted identity mapping linking the distinct id to the person.
        const identityRow = yield* findIdentityRow(distinctId);
        expect(identityRow).toBeDefined();
        expect(identityRow?.personId).toBe(created.personId);
        expect(identityRow?.kind).toBe(PersonIdentityKind.Identified);
      }),
    ).pipe(Effect.provide(PersonServiceUnderTest), CoreAuthSession.authenticate()),
  );

  test(
    "is idempotent for an existing distinct id, reusing the same canonical person",
    withPersonCleanup((track) =>
      Effect.gen(function* () {
        const personService = yield* PersonService;

        const distinctId = yield* uniqueDistinctId("create-idempotent");
        const first = yield* personService.createPerson({
          distinctId,
          email: "first@voidhash.test",
          name: "First",
          origin: PersonOrigin.Dashboard,
          projectId,
        });
        track(first.personId);

        // resolveDistinctId finds the existing mapping and reuses the person.
        const second = yield* personService.createPerson({
          distinctId,
          email: null,
          name: null,
          origin: PersonOrigin.Dashboard,
          projectId,
        });
        track(second.personId);

        expect(second.personId).toBe(first.personId);
        expect(second.distinctId).toBe(distinctId);
      }),
    ).pipe(Effect.provide(PersonServiceUnderTest), CoreAuthSession.authenticate()),
  );
});

describe("PersonService.mergePersons", () => {
  test(
    "sets archivedAt and mergedIntoPersonId on the source person",
    withPersonCleanup((track) =>
      Effect.gen(function* () {
        const personService = yield* PersonService;

        const now = yield* Clock.currentTimeMillis;
        const fromId = `person_merge_from_${now}_${idSeq++}`;
        const toId = `person_merge_to_${now}_${idSeq++}`;
        yield* insertPersonRow({ id: fromId, name: "From" });
        track(fromId);
        yield* insertPersonRow({ id: toId, name: "To" });
        track(toId);

        const before = yield* DateTime.nowAsDate;
        const result = yield* personService.mergePersons(fromId, toId);
        const after = yield* DateTime.nowAsDate;
        expect(result.id).toBe(fromId);

        const fromRow = yield* findPersonRow(fromId);
        expect(fromRow?.mergedIntoPersonId).toBe(toId);
        expect(fromRow?.archivedAt).toBeInstanceOf(Date);
        // archivedAt = now: assert it falls within the call window (with a small
        // margin for clock granularity / DB round-trip) rather than an exact ts.
        const archivedTime = fromRow?.archivedAt?.getTime() ?? 0;
        expect(archivedTime).toBeGreaterThanOrEqual(before.getTime() - 2000);
        expect(archivedTime).toBeLessThanOrEqual(after.getTime() + 2000);

        // The target is untouched by mergePersons (it only flags the source).
        const toRow = yield* findPersonRow(toId);
        expect(toRow?.mergedIntoPersonId).toBeNull();
        expect(toRow?.archivedAt).toBeNull();
      }),
    ).pipe(Effect.provide(PersonServiceUnderTest), CoreAuthSession.authenticate()),
  );
});
