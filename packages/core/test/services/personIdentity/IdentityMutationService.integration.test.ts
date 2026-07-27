/**
 * Tests for the person-identity mutation methods on
 * {@link IdentityMutationService} (`src/services/personIdentity/IdentityMutationService.ts`),
 * plus the pure identity helpers they build on.
 *
 * The mutation methods take the active transaction handle as their first
 * argument (so `PersonIdentityService` and the identity completion workflow
 * drive them inside their own `db.transaction((tx) => …)` callbacks). The DB
 * tests below drive them through the local {@link inTransaction} helper, which
 * opens a real `db.transaction` and threads both the `tx` handle and the
 * service instance into the method under test. Two kinds of test live here:
 *
 *  - **Pure-logic units** (`mergeTraits`, `firstDefinedString`,
 *    `isAnonymousDistinctId`): deterministic, no infra, asserted inline. These
 *    pure helpers live in `domain/person` / `utils`; they sit here (rather than
 *    a separate `*.test.ts`) because they are exercised alongside the service
 *    and are cheap; the file is still classified *integration* because the
 *    mutating methods below require a real DB.
 *  - **DB mutations** (`ensure*`, `find*`, `mark*`, `upsert*`, `update*`,
 *    `archive*`): driven through a real `db.transaction` against the shared
 *    backend stack ({@link CoreIntegrationTestHarness}) and verified by reading
 *    the persisted `person` / `person_identity` / `person_personless_identity`
 *    rows back, never by trusting the return value alone.
 *
 * Conventions: each DB test scopes its writes to a unique distinctId/personId
 * per call (so concurrent runs never collide), asserts persisted state by
 * primary-key read-back, and cleans up every row it created via
 * {@link withIdentityCleanup}'s `Effect.ensuring` finalizer (the global sweep is
 * only a backstop). There is no permission-forbidden case: these helpers never
 * consult `AuthSession`.
 */
import { Effect } from "effect";
import { describe, expect, test as vitestTest } from "vitest";

import {
  IdentityMutationService,
  type MutationContext,
} from "@voidhash/core/services/personIdentity/IdentityMutationService";
import { isAnonymousDistinctId, mergeTraits } from "@voidhash/core/domain/person/Person";
import { firstDefinedString } from "@voidhash/core/utils";
import {
  type DbError,
  type DbTransaction,
  type Person as DbPerson,
  Db,
  PersonIdentityKind,
  PersonOrigin,
  and,
  eq,
  inArray,
  personIdentities,
  personPersonlessIdentities,
  persons,
} from "@voidhash/db";

import { CoreAuthSession } from "@testing/CoreAuthSession";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";
import { CoreTestFixture } from "@testing/CoreTestFixture";

const { test } = CoreIntegrationTestHarness.make();

/**
 * Opens a real `db.transaction` and threads both the `tx` handle and the
 * {@link IdentityMutationService} instance into `body`, the way the production
 * callers (PersonIdentityService, the identity completion workflow) drive the
 * mutation methods. The service layer is dependency-free, so it is provided
 * here; `Db` comes from the integration harness.
 */
const inTransaction = <A, E, R>(
  body: (
    tx: DbTransaction,
    mutations: IdentityMutationService["Service"],
  ) => Effect.Effect<A, E, R>,
) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const mutations = yield* IdentityMutationService;
    return yield* db.transaction((tx) => body(tx, mutations));
  }).pipe(Effect.provide(IdentityMutationService.layer));

const projectId = CoreTestFixture.projectId;
const ANON_PREFIX = "vh:anon:";

/** Monotonic counter so distinctIds stay unique even within one millisecond. */
let seq = 0;
const uniqueDistinctId = (label: string) => `it-did-${label}-${Date.now()}-${seq++}`;
const anonDistinctId = (label: string) => `${ANON_PREFIX}${uniqueDistinctId(label)}`;

const baseContext = (overrides?: Partial<MutationContext>): MutationContext => ({
  eventId: `it-evt-${Date.now()}-${seq++}`,
  eventTimestamp: new Date("2026-01-01T00:00:00.000Z"),
  origin: PersonOrigin.API,
  projectId,
  ...overrides,
});

/** Read a person row straight from the DB, bypassing the helpers. */
const findPersonRow = (id: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.persons.findFirst({ where: { id } });
  });

/** Read a person_identity row by its primary key. */
const findIdentityRow = (id: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.personIdentities.findFirst({ where: { id } });
  });

/** Read the person_identity row for a (project, distinctId) pair. */
const findIdentityByDistinctId = (distinctId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.personIdentities.findFirst({
      where: { projectId, distinctId },
    });
  });

/** Read the personless-identity row for a (project, distinctId) pair. */
const findPersonlessRow = (distinctId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.personPersonlessIdentities.findFirst({
      where: { projectId, distinctId },
    });
  });

/** Insert a person row directly (the helpers expect parents to exist). */
const seedPerson = (
  values: Partial<DbPerson> & { readonly id: string },
): Effect.Effect<DbPerson, DbError, Db> =>
  Effect.gen(function* () {
    const db = yield* Db;
    const row: DbPerson = {
      archivedAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      deletedAt: null,
      deletionReason: null,
      email: null,
      firstSeenAt: new Date("2026-01-01T00:00:00.000Z"),
      lastSeenAt: new Date("2026-01-01T00:00:00.000Z"),
      mergedIntoPersonId: null,
      name: null,
      origin: PersonOrigin.API,
      primaryDistinctId: null,
      projectId,
      traits: {},
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      ...values,
    } as DbPerson;
    yield* db.insert(persons).values({
      archivedAt: row.archivedAt,
      createdAt: row.createdAt ?? undefined,
      email: row.email,
      firstSeenAt: row.firstSeenAt,
      id: row.id,
      lastSeenAt: row.lastSeenAt,
      mergedIntoPersonId: row.mergedIntoPersonId,
      name: row.name,
      origin: row.origin,
      projectId: row.projectId,
      traits: row.traits ?? {},
    });
    return row;
  });

/**
 * Delete the person / identity / personless rows a test created. Identity and
 * person rows cascade-delete on the project FK in the global sweep, but each
 * test removes its own rows by id/key here so a shared DB never accumulates
 * junk; every delete is `ignore`d so a missing row never fails the finalizer.
 */
const cleanupCreated = (tracked: {
  readonly personIds: ReadonlyArray<string>;
  readonly identityIds: ReadonlyArray<string>;
  readonly distinctIds: ReadonlyArray<string>;
}) =>
  Effect.gen(function* () {
    const db = yield* Db;
    if (tracked.identityIds.length > 0) {
      yield* db
        .delete(personIdentities)
        .where(inArray(personIdentities.id, [...tracked.identityIds]))
        .pipe(Effect.ignore);
    }
    if (tracked.distinctIds.length > 0) {
      yield* db
        .delete(personPersonlessIdentities)
        .where(
          and(
            eq(personPersonlessIdentities.projectId, projectId),
            inArray(personPersonlessIdentities.distinctId, [...tracked.distinctIds]),
          ),
        )
        .pipe(Effect.ignore);
      // Identities created indirectly (e.g. by ensureCanonicalPersonForDistinctId)
      // are keyed by distinctId, so clear those too before their persons go.
      yield* db
        .delete(personIdentities)
        .where(
          and(
            eq(personIdentities.projectId, projectId),
            inArray(personIdentities.distinctId, [...tracked.distinctIds]),
          ),
        )
        .pipe(Effect.ignore);
    }
    if (tracked.personIds.length > 0) {
      yield* db
        .delete(persons)
        .where(inArray(persons.id, [...tracked.personIds]))
        .pipe(Effect.ignore);
    }
  });

/**
 * Wrap a test body with id-collecting trackers; whatever ids/distinctIds were
 * pushed while the body ran are deleted on exit (success or failure) via
 * `Effect.ensuring`, read lazily so the finalizer sees the final lists.
 */
const withIdentityCleanup = <E, R>(
  body: (track: {
    readonly person: (id: string) => void;
    readonly identity: (id: string) => void;
    readonly distinctId: (id: string) => void;
  }) => Effect.Effect<void, E, R>,
): Effect.Effect<void, E, R | Db> => {
  const personIds: string[] = [];
  const identityIds: string[] = [];
  const distinctIds: string[] = [];
  return body({
    person: (id) => personIds.push(id),
    identity: (id) => identityIds.push(id),
    distinctId: (id) => distinctIds.push(id),
  }).pipe(Effect.ensuring(cleanupCreated({ personIds, identityIds, distinctIds })));
};

// ---------------------------------------------------------------------------
// Pure-logic helpers (no infra).
// ---------------------------------------------------------------------------

describe("mergeTraits", () => {
  test(
    "applies setOnce only when the key is absent and setAttributes always override",
    Effect.sync(() => {
      const result = mergeTraits({
        current: { plan: "free", country: "DE" },
        setOnceAttributes: { plan: "ignored", referrer: "newsletter" },
        setAttributes: { country: "US", lastSeen: "today" },
      });
      // setOnce skipped existing `plan`, added new `referrer`.
      expect(result.plan).toBe("free");
      expect(result.referrer).toBe("newsletter");
      // setAttributes overrode `country`, added `lastSeen`.
      expect(result.country).toBe("US");
      expect(result.lastSeen).toBe("today");
    }),
  );

  test(
    "returns the current traits unchanged when both override maps are empty",
    Effect.sync(() => {
      const current = { plan: "pro", seats: 3 };
      const result = mergeTraits({ current, setOnceAttributes: {}, setAttributes: {} });
      expect(result).toEqual(current);
      // Defensive copy — not the same reference.
      expect(result).not.toBe(current);
    }),
  );

  test(
    "setOnce is skipped for an existing key but a later setAttributes still overwrites it",
    Effect.sync(() => {
      const result = mergeTraits({
        current: { tier: "bronze" },
        setOnceAttributes: { tier: "silver" },
        setAttributes: { tier: "gold" },
      });
      expect(result.tier).toBe("gold");
    }),
  );
});

describe("firstDefinedString", () => {
  test(
    "returns the first non-empty string, skipping null/undefined/empty",
    Effect.sync(() => {
      expect(firstDefinedString(undefined, null, "", "first", "second")).toBe("first");
      expect(firstDefinedString(null, undefined, "")).toBeNull();
      expect(firstDefinedString()).toBeNull();
      expect(firstDefinedString("only")).toBe("only");
    }),
  );
});

describe("isAnonymousDistinctId", () => {
  test(
    "is true only for ids carrying the anonymous prefix",
    Effect.sync(() => {
      expect(isAnonymousDistinctId(`${ANON_PREFIX}abc`)).toBe(true);
      expect(isAnonymousDistinctId("user@example.com")).toBe(false);
      expect(isAnonymousDistinctId(`prefixed-${ANON_PREFIX}`)).toBe(false);
    }),
  );
});

// ---------------------------------------------------------------------------
// Personless-identity helpers.
// ---------------------------------------------------------------------------

describe("ensurePersonlessIdentity / findPersonlessIdentity / markPersonlessIdentityMerged", () => {
  test(
    "creates the personless row, is idempotent on a second call, and is found by lookup",
    withIdentityCleanup((track) =>
      Effect.gen(function* () {
        const db = yield* Db;
        const distinctId = anonDistinctId("personless-create");
        track.distinctId(distinctId);

        const before = yield* findPersonlessRow(distinctId);
        expect(before).toBeUndefined();

        yield* inTransaction((tx, m) => m.ensurePersonlessIdentity(tx, { distinctId, projectId }));

        const row = yield* findPersonlessRow(distinctId);
        expect(row).toBeDefined();
        expect(row?.distinctId).toBe(distinctId);
        expect(row?.projectId).toBe(projectId);
        expect(row?.isMerged).toBe(false);

        // Second call must not error (ON DUPLICATE KEY UPDATE) and must not
        // create a duplicate.
        yield* inTransaction((tx, m) => m.ensurePersonlessIdentity(tx, { distinctId, projectId }));

        const found = yield* inTransaction((tx, m) =>
          m.findPersonlessIdentity(tx, { distinctId, projectId }),
        );
        expect(found).toBeDefined();
        expect(found?.distinctId).toBe(distinctId);

        const rows = yield* db
          .select({ distinctId: personPersonlessIdentities.distinctId })
          .from(personPersonlessIdentities)
          .where(
            and(
              eq(personPersonlessIdentities.projectId, projectId),
              eq(personPersonlessIdentities.distinctId, distinctId),
            ),
          );
        expect(rows.length).toBe(1);
      }),
    ).pipe(CoreAuthSession.authenticate()),
  );

  test(
    "findPersonlessIdentity returns undefined when no row exists",
    Effect.gen(function* () {
      const distinctId = anonDistinctId("personless-missing");
      const found = yield* inTransaction((tx, m) =>
        m.findPersonlessIdentity(tx, { distinctId, projectId }),
      );
      expect(found).toBeUndefined();
    }).pipe(CoreAuthSession.authenticate()),
  );

  test(
    "markPersonlessIdentityMerged flips is_merged to true on the persisted row",
    withIdentityCleanup((track) =>
      Effect.gen(function* () {
        const distinctId = anonDistinctId("personless-merge");
        track.distinctId(distinctId);

        yield* inTransaction((tx, m) => m.ensurePersonlessIdentity(tx, { distinctId, projectId }));
        expect((yield* findPersonlessRow(distinctId))?.isMerged).toBe(false);

        yield* inTransaction((tx, m) =>
          m.markPersonlessIdentityMerged(tx, { distinctId, projectId }),
        );

        const after = yield* findPersonlessRow(distinctId);
        expect(after?.isMerged).toBe(true);
      }),
    ).pipe(CoreAuthSession.authenticate()),
  );
});

// ---------------------------------------------------------------------------
// Distinct-id mapping resolution.
// ---------------------------------------------------------------------------

describe("findDistinctIdMapping", () => {
  test(
    "returns the canonical person, mapping, and raw person for an existing mapping",
    withIdentityCleanup((track) =>
      Effect.gen(function* () {
        const distinctId = uniqueDistinctId("mapping-existing");
        track.distinctId(distinctId);

        const resolution = yield* inTransaction((tx, m) =>
          m.ensureCanonicalPersonForDistinctId(tx, {
            context: baseContext(),
            distinctId,
            setAttributes: {},
            setOnceAttributes: {},
          }),
        );
        track.person(resolution.person.id);

        const mapping = yield* inTransaction((tx, m) =>
          m.findDistinctIdMapping(tx, { distinctId, projectId }),
        );
        expect(mapping).toBeDefined();
        expect(mapping?.canonicalPerson.id).toBe(resolution.person.id);
        expect(mapping?.rawPerson.id).toBe(resolution.person.id);
        expect(mapping?.mapping.distinctId).toBe(distinctId);
        expect(mapping?.mapping.personId).toBe(resolution.person.id);
      }),
    ).pipe(CoreAuthSession.authenticate()),
  );

  test(
    "follows the mergedInto chain to the canonical person for a merged source",
    withIdentityCleanup((track) =>
      Effect.gen(function* () {
        const distinctId = uniqueDistinctId("mapping-merged");
        track.distinctId(distinctId);

        const canonicalId = `person_it_canon_${Date.now()}_${seq++}`;
        const mergedSourceId = `person_it_src_${Date.now()}_${seq++}`;
        track.person(canonicalId);
        track.person(mergedSourceId);

        yield* seedPerson({ id: canonicalId });
        // Source person points at the canonical person via mergedIntoPersonId.
        yield* seedPerson({ id: mergedSourceId, mergedIntoPersonId: canonicalId });

        // Map the distinctId to the *merged* source row.
        const identityId = `person_dist_it_${Date.now()}_${seq++}`;
        track.identity(identityId);
        yield* inTransaction((tx, m) =>
          m.upsertPersonIdentity(tx, {
            changedAt: new Date(),
            personId: mergedSourceId,
            distinctId,
            identityId,
            projectId,
            version: 0,
          }),
        );

        const mapping = yield* inTransaction((tx, m) =>
          m.findDistinctIdMapping(tx, { distinctId, projectId }),
        );
        expect(mapping).toBeDefined();
        expect(mapping?.rawPerson.id).toBe(mergedSourceId);
        // Resolution chases mergedIntoPersonId to the canonical row.
        expect(mapping?.canonicalPerson.id).toBe(canonicalId);
      }),
    ).pipe(CoreAuthSession.authenticate()),
  );

  test(
    "returns undefined when no mapping exists",
    Effect.gen(function* () {
      const distinctId = uniqueDistinctId("mapping-absent");
      const mapping = yield* inTransaction((tx, m) =>
        m.findDistinctIdMapping(tx, { distinctId, projectId }),
      );
      expect(mapping).toBeUndefined();
    }).pipe(CoreAuthSession.authenticate()),
  );

  // The "orphaned mapping" branch (a person_identity row whose person_id points
  // at a non-existent person) cannot be constructed cleanly here:
  // person_identity.person_id carries an `onDelete: cascade` FK to person.id, so
  // deleting the person removes the mapping, and inserting a mapping with a
  // dangling person_id is rejected when the FK is enforced. Reaching this branch
  // reliably would require a DB-engine-specific seam (FK enforcement differs
  // between PlanetScale/Vitess and a strict MySQL), so it is deferred rather
  // than asserted with a brittle raw insert.
  vitestTest.todo(
    "findDistinctIdMapping returns undefined for an orphaned mapping whose person row is gone (blocked: person_identity.person_id FK cascade prevents constructing a dangling mapping cleanly)",
  );
});

// ---------------------------------------------------------------------------
// ensureCanonicalPersonForDistinctId.
// ---------------------------------------------------------------------------

describe("ensureCanonicalPersonForDistinctId", () => {
  test(
    "creates a person + Identified mapping with wasCreated=true and a mapping event for a non-anonymous id",
    withIdentityCleanup((track) =>
      Effect.gen(function* () {
        const distinctId = uniqueDistinctId("ensure-identified");
        track.distinctId(distinctId);

        const result = yield* inTransaction((tx, m) =>
          m.ensureCanonicalPersonForDistinctId(tx, {
            context: baseContext(),
            distinctId,
            email: "ensure@voidhash.test",
            name: "Ensure Person",
            setAttributes: { plan: "pro" },
            setOnceAttributes: { source: "import" },
          }),
        );
        track.person(result.person.id);

        expect(result.wasCreated).toBe(true);
        expect(result.mappingEvent).toBeDefined();
        expect(result.mappingEvent?.kind).toBe(PersonIdentityKind.Identified);
        expect(result.mappingEvent?.distinctId).toBe(distinctId);
        expect(result.mappingEvent?.personId).toBe(result.person.id);
        expect(result.person.id.startsWith("person_")).toBe(true);

        const personRow = yield* findPersonRow(result.person.id);
        expect(personRow).toBeDefined();
        expect(personRow?.email).toBe("ensure@voidhash.test");
        expect(personRow?.name).toBe("Ensure Person");
        expect(personRow?.origin).toBe(PersonOrigin.API);
        // Traits persisted as JSON: set + setOnce merged in.
        expect((personRow?.traits as Record<string, unknown>)?.plan).toBe("pro");
        expect((personRow?.traits as Record<string, unknown>)?.source).toBe("import");

        const identityRow = yield* findIdentityByDistinctId(distinctId);
        expect(identityRow).toBeDefined();
        expect(identityRow?.personId).toBe(result.person.id);
        expect(identityRow?.kind).toBe(PersonIdentityKind.Identified);
      }),
    ).pipe(CoreAuthSession.authenticate()),
  );

  test(
    "derives the Anonymous identity kind from an anonymous distinctId",
    withIdentityCleanup((track) =>
      Effect.gen(function* () {
        const distinctId = anonDistinctId("ensure-anon");
        track.distinctId(distinctId);

        const result = yield* inTransaction((tx, m) =>
          m.ensureCanonicalPersonForDistinctId(tx, {
            context: baseContext(),
            distinctId,
            setAttributes: {},
            setOnceAttributes: {},
          }),
        );
        track.person(result.person.id);

        expect(result.mappingEvent?.kind).toBe(PersonIdentityKind.Anonymous);
        const identityRow = yield* findIdentityByDistinctId(distinctId);
        expect(identityRow?.kind).toBe(PersonIdentityKind.Anonymous);
      }),
    ).pipe(CoreAuthSession.authenticate()),
  );

  test(
    "returns the existing person with wasCreated=false and no mapping event when already mapped",
    withIdentityCleanup((track) =>
      Effect.gen(function* () {
        const db = yield* Db;
        const distinctId = uniqueDistinctId("ensure-existing");
        track.distinctId(distinctId);

        const first = yield* inTransaction((tx, m) =>
          m.ensureCanonicalPersonForDistinctId(tx, {
            context: baseContext(),
            distinctId,
            setAttributes: {},
            setOnceAttributes: {},
          }),
        );
        track.person(first.person.id);

        const second = yield* inTransaction((tx, m) =>
          m.ensureCanonicalPersonForDistinctId(tx, {
            context: baseContext(),
            distinctId,
            setAttributes: { ignored: true },
            setOnceAttributes: {},
          }),
        );

        expect(second.wasCreated).toBe(false);
        expect(second.mappingEvent).toBeUndefined();
        expect(second.person.id).toBe(first.person.id);
        expect(second.rawMapping?.distinctId).toBe(distinctId);

        // No second person row was created for the same distinctId.
        const matchingIdentities = yield* db
          .select({ personId: personIdentities.personId })
          .from(personIdentities)
          .where(
            and(
              eq(personIdentities.projectId, projectId),
              eq(personIdentities.distinctId, distinctId),
            ),
          );
        expect(matchingIdentities.length).toBe(1);
      }),
    ).pipe(CoreAuthSession.authenticate()),
  );
});

// ---------------------------------------------------------------------------
// upsertPersonIdentity.
// ---------------------------------------------------------------------------

describe("upsertPersonIdentity", () => {
  test(
    "inserts a new identity row then reuses it via ON DUPLICATE KEY UPDATE, returning the event",
    withIdentityCleanup((track) =>
      Effect.gen(function* () {
        const db = yield* Db;
        const distinctId = uniqueDistinctId("upsert");
        track.distinctId(distinctId);

        const personId = `person_it_upsert_${Date.now()}_${seq++}`;
        track.person(personId);
        yield* seedPerson({ id: personId });

        const identityId = `person_dist_it_${Date.now()}_${seq++}`;
        track.identity(identityId);

        const event = yield* inTransaction((tx, m) =>
          m.upsertPersonIdentity(tx, {
            changedAt: new Date("2026-02-02T00:00:00.000Z"),
            personId,
            distinctId,
            identityId,
            projectId,
            version: 3,
          }),
        );
        expect(event.kind).toBe(PersonIdentityKind.Identified);
        expect(event.version).toBe(3);
        expect(event.distinctId).toBe(distinctId);
        expect(event.changedAt).toBe(new Date("2026-02-02T00:00:00.000Z").toISOString());

        const row = yield* findIdentityRow(identityId);
        expect(row?.distinctId).toBe(distinctId);
        expect(row?.personId).toBe(personId);
        expect(row?.version).toBe(3);

        // Re-point the same (project, distinctId) at a different person + version.
        const otherPersonId = `person_it_upsert2_${Date.now()}_${seq++}`;
        track.person(otherPersonId);
        yield* seedPerson({ id: otherPersonId });

        yield* inTransaction((tx, m) =>
          m.upsertPersonIdentity(tx, {
            changedAt: new Date(),
            personId: otherPersonId,
            distinctId,
            identityId,
            projectId,
            version: 5,
          }),
        );

        const updated = yield* findIdentityByDistinctId(distinctId);
        expect(updated?.personId).toBe(otherPersonId);
        expect(updated?.version).toBe(5);
        // Still one row for the unique (project, distinctId).
        const rows = yield* db
          .select({ id: personIdentities.id })
          .from(personIdentities)
          .where(
            and(
              eq(personIdentities.projectId, projectId),
              eq(personIdentities.distinctId, distinctId),
            ),
          );
        expect(rows.length).toBe(1);
      }),
    ).pipe(CoreAuthSession.authenticate()),
  );
});

// ---------------------------------------------------------------------------
// updatePersonProfile.
// ---------------------------------------------------------------------------

describe("updatePersonProfile", () => {
  test(
    "merges traits, sets name/email, keeps earlier firstSeenAt, advances lastSeenAt",
    withIdentityCleanup((track) =>
      Effect.gen(function* () {
        const personId = `person_it_profile_${Date.now()}_${seq++}`;
        track.person(personId);
        const seeded = yield* seedPerson({
          id: personId,
          email: "old@voidhash.test",
          name: "Old Name",
          firstSeenAt: new Date("2026-01-01T00:00:00.000Z"),
          lastSeenAt: new Date("2026-01-01T00:00:00.000Z"),
          traits: { plan: "free", existing: "keep" },
        });

        const eventTimestamp = new Date("2026-03-03T00:00:00.000Z");
        const updated = yield* inTransaction((tx, m) =>
          m.updatePersonProfile(tx, {
            person: seeded,
            email: "new@voidhash.test",
            eventId: `it-evt-${Date.now()}-${seq++}`,
            eventTimestamp,
            name: "New Name",
            setAttributes: { plan: "pro" },
            setOnceAttributes: { plan: "ignored", referral: "ad" },
          }),
        );

        expect(updated.email).toBe("new@voidhash.test");
        expect(updated.name).toBe("New Name");
        // firstSeenAt preserved (earlier), lastSeenAt advanced (later).
        expect(updated.firstSeenAt?.getTime()).toBe(new Date("2026-01-01T00:00:00.000Z").getTime());
        expect(updated.lastSeenAt?.getTime()).toBe(eventTimestamp.getTime());

        const row = yield* findPersonRow(personId);
        expect(row?.email).toBe("new@voidhash.test");
        expect(row?.name).toBe("New Name");
        const traits = row?.traits as Record<string, unknown>;
        expect(traits.plan).toBe("pro"); // setAttributes overrode
        expect(traits.existing).toBe("keep"); // untouched
        expect(traits.referral).toBe("ad"); // setOnce added
        expect(row?.firstSeenAt?.getTime()).toBe(new Date("2026-01-01T00:00:00.000Z").getTime());
        expect(row?.lastSeenAt?.getTime()).toBe(eventTimestamp.getTime());
      }),
    ).pipe(CoreAuthSession.authenticate()),
  );

  test(
    "leaves name/email untouched for undefined fields but still advances lastSeenAt",
    withIdentityCleanup((track) =>
      Effect.gen(function* () {
        const personId = `person_it_profile_noop_${Date.now()}_${seq++}`;
        track.person(personId);
        const seeded = yield* seedPerson({
          id: personId,
          email: "keep@voidhash.test",
          name: "Keep Name",
          firstSeenAt: new Date("2026-01-01T00:00:00.000Z"),
          lastSeenAt: new Date("2026-01-01T00:00:00.000Z"),
          traits: { a: 1 },
        });

        const eventTimestamp = new Date("2026-04-04T00:00:00.000Z");
        yield* inTransaction((tx, m) =>
          m.updatePersonProfile(tx, {
            person: seeded,
            eventId: `it-evt-${Date.now()}-${seq++}`,
            eventTimestamp,
            setAttributes: {},
            setOnceAttributes: {},
          }),
        );

        const row = yield* findPersonRow(personId);
        expect(row?.email).toBe("keep@voidhash.test");
        expect(row?.name).toBe("Keep Name");
        expect((row?.traits as Record<string, unknown>).a).toBe(1);
        expect(row?.lastSeenAt?.getTime()).toBe(eventTimestamp.getTime());
      }),
    ).pipe(CoreAuthSession.authenticate()),
  );
});

// ---------------------------------------------------------------------------
// archivePerson.
// ---------------------------------------------------------------------------

describe("archivePerson", () => {
  test(
    "sets archivedAt and mergedIntoPersonId on a non-archived person",
    withIdentityCleanup((track) =>
      Effect.gen(function* () {
        const personId = `person_it_archive_${Date.now()}_${seq++}`;
        const targetId = `person_it_archive_tgt_${Date.now()}_${seq++}`;
        track.person(personId);
        track.person(targetId);

        yield* seedPerson({ id: targetId });
        const seeded = yield* seedPerson({ id: personId });

        const eventTimestamp = new Date("2026-05-05T00:00:00.000Z");
        const result = yield* inTransaction((tx, m) =>
          m.archivePerson(tx, {
            person: seeded,
            eventTimestamp,
            mergedIntoPersonId: targetId,
          }),
        );
        expect(result.archivedAt?.getTime()).toBe(eventTimestamp.getTime());
        expect(result.mergedIntoPersonId).toBe(targetId);

        const row = yield* findPersonRow(personId);
        expect(row?.archivedAt).not.toBeNull();
        expect(row?.archivedAt?.getTime()).toBe(eventTimestamp.getTime());
        expect(row?.mergedIntoPersonId).toBe(targetId);
      }),
    ).pipe(CoreAuthSession.authenticate()),
  );

  test(
    "is a no-op (no write) when already archived into the same target",
    withIdentityCleanup((track) =>
      Effect.gen(function* () {
        const personId = `person_it_archive_idem_${Date.now()}_${seq++}`;
        const targetId = `person_it_archive_idem_tgt_${Date.now()}_${seq++}`;
        track.person(personId);
        track.person(targetId);

        yield* seedPerson({ id: targetId });
        const archivedAt = new Date("2026-06-06T00:00:00.000Z");
        const seeded = yield* seedPerson({
          id: personId,
          archivedAt,
          mergedIntoPersonId: targetId,
        });

        const result = yield* inTransaction((tx, m) =>
          m.archivePerson(tx, {
            person: seeded,
            // A different timestamp that must NOT be written because the row is
            // already archived into this target.
            eventTimestamp: new Date("2026-07-07T00:00:00.000Z"),
            mergedIntoPersonId: targetId,
          }),
        );
        // The helper short-circuits and returns the unchanged person.
        expect(result.archivedAt?.getTime()).toBe(archivedAt.getTime());

        const row = yield* findPersonRow(personId);
        expect(row?.archivedAt?.getTime()).toBe(archivedAt.getTime());
        expect(row?.mergedIntoPersonId).toBe(targetId);
      }),
    ).pipe(CoreAuthSession.authenticate()),
  );
});
