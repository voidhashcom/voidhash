/**
 * Integration tests for {@link PerkService}, run against the real backend stack
 * provisioned once by `test/_testing/globalSetup.ts` (live PlanetScale DB +
 * PostgreSQL; only the project schema cache is an in-memory stub).
 *
 * Each test drives the service end-to-end and verifies the *persisted* side
 * effects rather than just the method's return value:
 *  - the `perk` row written / updated / removed in MySQL,
 *  - the matching `audit_log` row (entity, action, actor, change snapshot),
 *  - invalidation of the project's schema cache after a successful write.
 *
 * Conventions used throughout:
 *  - Every test shares the one seeded fixture project ({@link CoreTestFixture})
 *    but cleans up after itself: {@link withPerkCleanup} deletes the perks (and
 *    their append-only audit rows) it created on exit, success or failure. The
 *    global teardown sweep is only a backstop. Assertions stay membership-based
 *    (never exact `getPerks` counts) and slugs are unique per call so a leftover
 *    row from a crashed run can't collide.
 *  - The harness builds a fresh `ProjectSchemaCache` stub per test and shares
 *    that single instance with `SchemaCacheInvalidationService`, so seeding the
 *    cache here and reading it back after a write proves invalidation ran.
 *  - Permission tests reuse the default authenticated effect and re-authenticate
 *    just the call under test via {@link asUnauthorized}; the inner provision
 *    shadows the harness's default full-permission session.
 *  - Typed failures are asserted with `Effect.flip` (project convention),
 *    narrowing the swapped error with `instanceof` before reading its fields.
 */
import { DateTime, Effect } from "effect";
import { describe, expect } from "vitest";

import { generateId } from "@voidhash/core/utils";
import { PerkService, ProjectSchemaCache } from "@voidhash/core/services";
import { ActionForbiddenError, type UserSession } from "@voidhash/core/domain/auth/Auth";
import {
  PerkNotFoundError,
  PerkSlugAlreadyExistsError,
} from "@voidhash/core/domain/perk/Perk";
import {
  AuditLogAction,
  AuditLogActorType,
  AuditLogEntityType,
  Db,
  and,
  auditLogs,
  eq,
  inArray,
  perks,
} from "@voidhash/db";

import { CoreAuthSession } from "@testing/CoreAuthSession";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";
import { CoreTestFixture } from "@testing/CoreTestFixture";

const { test } = CoreIntegrationTestHarness.make();

const projectId = CoreTestFixture.projectId;

const EPOCH = DateTime.toDateUtc(DateTime.makeUnsafe(0));

/** Monotonic counter so slugs stay unique within one run; the cuid2 keeps them unique across runs. */
let slugSeq = 0;
const uniqueSlug = (label: string) => `it-perk-${label}-${generateId("test")}-${slugSeq++}`;

/** Read a perk row straight from the database, bypassing the service. */
const findPerkRow = (id: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.perks.findFirst({ where: { id } });
  });

/** Count perk rows with a given slug in the fixture project. */
const countPerksWithSlug = (slug: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const rows = yield* db
      .select({ id: perks.id })
      .from(perks)
      .where(and(eq(perks.projectId, projectId), eq(perks.slug, slug)));
    return rows.length;
  });

/** All audit-log rows recorded for a given perk entity. */
const findPerkAuditEntries = (entityId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db
      .select()
      .from(auditLogs)
      .where(
        and(eq(auditLogs.entityType, AuditLogEntityType.Perk), eq(auditLogs.entityId, entityId)),
      );
  });

/**
 * Delete the given perks and their audit rows. Audit entries are append-only
 * and survive a `deletePerk`, so they are cleared by entity id too. Each delete
 * is `ignore`d so a missing row never turns the finalizer into a failure.
 */
const cleanupCreatedPerks = (ids: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    if (ids.length === 0) return;
    const db = yield* Db;
    const targets = [...ids];
    yield* db
      .delete(auditLogs)
      .where(
        and(
          eq(auditLogs.entityType, AuditLogEntityType.Perk),
          inArray(auditLogs.entityId, targets),
        ),
      )
      .pipe(Effect.ignore);
    yield* db.delete(perks).where(inArray(perks.id, targets)).pipe(Effect.ignore);
  });

/**
 * Wrap a test body so every perk it creates is removed afterward, regardless of
 * how the test exits. Pass each created perk id to the `track` callback;
 * cleanup reads the collected ids lazily at finalization via `Effect.ensuring`,
 * so it sees every id tracked while the body ran (including on failure).
 */
const withPerkCleanup = <E, R>(
  body: (track: (id: string) => void) => Effect.Effect<void, E, R>,
): Effect.Effect<void, E, R | Db> => {
  const createdIds: string[] = [];
  return body((id) => {
    createdIds.push(id);
  }).pipe(Effect.ensuring(cleanupCreatedPerks(createdIds)));
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
    createdAt: EPOCH,
    email: CoreTestFixture.userEmail,
    emailVerified: true,
    id: CoreTestFixture.userId,
    image: null,
    name: CoreTestFixture.userName,
    role: null,
    updatedAt: EPOCH,
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

describe("PerkService.createPerk", () => {
  test(
    "persists the perk, records a created audit entry, and invalidates the schema cache",
    withPerkCleanup((track) =>
      Effect.gen(function* () {
        const perkService = yield* PerkService;
        const cache = yield* ProjectSchemaCache;

        const name = "Integration Perk";
        const slug = uniqueSlug("create");

        // Seed the cache so a successful invalidation is observable, not vacuously null.
        yield* cache.getByName(projectId).set({ marker: "present" }, 60_000);

        const created = yield* perkService.createPerk({ name, projectId, slug });
        track(created.id);
        expect(created.id.startsWith("perk_")).toBe(true);

        const row = yield* findPerkRow(created.id);
        expect(row).toBeDefined();
        expect(row?.name).toBe(name);
        expect(row?.slug).toBe(slug);
        expect(row?.projectId).toBe(projectId);

        const auditEntries = yield* findPerkAuditEntries(created.id);
        const createdEntry = auditEntries.find((entry) => entry.action === AuditLogAction.Created);
        expect(createdEntry).toBeDefined();
        expect(createdEntry?.entityType).toBe(AuditLogEntityType.Perk);
        expect(createdEntry?.actorUserId).toBe(CoreTestFixture.userId);
        expect(createdEntry?.actorType).toBe(AuditLogActorType.User);
        expect(createdEntry?.changes).toEqual({ snapshot: { name, slug } });

        const cached = yield* cache.getByName(projectId).get();
        expect(cached).toBeNull();
      }),
    ).pipe(Effect.provide(PerkService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "rejects a duplicate slug within the project and writes no second row",
    withPerkCleanup((track) =>
      Effect.gen(function* () {
        const perkService = yield* PerkService;
        const slug = uniqueSlug("duplicate");

        const first = yield* perkService.createPerk({ name: "First", projectId, slug });
        track(first.id);

        const error = yield* Effect.flip(
          perkService.createPerk({ name: "Second", projectId, slug }),
        );
        expect(error).toBeInstanceOf(PerkSlugAlreadyExistsError);
        if (error instanceof PerkSlugAlreadyExistsError) {
          expect(error.slug).toBe(slug);
        }

        expect(yield* countPerksWithSlug(slug)).toBe(1);
      }),
    ).pipe(Effect.provide(PerkService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all and writes nothing",
    // No cleanup wrapper: a forbidden create writes no row.
    Effect.gen(function* () {
      const perkService = yield* PerkService;
      const slug = uniqueSlug("forbidden");

      const error = yield* Effect.flip(
        asUnauthorized(perkService.createPerk({ name: "Nope", projectId, slug })),
      );
      expect(error).toBeInstanceOf(ActionForbiddenError);

      expect(yield* countPerksWithSlug(slug)).toBe(0);
    }).pipe(Effect.provide(PerkService.layer), CoreAuthSession.authenticate()),
  );
});

describe("PerkService.getPerks", () => {
  test(
    "returns perks created under the project",
    withPerkCleanup((track) =>
      Effect.gen(function* () {
        const perkService = yield* PerkService;
        const slugA = uniqueSlug("list-a");
        const slugB = uniqueSlug("list-b");
        const absentSlug = uniqueSlug("list-absent");

        const a = yield* perkService.createPerk({ name: "A", projectId, slug: slugA });
        track(a.id);
        const b = yield* perkService.createPerk({ name: "B", projectId, slug: slugB });
        track(b.id);

        const list = yield* perkService.getPerks(projectId);
        expect(list.some((perk) => perk.id === a.id && perk.slug === slugA)).toBe(true);
        expect(list.some((perk) => perk.id === b.id && perk.slug === slugB)).toBe(true);
        expect(list.some((perk) => perk.slug === absentSlug)).toBe(false);
      }),
    ).pipe(Effect.provide(PerkService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all",
    Effect.gen(function* () {
      const perkService = yield* PerkService;
      const error = yield* Effect.flip(asUnauthorized(perkService.getPerks(projectId)));
      expect(error).toBeInstanceOf(ActionForbiddenError);
    }).pipe(Effect.provide(PerkService.layer), CoreAuthSession.authenticate()),
  );
});

describe("PerkService.getPerkById", () => {
  test(
    "returns the matching perk",
    withPerkCleanup((track) =>
      Effect.gen(function* () {
        const perkService = yield* PerkService;
        const slug = uniqueSlug("by-id");
        const created = yield* perkService.createPerk({ name: "Lookup", projectId, slug });
        track(created.id);

        const perk = yield* perkService.getPerkById(created.id);
        expect(perk.id).toBe(created.id);
        expect(perk.name).toBe("Lookup");
        expect(perk.slug).toBe(slug);
        expect(perk.projectId).toBe(projectId);
      }),
    ).pipe(Effect.provide(PerkService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "fails with PerkNotFoundError for an unknown id",
    Effect.gen(function* () {
      const perkService = yield* PerkService;
      const error = yield* Effect.flip(
        perkService.getPerkById(`perk_missing_${generateId("test")}`),
      );
      expect(error).toBeInstanceOf(PerkNotFoundError);
    }).pipe(Effect.provide(PerkService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids access to a perk the caller is not authorized for",
    withPerkCleanup((track) =>
      Effect.gen(function* () {
        const perkService = yield* PerkService;
        const slug = uniqueSlug("by-id-forbidden");
        const created = yield* perkService.createPerk({ name: "Guarded", projectId, slug });
        track(created.id);

        const error = yield* Effect.flip(asUnauthorized(perkService.getPerkById(created.id)));
        expect(error).toBeInstanceOf(ActionForbiddenError);
      }),
    ).pipe(Effect.provide(PerkService.layer), CoreAuthSession.authenticate()),
  );
});

describe("PerkService.updatePerk", () => {
  test(
    "changes name and slug, records an updated audit entry, and invalidates the schema cache",
    withPerkCleanup((track) =>
      Effect.gen(function* () {
        const perkService = yield* PerkService;
        const cache = yield* ProjectSchemaCache;

        const created = yield* perkService.createPerk({
          name: "Before",
          projectId,
          slug: uniqueSlug("update-before"),
        });
        track(created.id);

        const newName = "After";
        const newSlug = uniqueSlug("update-after");
        yield* cache.getByName(projectId).set({ marker: "present" }, 60_000);

        const result = yield* perkService.updatePerk({
          id: created.id,
          projectId,
          name: newName,
          slug: newSlug,
        });
        expect(result.id).toBe(created.id);

        const row = yield* findPerkRow(created.id);
        expect(row?.name).toBe(newName);
        expect(row?.slug).toBe(newSlug);

        const auditEntries = yield* findPerkAuditEntries(created.id);
        const updatedEntry = auditEntries.find((entry) => entry.action === AuditLogAction.Updated);
        expect(updatedEntry).toBeDefined();
        expect(updatedEntry?.changes).toEqual({ snapshot: { name: newName, slug: newSlug } });

        const cached = yield* cache.getByName(projectId).get();
        expect(cached).toBeNull();
      }),
    ).pipe(Effect.provide(PerkService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "allows renaming a perk while keeping its own slug",
    withPerkCleanup((track) =>
      Effect.gen(function* () {
        const perkService = yield* PerkService;
        const slug = uniqueSlug("update-self");
        const created = yield* perkService.createPerk({ name: "Keep", projectId, slug });
        track(created.id);

        // Same slug as the perk's own — must not trip the uniqueness guard against itself.
        const result = yield* perkService.updatePerk({
          id: created.id,
          projectId,
          name: "Keep Renamed",
          slug,
        });
        expect(result.id).toBe(created.id);

        const row = yield* findPerkRow(created.id);
        expect(row?.name).toBe("Keep Renamed");
        expect(row?.slug).toBe(slug);
      }),
    ).pipe(Effect.provide(PerkService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "rejects a slug already used by another perk and leaves the target unchanged",
    withPerkCleanup((track) =>
      Effect.gen(function* () {
        const perkService = yield* PerkService;
        const slugA = uniqueSlug("update-collide-a");
        const slugB = uniqueSlug("update-collide-b");

        const a = yield* perkService.createPerk({ name: "A", projectId, slug: slugA });
        track(a.id);
        const b = yield* perkService.createPerk({ name: "B", projectId, slug: slugB });
        track(b.id);

        const error = yield* Effect.flip(
          perkService.updatePerk({ id: b.id, projectId, name: "B", slug: slugA }),
        );
        expect(error).toBeInstanceOf(PerkSlugAlreadyExistsError);
        if (error instanceof PerkSlugAlreadyExistsError) {
          expect(error.slug).toBe(slugA);
        }

        const row = yield* findPerkRow(b.id);
        expect(row?.slug).toBe(slugB);
      }),
    ).pipe(Effect.provide(PerkService.layer), CoreAuthSession.authenticate()),
  );
});

describe("PerkService.deletePerk", () => {
  test(
    "removes the perk, records a deleted audit entry, and invalidates the schema cache",
    withPerkCleanup((track) =>
      Effect.gen(function* () {
        const perkService = yield* PerkService;
        const cache = yield* ProjectSchemaCache;

        const created = yield* perkService.createPerk({
          name: "Doomed",
          projectId,
          slug: uniqueSlug("delete"),
        });
        track(created.id);
        yield* cache.getByName(projectId).set({ marker: "present" }, 60_000);

        yield* perkService.deletePerk({ perkId: created.id });

        const row = yield* findPerkRow(created.id);
        expect(row).toBeUndefined();

        const lookup = yield* Effect.flip(perkService.getPerkById(created.id));
        expect(lookup).toBeInstanceOf(PerkNotFoundError);

        const auditEntries = yield* findPerkAuditEntries(created.id);
        const deletedEntry = auditEntries.find((entry) => entry.action === AuditLogAction.Deleted);
        expect(deletedEntry).toBeDefined();
        expect(deletedEntry?.actorUserId).toBe(CoreTestFixture.userId);

        const cached = yield* cache.getByName(projectId).get();
        expect(cached).toBeNull();
      }),
    ).pipe(Effect.provide(PerkService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "fails with PerkNotFoundError for an unknown id",
    Effect.gen(function* () {
      const perkService = yield* PerkService;
      const error = yield* Effect.flip(
        perkService.deletePerk({ perkId: `perk_missing_${generateId("test")}` }),
      );
      expect(error).toBeInstanceOf(PerkNotFoundError);
    }).pipe(Effect.provide(PerkService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all and retains the perk",
    withPerkCleanup((track) =>
      Effect.gen(function* () {
        const perkService = yield* PerkService;
        const created = yield* perkService.createPerk({
          name: "Protected",
          projectId,
          slug: uniqueSlug("delete-forbidden"),
        });
        track(created.id);

        const error = yield* Effect.flip(
          asUnauthorized(perkService.deletePerk({ perkId: created.id })),
        );
        expect(error).toBeInstanceOf(ActionForbiddenError);

        const row = yield* findPerkRow(created.id);
        expect(row).toBeDefined();
      }),
    ).pipe(Effect.provide(PerkService.layer), CoreAuthSession.authenticate()),
  );
});
