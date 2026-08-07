/**
 * Integration tests for {@link PurchaseService}, run against the real backend
 * stack provisioned once by `test/_testing/globalSetup.ts` (live PlanetScale DB
 * + ClickHouse + WorkOS; only the project schema cache is an in-memory stub).
 *
 * `PurchaseService` exposes a single read-only method, `getPersonPurchases`,
 * which is gated behind a `project:all` permission check on the *person's*
 * project. The service writes nothing, so these tests focus on:
 *  - the rows returned for a person actually match the `purchase` rows persisted
 *    under that `personId` (read straight back from MySQL to confirm),
 *  - the order of the guards: a missing person fails with `PersonNotFoundError`
 *    *before* any permission check runs,
 *  - the permission check runs against `person.projectId` and rejects callers
 *    without `project:all` for that project.
 *
 * Conventions used throughout:
 *  - The service has no parent rows seeded for it by {@link CoreTestFixture}
 *    (which seeds only user/org/member/project), so each test creates its own
 *    `person` + `purchase` rows under the fixture project and removes them on
 *    exit via {@link withCleanup} (an `Effect.ensuring` finalizer), success or
 *    failure. The global teardown sweep is only a backstop. Ids are unique per
 *    call so a leftover row from a crashed run can't collide, and assertions
 *    stay membership-based (`.some(...)`) rather than exact counts.
 *  - Typed failures are asserted with `Effect.flip` (project convention),
 *    narrowing the swapped error with `instanceof` before reading its fields,
 *    and each failure path is paired with a DB-state assertion.
 *  - Permission tests re-authenticate just the call under test via
 *    {@link asUnauthorized}; the inner provision shadows the harness's default
 *    full-permission session for the wrapped call only.
 */
import { DateTime, Effect } from "effect";
import { describe, expect } from "vitest";

import { PurchaseService } from "@voidhash/core/services";
import { ActionForbiddenError, type UserSession } from "@voidhash/core/domain/auth/Auth";
import { PersonNotFoundError } from "@voidhash/core/domain/person/Person";
import { Db, inArray, persons, purchases } from "@voidhash/db";

import { CoreAuthSession } from "@testing/CoreAuthSession";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";
import { CoreTestFixture } from "@testing/CoreTestFixture";
import { generateId } from "@voidhash/core/utils/generate-id";

const { test } = CoreIntegrationTestHarness.make();

const projectId = CoreTestFixture.projectId;

/** Per-run token plus a monotonic counter so ids stay unique across and within runs. */
const runToken = generateId("test");
let idSeq = 0;
const uniqueId = (label: string) => `it-purchase-${label}-${runToken}-${idSeq++}`;

const epoch = DateTime.toDateUtc(DateTime.makeUnsafe(0));

/** Insert a bare person row under the fixture project and return its id. */
const insertPerson = (id: string, ownerProjectId: string = projectId) =>
  Effect.gen(function* () {
    const db = yield* Db;
    yield* db.insert(persons).values({ id, projectId: ownerProjectId });
    return id;
  });

/**
 * Insert a one-time purchase row for a person and return its id. `providerKey`
 * must be globally unique (`provider_key_idx`), so it is namespaced per call.
 * `paymentProviderConfigurationProductId` has no FK, so a fabricated id is fine.
 */
const insertPurchase = (id: string, personId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    yield* db.insert(purchases).values({
      id,
      personId,
      providerKey: `${id}-key`,
      paymentProviderConfigurationProductId: `${id}-pppc`,
    });
    return id;
  });

/** Read a purchase row straight from the database, bypassing the service. */
const findPurchaseRow = (id: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.purchases.findFirst({ where: { id } });
  });

/**
 * Delete the given person and purchase rows. Each delete is `ignore`d so a
 * missing row never turns the finalizer into a failure. Purchases are removed
 * before persons (no DB FK, but order keeps the intent clear). `PurchaseService`
 * writes no audit rows, so there is nothing append-only to sweep.
 */
const cleanupCreated = (personIds: ReadonlyArray<string>, purchaseIds: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const db = yield* Db;
    if (purchaseIds.length > 0) {
      yield* db
        .delete(purchases)
        .where(inArray(purchases.id, [...purchaseIds]))
        .pipe(Effect.ignore);
    }
    if (personIds.length > 0) {
      yield* db
        .delete(persons)
        .where(inArray(persons.id, [...personIds]))
        .pipe(Effect.ignore);
    }
  });

/**
 * Wrap a test body so every person/purchase it creates is removed afterward,
 * regardless of how the test exits. Pass each created id to the matching `track`
 * callback; cleanup reads the collected ids lazily at finalization via
 * `Effect.ensuring`, so it sees every id tracked while the body ran (including
 * on failure).
 */
const withCleanup = <E, R>(
  body: (track: {
    person: (id: string) => void;
    purchase: (id: string) => void;
  }) => Effect.Effect<void, E, R>,
): Effect.Effect<void, E, R | Db> => {
  const personIds: string[] = [];
  const purchaseIds: string[] = [];
  return body({
    person: (id) => {
      personIds.push(id);
    },
    purchase: (id) => {
      purchaseIds.push(id);
    },
  }).pipe(Effect.ensuring(cleanupCreated(personIds, purchaseIds)));
};

/** A `user`-method session for the fixture principal carrying no project access. */
const sessionWithoutProjectAccess = (): UserSession => ({
  cookie: null,
  method: "user",
  name: `${CoreTestFixture.userName} <${CoreTestFixture.userEmail}>`,
  organizations: [],
  person: null,
  projects: [],
  user: {
    createdAt: epoch,
    email: CoreTestFixture.userEmail,
    emailVerified: true,
    id: CoreTestFixture.userId,
    image: null,
    name: CoreTestFixture.userName,
    role: null,
    updatedAt: epoch,
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

describe("PurchaseService.getPersonPurchases", () => {
  test(
    "returns all purchase rows persisted for the given person",
    withCleanup((track) =>
      Effect.gen(function* () {
        const purchaseService = yield* PurchaseService;

        const personId = uniqueId("person");
        yield* insertPerson(personId);
        track.person(personId);

        const purchaseA = uniqueId("a");
        const purchaseB = uniqueId("b");
        yield* insertPurchase(purchaseA, personId);
        track.purchase(purchaseA);
        yield* insertPurchase(purchaseB, personId);
        track.purchase(purchaseB);

        // A purchase belonging to a *different* person must not leak in.
        const otherPersonId = uniqueId("other-person");
        yield* insertPerson(otherPersonId);
        track.person(otherPersonId);
        const otherPurchase = uniqueId("other");
        yield* insertPurchase(otherPurchase, otherPersonId);
        track.purchase(otherPurchase);

        const result = yield* purchaseService.getPersonPurchases(personId);

        expect(result.some((row) => row.id === purchaseA)).toBe(true);
        expect(result.some((row) => row.id === purchaseB)).toBe(true);
        expect(result.some((row) => row.id === otherPurchase)).toBe(false);
        expect(result.every((row) => row.personId === personId)).toBe(true);

        // The returned rows match what's actually persisted.
        const rowA = yield* findPurchaseRow(purchaseA);
        expect(rowA).toBeDefined();
        expect(rowA?.personId).toBe(personId);
      }),
    ).pipe(Effect.provide(PurchaseService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "returns an empty list for a person with no purchases",
    withCleanup((track) =>
      Effect.gen(function* () {
        const purchaseService = yield* PurchaseService;

        const personId = uniqueId("empty-person");
        yield* insertPerson(personId);
        track.person(personId);

        const result = yield* purchaseService.getPersonPurchases(personId);
        expect(result).toEqual([]);
      }),
    ).pipe(Effect.provide(PurchaseService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "fails with PersonNotFoundError when the person does not exist",
    // No cleanup wrapper: a missing person means no rows are read or written.
    Effect.gen(function* () {
      const purchaseService = yield* PurchaseService;
      const missingPersonId = uniqueId("missing");

      const error = yield* Effect.flip(purchaseService.getPersonPurchases(missingPersonId));
      expect(error).toBeInstanceOf(PersonNotFoundError);
      if (error instanceof PersonNotFoundError) {
        expect(error.id).toBe(missingPersonId);
      }

      // Confirm the person genuinely isn't there (guard ran on real DB state).
      const db = yield* Db;
      const row = yield* db.query.persons.findFirst({ where: { id: missingPersonId } });
      expect(row).toBeUndefined();
    }).pipe(Effect.provide(PurchaseService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all for the person's project",
    withCleanup((track) =>
      Effect.gen(function* () {
        const purchaseService = yield* PurchaseService;

        // The person and a purchase exist under the fixture project, so the
        // person lookup succeeds and the permission check is what rejects.
        const personId = uniqueId("guarded-person");
        yield* insertPerson(personId);
        track.person(personId);
        const purchaseId = uniqueId("guarded");
        yield* insertPurchase(purchaseId, personId);
        track.purchase(purchaseId);

        const error = yield* Effect.flip(
          asUnauthorized(purchaseService.getPersonPurchases(personId)),
        );
        expect(error).toBeInstanceOf(ActionForbiddenError);

        // Nothing was mutated: the purchase row is still present afterward.
        const row = yield* findPurchaseRow(purchaseId);
        expect(row).toBeDefined();
        expect(row?.personId).toBe(personId);
      }),
    ).pipe(Effect.provide(PurchaseService.layer), CoreAuthSession.authenticate()),
  );
});
