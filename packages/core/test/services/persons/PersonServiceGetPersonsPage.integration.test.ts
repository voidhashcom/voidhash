/**
 * Integration tests for {@link PersonService.getPersonsPage}, run against the
 * real Postgres provisioned once by the suite's `globalSetup`. The read under
 * test is the keyset walk over persons: the cursor (`after` = last person id)
 * resolves to its row via `(projectId, id)`, then the page is the row-value
 * comparison `(coalesce(created_at, epoch), id) < (anchor…)` ordered by
 * `coalesce(created_at, epoch) desc, id desc` — `created_at` is nullable, so
 * both sides coalesce to the epoch to keep the sort total.
 *
 * Conventions (see PersonService.integration.test.ts): every test shares the
 * seeded fixture project ({@link CoreTestFixture}) but isolates its walk with
 * a per-test unique email filter, tracks every row it inserts, and
 * {@link withPersonCleanup} deletes them on exit, success or failure.
 */
import { Clock, DateTime, Effect, Layer } from "effect";
import { describe, expect } from "vitest";

import { PersonService } from "@voidhash/core/services/persons/PersonService";
import { PersonIdentityService } from "@voidhash/core/services/personIdentity/PersonIdentityService";
import { IdentityProjectionPublisher } from "@voidhash/core/services/personIdentity/IdentityProjectionPublisher";
import { PersonIdentityKind, type PersonProfile } from "@voidhash/core/domain/person/Person";
import { ActionForbiddenError, type UserSession } from "@voidhash/core/domain/auth/Auth";
import { Db, PersonOrigin, inArray, personIdentities, persons } from "@voidhash/db";

import { CoreAuthSession } from "@testing/CoreAuthSession";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";
import { CoreTestFixture } from "@testing/CoreTestFixture";

const { test } = CoreIntegrationTestHarness.make();

const projectId = CoreTestFixture.projectId;

/** Builds a `Date` from epoch millis without the `new Date` global. */
const dateAt = (millis: number): Date => DateTime.toDateUtc(DateTime.makeUnsafe(millis));

/** Monotonic counter so ids stay unique even within one millisecond. */
let idSeq = 0;
const uniqueId = (label: string) =>
  Effect.map(Clock.currentTimeMillis, (now) => `person_page_${label}_${now}_${idSeq++}`);

const PersonServiceUnderTest = PersonService.layer.pipe(
  Layer.provideMerge(PersonIdentityService.layer),
  Layer.provide(IdentityProjectionPublisher.noop),
);

/**
 * Insert a person plus one identity mapping (so `toProfile` can surface a
 * `distinctId`). `createdAt` is caller-controlled — `null` exercises the
 * epoch-coalesced tail of the sort.
 */
const insertPagedPerson = (input: {
  readonly id: string;
  readonly email: string | null;
  readonly createdAt: Date | null;
  readonly archivedAt?: Date | null;
  readonly projectId?: string;
}) =>
  Effect.gen(function* () {
    const db = yield* Db;
    yield* db.insert(persons).values({
      archivedAt: input.archivedAt ?? null,
      createdAt: input.createdAt,
      email: input.email,
      id: input.id,
      name: "Paged Person",
      origin: PersonOrigin.Dashboard,
      projectId: input.projectId ?? projectId,
    });
    if ((input.projectId ?? projectId) === projectId) {
      yield* db.insert(personIdentities).values({
        distinctId: `${input.id}_distinct`,
        id: `${input.id}_identity`,
        kind: PersonIdentityKind.Identified,
        personId: input.id,
        projectId,
        version: 0,
      });
    }
    return input.id;
  });

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

const withPersonCleanup = <E, R>(
  body: (track: (id: string) => void) => Effect.Effect<void, E, R>,
): Effect.Effect<void, E, R | Db> => {
  const createdIds: string[] = [];
  return body((id) => {
    createdIds.push(id);
  }).pipe(Effect.ensuring(cleanupCreatedPersons(createdIds)));
};

interface PersonPage {
  readonly endCursorId: string | null;
  readonly hasNextPage: boolean;
  readonly profileIds: ReadonlyArray<string>;
}

/**
 * Follow `hasNextPage` / `endCursorId` to exhaustion, exactly like the route
 * does. Bounded so a paging bug that never terminates fails the test instead
 * of hanging it.
 */
const walkPersonPages = (input: { readonly email: string; readonly limit: number }) =>
  Effect.gen(function* () {
    const personService = yield* PersonService;
    const pages: Array<PersonPage> = [];
    let after: string | undefined = undefined;
    for (let i = 0; i < 25; i++) {
      const page: {
        readonly endCursorId: string | null;
        readonly hasNextPage: boolean;
        readonly profiles: ReadonlyArray<PersonProfile>;
      } = yield* personService.getPersonsPage({
        after,
        email: input.email,
        limit: input.limit,
        projectId,
      });
      pages.push({
        endCursorId: page.endCursorId,
        hasNextPage: page.hasNextPage,
        profileIds: page.profiles.map((profile) => profile.personId),
      });
      if (!page.hasNextPage) return pages;
      if (page.endCursorId === null) return pages;
      after = page.endCursorId;
    }
    return pages;
  });

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

describe("PersonService.getPersonsPage", () => {
  test(
    "pages newest-first to exhaustion, breaking timestamp ties by id and coalescing null createdAt to the epoch",
    withPersonCleanup((track) =>
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis;
        const email = `page-walk-${now}-${idSeq++}@voidhash.test`;

        // Expected order: distinct timestamps newest-first, then the tie pair
        // by id desc, then the null-createdAt row (epoch-coalesced) last.
        const tieTime = dateAt(now - 5 * 60_000);
        const tieA = yield* insertPagedPerson({
          createdAt: tieTime,
          email,
          id: `person_page_tie_a_${now}_${idSeq++}`,
        });
        track(tieA);
        const tieB = yield* insertPagedPerson({
          createdAt: tieTime,
          email,
          id: `person_page_tie_b_${now}_${idSeq++}`,
        });
        track(tieB);

        const freshIds: string[] = [];
        for (let i = 0; i < 4; i++) {
          const id = yield* insertPagedPerson({
            createdAt: dateAt(now - i * 60_000),
            email,
            id: yield* uniqueId(`walk${i}`),
          });
          track(id);
          freshIds.push(id);
        }

        const nullCreatedAt = yield* insertPagedPerson({
          createdAt: null,
          email,
          id: yield* uniqueId("walk-null"),
        });
        track(nullCreatedAt);

        // tie ids share a prefix, so the later (larger) id wins the desc sort.
        const expectedTieOrder = [tieA, tieB].sort().reverse();
        const expected = [...freshIds, ...expectedTieOrder, nullCreatedAt];

        const pages = yield* walkPersonPages({ email, limit: 3 });
        expect(pages.map((page) => page.profileIds.length)).toEqual([3, 3, 1]);
        expect(pages.map((page) => page.hasNextPage)).toEqual([true, true, false]);
        // The end cursor is only set while more rows follow.
        expect(pages[0]?.endCursorId).not.toBeNull();
        expect(pages[2]?.endCursorId).toBeNull();

        const walked = pages.flatMap((page) => page.profileIds);
        expect(walked).toEqual(expected);
        expect(new Set(walked).size).toBe(expected.length);
      }),
    ).pipe(Effect.provide(PersonServiceUnderTest), CoreAuthSession.authenticate()),
  );

  test(
    "matches the email filter case-insensitively and keeps archived or other-email rows out",
    withPersonCleanup((track) =>
      Effect.gen(function* () {
        const personService = yield* PersonService;
        const now = yield* Clock.currentTimeMillis;
        const email = `page-filter-${now}-${idSeq++}@voidhash.test`;
        const otherEmail = `page-filter-other-${now}-${idSeq++}@voidhash.test`;

        const match = yield* insertPagedPerson({
          createdAt: dateAt(now),
          email,
          id: yield* uniqueId("filter-match"),
        });
        track(match);
        const otherMatch = yield* insertPagedPerson({
          createdAt: dateAt(now - 60_000),
          email: otherEmail,
          id: yield* uniqueId("filter-other"),
        });
        track(otherMatch);
        const archived = yield* insertPagedPerson({
          archivedAt: dateAt(now),
          createdAt: dateAt(now - 120_000),
          email,
          id: yield* uniqueId("filter-archived"),
        });
        track(archived);

        // The service lowercases the input and compares lower(email).
        const page = yield* personService.getPersonsPage({
          email: email.toUpperCase(),
          projectId,
        });
        const ids = page.profiles.map((profile) => profile.personId);
        expect(ids).toEqual([match]);
        expect(page.hasNextPage).toBe(false);
        expect(page.endCursorId).toBeNull();
      }),
    ).pipe(Effect.provide(PersonServiceUnderTest), CoreAuthSession.authenticate()),
  );

  test(
    "fails with ActionForbiddenError for a cursor whose row was deleted or lives in another project",
    withPersonCleanup((track) =>
      Effect.gen(function* () {
        const personService = yield* PersonService;
        const now = yield* Clock.currentTimeMillis;
        const email = `page-stale-${now}-${idSeq++}@voidhash.test`;

        const deleted = yield* insertPagedPerson({
          createdAt: dateAt(now),
          email,
          id: yield* uniqueId("stale-deleted"),
        });
        const db = yield* Db;
        yield* db.delete(personIdentities).where(inArray(personIdentities.personId, [deleted]));
        yield* db.delete(persons).where(inArray(persons.id, [deleted]));

        const staleError = yield* Effect.flip(
          personService.getPersonsPage({ after: deleted, email, projectId }),
        );
        expect(staleError).toBeInstanceOf(ActionForbiddenError);
        if (staleError instanceof ActionForbiddenError) {
          expect(staleError.message).toBe("Pagination cursor no longer refers to a known item.");
        }

        // The anchor lookup is project-scoped: a live row from another project
        // is just as unknown to this walk.
        const foreign = yield* insertPagedPerson({
          createdAt: dateAt(now),
          email,
          id: yield* uniqueId("stale-foreign"),
          projectId: `${projectId}-other`,
        });
        track(foreign);
        const foreignError = yield* Effect.flip(
          personService.getPersonsPage({ after: foreign, email, projectId }),
        );
        expect(foreignError).toBeInstanceOf(ActionForbiddenError);
      }),
    ).pipe(Effect.provide(PersonServiceUnderTest), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all",
    Effect.gen(function* () {
      const personService = yield* PersonService;
      const error = yield* Effect.flip(
        personService
          .getPersonsPage({ projectId })
          .pipe(CoreAuthSession.authenticate(sessionWithoutProjectAccess())),
      );
      expect(error).toBeInstanceOf(ActionForbiddenError);
    }).pipe(Effect.provide(PersonServiceUnderTest), CoreAuthSession.authenticate()),
  );
});
