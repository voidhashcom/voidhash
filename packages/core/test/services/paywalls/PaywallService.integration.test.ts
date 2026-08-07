/**
 * Integration tests for {@link PaywallService}, run against the real backend
 * stack provisioned once by `test/_testing/globalSetup.ts` (live PlanetScale DB
 * + ClickHouse + WorkOS; only the project schema cache is an in-memory stub).
 *
 * Each test drives the service end-to-end and verifies the *persisted* side
 * effects rather than just the method's return value:
 *  - the `paywall` row written / removed in MySQL,
 *  - the matching append-only `audit_log` row (entity, action, actor).
 *
 * Conventions mirror `PerkService.integration.test.ts`:
 *  - Every test shares the one seeded fixture project ({@link CoreTestFixture})
 *    but cleans up after itself: {@link withPaywallCleanup} deletes the paywalls
 *    (and their append-only audit rows) it created on exit, success or failure.
 *    The global teardown sweep is only a backstop. Assertions stay
 *    membership-based (never exact `getPaywalls` counts) and slugs are unique
 *    per call so a leftover row from a crashed run can't collide.
 *  - Permission tests reuse the default authenticated effect and re-authenticate
 *    just the call under test via {@link asUnauthorized}; the inner provision
 *    shadows the harness's default full-permission session.
 *  - Typed failures are asserted with `Effect.flip` (project convention),
 *    narrowing the swapped error with `instanceof` before reading its fields,
 *    and always paired with a DB-state assertion on the failure path.
 *
 * Note: `getPaywallById`/`deletePaywall` fetch the row *before* the permission
 * check, then authorize against the fetched row's `projectId`. A paywall under a
 * different project therefore reaches the permission check and is rejected — the
 * "belongs to a different project" case below seeds exactly that via a raw
 * insert under a fabricated project id the session has no access to.
 */
import { Clock, DateTime, Effect } from "effect";
import { describe, expect } from "vitest";

import { PaywallService } from "@voidhash/core/services";
import { ActionForbiddenError, type UserSession } from "@voidhash/core/domain/auth/Auth";
import {
  PaywallNotFoundError,
  PaywallSlugAlreadyExistsError,
} from "@voidhash/core/domain/paywall/Paywall";
import {
  AuditLogAction,
  AuditLogActorType,
  AuditLogEntityType,
  Db,
  and,
  auditLogs,
  eq,
  inArray,
  paywalls,
} from "@voidhash/db";

import { CoreAuthSession } from "@testing/CoreAuthSession";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";
import { CoreTestFixture } from "@testing/CoreTestFixture";

const { test } = CoreIntegrationTestHarness.make();

const projectId = CoreTestFixture.projectId;

const EPOCH = DateTime.toDateUtc(DateTime.makeUnsafe(0));

/** Monotonic counter so slugs stay unique even within the same millisecond. */
let slugSeq = 0;
const uniqueSlug = (label: string) =>
  Effect.map(Clock.currentTimeMillis, (now) => `it-paywall-${label}-${now}-${slugSeq++}`);

/** Read a paywall row straight from the database, bypassing the service. */
const findPaywallRow = (id: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.paywalls.findFirst({ where: { id } });
  });

/** Count paywall rows with a given slug in the fixture project. */
const countPaywallsWithSlug = (slug: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const rows = yield* db
      .select({ id: paywalls.id })
      .from(paywalls)
      .where(and(eq(paywalls.projectId, projectId), eq(paywalls.slug, slug)));
    return rows.length;
  });

/** All audit-log rows recorded for a given paywall entity. */
const findPaywallAuditEntries = (entityId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db
      .select()
      .from(auditLogs)
      .where(
        and(eq(auditLogs.entityType, AuditLogEntityType.Paywall), eq(auditLogs.entityId, entityId)),
      );
  });

/** Insert a paywall row directly, bypassing the service (and its auth check). */
const insertPaywallRow = (row: {
  readonly id: string;
  readonly name: string;
  readonly projectId: string;
  readonly slug: string;
}) =>
  Effect.gen(function* () {
    const db = yield* Db;
    yield* db.insert(paywalls).values(row);
  });

/**
 * Delete the given paywalls and their audit rows. Audit entries are append-only
 * and survive a `deletePaywall`, so they are cleared by entity id too. Each
 * delete is `ignore`d so a missing row never turns the finalizer into a failure.
 */
const cleanupCreatedPaywalls = (ids: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    if (ids.length === 0) return;
    const db = yield* Db;
    const targets = [...ids];
    yield* db
      .delete(auditLogs)
      .where(
        and(
          eq(auditLogs.entityType, AuditLogEntityType.Paywall),
          inArray(auditLogs.entityId, targets),
        ),
      )
      .pipe(Effect.ignore);
    yield* db.delete(paywalls).where(inArray(paywalls.id, targets)).pipe(Effect.ignore);
  });

/**
 * Wrap a test body so every paywall it creates is removed afterward, regardless
 * of how the test exits. Pass each created paywall id to the `track` callback;
 * cleanup reads the collected ids lazily at finalization via `Effect.ensuring`,
 * so it sees every id tracked while the body ran (including on failure).
 */
const withPaywallCleanup = <E, R>(
  body: (track: (id: string) => void) => Effect.Effect<void, E, R>,
): Effect.Effect<void, E, R | Db> => {
  const createdIds: string[] = [];
  return body((id) => {
    createdIds.push(id);
  }).pipe(Effect.ensuring(cleanupCreatedPaywalls(createdIds)));
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

describe("PaywallService.getPaywalls", () => {
  test(
    "returns paywalls created under the project",
    withPaywallCleanup((track) =>
      Effect.gen(function* () {
        const paywallService = yield* PaywallService;
        const slugA = yield* uniqueSlug("list-a");
        const slugB = yield* uniqueSlug("list-b");
        const absentSlug = yield* uniqueSlug("list-absent");

        const a = yield* paywallService.createPaywall({ name: "A", projectId, slug: slugA });
        track(a.id);
        const b = yield* paywallService.createPaywall({ name: "B", projectId, slug: slugB });
        track(b.id);

        const list = yield* paywallService.getPaywalls(projectId);
        expect(list.some((pw) => pw.id === a.id && pw.slug === slugA)).toBe(true);
        expect(list.some((pw) => pw.id === b.id && pw.slug === slugB)).toBe(true);
        expect(list.some((pw) => pw.slug === absentSlug)).toBe(false);
      }),
    ).pipe(Effect.provide(PaywallService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "returns a list (possibly empty) for a project with no matching slug",
    Effect.gen(function* () {
      const paywallService = yield* PaywallService;
      const absentSlug = yield* uniqueSlug("empty");

      // The fixture project is shared, so other tests may have left rows; assert
      // the contract (an array) and that our never-created slug is absent.
      const list = yield* paywallService.getPaywalls(projectId);
      expect(Array.isArray(list)).toBe(true);
      expect(list.some((pw) => pw.slug === absentSlug)).toBe(false);
    }).pipe(Effect.provide(PaywallService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all",
    Effect.gen(function* () {
      const paywallService = yield* PaywallService;
      const error = yield* Effect.flip(asUnauthorized(paywallService.getPaywalls(projectId)));
      expect(error).toBeInstanceOf(ActionForbiddenError);
    }).pipe(Effect.provide(PaywallService.layer), CoreAuthSession.authenticate()),
  );
});

describe("PaywallService.getPaywallById", () => {
  test(
    "returns the matching paywall after passing the post-fetch permission check",
    withPaywallCleanup((track) =>
      Effect.gen(function* () {
        const paywallService = yield* PaywallService;
        const slug = yield* uniqueSlug("by-id");
        const created = yield* paywallService.createPaywall({ name: "Lookup", projectId, slug });
        track(created.id);

        const paywall = yield* paywallService.getPaywallById(created.id);
        expect(paywall.id).toBe(created.id);
        expect(paywall.name).toBe("Lookup");
        expect(paywall.slug).toBe(slug);
        expect(paywall.projectId).toBe(projectId);
      }),
    ).pipe(Effect.provide(PaywallService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "fails with PaywallNotFoundError for an unknown id",
    Effect.gen(function* () {
      const paywallService = yield* PaywallService;
      const missingId = `pw_missing_${yield* Clock.currentTimeMillis}`;
      const error = yield* Effect.flip(paywallService.getPaywallById(missingId));
      expect(error).toBeInstanceOf(PaywallNotFoundError);

      // Nothing was created for the missing id.
      const row = yield* findPaywallRow(missingId);
      expect(row).toBeUndefined();
    }).pipe(Effect.provide(PaywallService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids access to a paywall belonging to a different project",
    withPaywallCleanup((track) =>
      Effect.gen(function* () {
        const paywallService = yield* PaywallService;
        // Seed a paywall under a project the default session has no access to.
        // The fetch succeeds, then the post-fetch permission check against the
        // foreign projectId rejects with ActionForbiddenError.
        const nowMillis = yield* Clock.currentTimeMillis;
        const foreignProjectId = `it-other-project-${nowMillis}-${slugSeq++}`;
        const id = `pw_foreign_${nowMillis}_${slugSeq++}`;
        yield* insertPaywallRow({
          id,
          name: "Foreign",
          projectId: foreignProjectId,
          slug: yield* uniqueSlug("foreign"),
        });
        track(id);

        const error = yield* Effect.flip(paywallService.getPaywallById(id));
        expect(error).toBeInstanceOf(ActionForbiddenError);

        // The row is untouched by the read.
        const row = yield* findPaywallRow(id);
        expect(row?.projectId).toBe(foreignProjectId);
      }),
    ).pipe(Effect.provide(PaywallService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all even for an accessible paywall",
    withPaywallCleanup((track) =>
      Effect.gen(function* () {
        const paywallService = yield* PaywallService;
        const slug = yield* uniqueSlug("by-id-forbidden");
        const created = yield* paywallService.createPaywall({ name: "Guarded", projectId, slug });
        track(created.id);

        const error = yield* Effect.flip(asUnauthorized(paywallService.getPaywallById(created.id)));
        expect(error).toBeInstanceOf(ActionForbiddenError);
      }),
    ).pipe(Effect.provide(PaywallService.layer), CoreAuthSession.authenticate()),
  );
});

describe("PaywallService.createPaywall", () => {
  test(
    "persists the paywall and records a created audit entry",
    withPaywallCleanup((track) =>
      Effect.gen(function* () {
        const paywallService = yield* PaywallService;

        const name = "Integration Paywall";
        const slug = yield* uniqueSlug("create");

        const created = yield* paywallService.createPaywall({ name, projectId, slug });
        track(created.id);
        // generateId("paywall") uses the "pw_" prefix.
        expect(created.id.startsWith("pw_")).toBe(true);

        const row = yield* findPaywallRow(created.id);
        expect(row).toBeDefined();
        expect(row?.name).toBe(name);
        expect(row?.slug).toBe(slug);
        expect(row?.projectId).toBe(projectId);

        const auditEntries = yield* findPaywallAuditEntries(created.id);
        const createdEntry = auditEntries.find((entry) => entry.action === AuditLogAction.Created);
        expect(createdEntry).toBeDefined();
        expect(createdEntry?.entityType).toBe(AuditLogEntityType.Paywall);
        expect(createdEntry?.projectId).toBe(projectId);
        expect(createdEntry?.actorUserId).toBe(CoreTestFixture.userId);
        expect(createdEntry?.actorType).toBe(AuditLogActorType.User);
        expect(createdEntry?.changes).toEqual({ snapshot: { name, slug } });
      }),
    ).pipe(Effect.provide(PaywallService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "rejects a duplicate slug within the project and writes no second row",
    withPaywallCleanup((track) =>
      Effect.gen(function* () {
        const paywallService = yield* PaywallService;
        const slug = yield* uniqueSlug("duplicate");

        const first = yield* paywallService.createPaywall({ name: "First", projectId, slug });
        track(first.id);

        const error = yield* Effect.flip(
          paywallService.createPaywall({ name: "Second", projectId, slug }),
        );
        expect(error).toBeInstanceOf(PaywallSlugAlreadyExistsError);
        if (error instanceof PaywallSlugAlreadyExistsError) {
          expect(error.slug).toBe(slug);
        }

        expect(yield* countPaywallsWithSlug(slug)).toBe(1);
      }),
    ).pipe(Effect.provide(PaywallService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all and writes nothing",
    // No cleanup wrapper: a forbidden create writes no row.
    Effect.gen(function* () {
      const paywallService = yield* PaywallService;
      const slug = yield* uniqueSlug("forbidden");

      const error = yield* Effect.flip(
        asUnauthorized(paywallService.createPaywall({ name: "Nope", projectId, slug })),
      );
      expect(error).toBeInstanceOf(ActionForbiddenError);

      expect(yield* countPaywallsWithSlug(slug)).toBe(0);
    }).pipe(Effect.provide(PaywallService.layer), CoreAuthSession.authenticate()),
  );
});

describe("PaywallService.deletePaywall", () => {
  test(
    "removes the paywall and records a deleted audit entry",
    withPaywallCleanup((track) =>
      Effect.gen(function* () {
        const paywallService = yield* PaywallService;

        const created = yield* paywallService.createPaywall({
          name: "Doomed",
          projectId,
          slug: yield* uniqueSlug("delete"),
        });
        track(created.id);

        yield* paywallService.deletePaywall({ paywallId: created.id });

        // State assertion: the row is gone after delete.
        const row = yield* findPaywallRow(created.id);
        expect(row).toBeUndefined();

        const lookup = yield* Effect.flip(paywallService.getPaywallById(created.id));
        expect(lookup).toBeInstanceOf(PaywallNotFoundError);

        // The append-only deleted audit entry survives the row delete.
        const auditEntries = yield* findPaywallAuditEntries(created.id);
        const deletedEntry = auditEntries.find((entry) => entry.action === AuditLogAction.Deleted);
        expect(deletedEntry).toBeDefined();
        expect(deletedEntry?.entityType).toBe(AuditLogEntityType.Paywall);
        expect(deletedEntry?.projectId).toBe(projectId);
        expect(deletedEntry?.actorUserId).toBe(CoreTestFixture.userId);
        expect(deletedEntry?.actorType).toBe(AuditLogActorType.User);
      }),
    ).pipe(Effect.provide(PaywallService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "fails with PaywallNotFoundError for an unknown id",
    Effect.gen(function* () {
      const paywallService = yield* PaywallService;
      const error = yield* Effect.flip(
        paywallService.deletePaywall({ paywallId: `pw_missing_${yield* Clock.currentTimeMillis}` }),
      );
      expect(error).toBeInstanceOf(PaywallNotFoundError);
    }).pipe(Effect.provide(PaywallService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all and retains the paywall",
    withPaywallCleanup((track) =>
      Effect.gen(function* () {
        const paywallService = yield* PaywallService;
        const created = yield* paywallService.createPaywall({
          name: "Protected",
          projectId,
          slug: yield* uniqueSlug("delete-forbidden"),
        });
        track(created.id);

        const error = yield* Effect.flip(
          asUnauthorized(paywallService.deletePaywall({ paywallId: created.id })),
        );
        expect(error).toBeInstanceOf(ActionForbiddenError);

        // The paywall is untouched by the forbidden delete.
        const row = yield* findPaywallRow(created.id);
        expect(row).toBeDefined();
        expect(row?.id).toBe(created.id);
      }),
    ).pipe(Effect.provide(PaywallService.layer), CoreAuthSession.authenticate()),
  );
});

describe("PaywallService.renamePaywall", () => {
  test(
    "updates the name, keeps the slug fixed, and records an updated audit entry",
    withPaywallCleanup((track) =>
      Effect.gen(function* () {
        const paywallService = yield* PaywallService;
        const slug = yield* uniqueSlug("rename");
        const created = yield* paywallService.createPaywall({
          name: "Original",
          projectId,
          slug,
        });
        track(created.id);

        yield* paywallService.renamePaywall({ name: "Renamed", paywallId: created.id });

        // The name changed but the slug is immutable across a rename.
        const row = yield* findPaywallRow(created.id);
        expect(row?.name).toBe("Renamed");
        expect(row?.slug).toBe(slug);

        const auditEntries = yield* findPaywallAuditEntries(created.id);
        const updatedEntry = auditEntries.find((entry) => entry.action === AuditLogAction.Updated);
        expect(updatedEntry).toBeDefined();
        expect(updatedEntry?.changes).toEqual({
          after: { name: "Renamed" },
          before: { name: "Original" },
        });
      }),
    ).pipe(Effect.provide(PaywallService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "fails with PaywallNotFoundError for an unknown id",
    Effect.gen(function* () {
      const paywallService = yield* PaywallService;
      const error = yield* Effect.flip(
        paywallService.renamePaywall({
          name: "X",
          paywallId: `pw_missing_${yield* Clock.currentTimeMillis}`,
        }),
      );
      expect(error).toBeInstanceOf(PaywallNotFoundError);
    }).pipe(Effect.provide(PaywallService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all and retains the original name",
    withPaywallCleanup((track) =>
      Effect.gen(function* () {
        const paywallService = yield* PaywallService;
        const created = yield* paywallService.createPaywall({
          name: "Keep",
          projectId,
          slug: yield* uniqueSlug("rename-forbidden"),
        });
        track(created.id);

        const error = yield* Effect.flip(
          asUnauthorized(paywallService.renamePaywall({ name: "Hacked", paywallId: created.id })),
        );
        expect(error).toBeInstanceOf(ActionForbiddenError);

        const row = yield* findPaywallRow(created.id);
        expect(row?.name).toBe("Keep");
      }),
    ).pipe(Effect.provide(PaywallService.layer), CoreAuthSession.authenticate()),
  );
});

describe("PaywallService.archivePaywall / restorePaywall", () => {
  test(
    "archiving hides the paywall from the default list but keeps it with includeArchived",
    withPaywallCleanup((track) =>
      Effect.gen(function* () {
        const paywallService = yield* PaywallService;
        const slug = yield* uniqueSlug("archive");
        const created = yield* paywallService.createPaywall({
          name: "ToArchive",
          projectId,
          slug,
        });
        track(created.id);

        yield* paywallService.archivePaywall({ paywallId: created.id });

        // archivedAt is stamped on the row.
        const row = yield* findPaywallRow(created.id);
        expect(row?.archivedAt).toBeInstanceOf(Date);

        // Dropped from the default listing, present when archived are included.
        const activeList = yield* paywallService.getPaywalls(projectId);
        expect(activeList.some((pw) => pw.id === created.id)).toBe(false);
        const withArchived = yield* paywallService.getPaywalls(projectId, true);
        expect(withArchived.some((pw) => pw.id === created.id)).toBe(true);

        const auditEntries = yield* findPaywallAuditEntries(created.id);
        expect(
          auditEntries.some((entry) => entry.action === AuditLogAction.Archived),
        ).toBe(true);
      }),
    ).pipe(Effect.provide(PaywallService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "restoring clears archivedAt and returns the paywall to the default list",
    withPaywallCleanup((track) =>
      Effect.gen(function* () {
        const paywallService = yield* PaywallService;
        const created = yield* paywallService.createPaywall({
          name: "ToRestore",
          projectId,
          slug: yield* uniqueSlug("restore"),
        });
        track(created.id);

        yield* paywallService.archivePaywall({ paywallId: created.id });
        yield* paywallService.restorePaywall({ paywallId: created.id });

        const row = yield* findPaywallRow(created.id);
        expect(row?.archivedAt).toBeNull();

        const activeList = yield* paywallService.getPaywalls(projectId);
        expect(activeList.some((pw) => pw.id === created.id)).toBe(true);

        const auditEntries = yield* findPaywallAuditEntries(created.id);
        expect(
          auditEntries.some((entry) => entry.action === AuditLogAction.Restored),
        ).toBe(true);
      }),
    ).pipe(Effect.provide(PaywallService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids archiving for callers without project:all and leaves the row active",
    withPaywallCleanup((track) =>
      Effect.gen(function* () {
        const paywallService = yield* PaywallService;
        const created = yield* paywallService.createPaywall({
          name: "Guarded",
          projectId,
          slug: yield* uniqueSlug("archive-forbidden"),
        });
        track(created.id);

        const error = yield* Effect.flip(
          asUnauthorized(paywallService.archivePaywall({ paywallId: created.id })),
        );
        expect(error).toBeInstanceOf(ActionForbiddenError);

        const row = yield* findPaywallRow(created.id);
        expect(row?.archivedAt).toBeNull();
      }),
    ).pipe(Effect.provide(PaywallService.layer), CoreAuthSession.authenticate()),
  );
});
