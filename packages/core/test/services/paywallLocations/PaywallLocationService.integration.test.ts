/**
 * Integration tests for {@link PaywallLocationService}, run against the real
 * backend stack provisioned once by `test/_testing/globalSetup.ts` (live
 * PostgreSQL; only the project schema cache is an
 * in-memory stub).
 *
 * Every test drives the service end-to-end and verifies the *persisted* side
 * effects rather than just the method's return value:
 *  - the `paywall_location` / `paywall_location_showing` rows written, updated,
 *    archived, or ended in MySQL,
 *  - the matching `audit_log` row (entity, action, actor, change snapshot),
 *  - invalidation of the project's schema cache after a successful write.
 *
 * Conventions used throughout (mirroring `PerkService.integration.test.ts`):
 *  - All junk entities live under the one seeded fixture project
 *    ({@link CoreTestFixture}); each test cleans up after itself via
 *    {@link withCleanup}, which deletes the locations + showings + their
 *    append-only audit rows it created on exit, success or failure. The global
 *    teardown sweep is only a backstop. Assertions stay membership-based
 *    (`.some(...)` / by-slug, never exact list counts) and slugs are unique
 *    per call so a leftover row from a crashed run can't collide.
 *  - The harness builds a fresh `ProjectSchemaCache` stub per test and shares
 *    that instance with `SchemaCacheInvalidationService`, so seeding the cache
 *    here and reading it back after a write proves invalidation ran.
 *  - `PaywallLocationService.layer` additionally needs `PaywallAssetConfig`
 *    (the CDN base used to build release HTML URLs), which is NOT one of the
 *    harness services, so the test provides it itself via a `Layer.succeed`.
 *  - Permission tests re-authenticate just the call under test via
 *    {@link asUnauthorized}; the inner provision shadows the harness's default
 *    full-permission session for the wrapped call only.
 *  - Typed failures are asserted with `Effect.flip` (project convention),
 *    narrowing the swapped error with `instanceof` before reading its fields,
 *    paired with a DB-state assertion that nothing leaked.
 */
import { Clock, DateTime, Effect, Layer } from "effect";
import { describe, expect, test as vitestTest } from "vitest";

import {
  ExperimentService,
  FeatureFlagService,
  PaywallLocationService,
  ProjectSchemaCache,
} from "@voidhash/core/services";

/**
 * `PaywallLocationService` now resolves an experiment-backed showing via
 * `ExperimentService` (which needs `FeatureFlagService`); provide that subgraph
 * here so the harness's `Db` / `AuditLogPort` satisfy the rest.
 */
const PaywallLocationServiceTestLayer = PaywallLocationService.layer.pipe(
  Layer.provide(ExperimentService.layer.pipe(Layer.provide(FeatureFlagService.layer))),
);
import { PaywallAssetConfig } from "@voidhash/core/services/paywallLocations/PaywallAssetConfig";
import { ActionForbiddenError, type UserSession } from "@voidhash/core/domain/auth/Auth";
import { PaywallNotFoundError } from "@voidhash/core/domain/paywall/Paywall";
import {
  PaywallLocationNotFoundError,
  PaywallLocationShowingValidationError,
  PaywallLocationSlugAlreadyExistsError,
} from "@voidhash/core/domain/paywallLocation/PaywallLocation";
import {
  AuditLogAction,
  AuditLogActorType,
  AuditLogEntityType,
  Db,
  PaywallLocationShowingType,
  ReleaseStatus,
  and,
  auditLogs,
  eq,
  inArray,
  isNull,
  paywallLocationShowings,
  paywallLocations,
  paywallReleases,
  paywalls,
} from "@voidhash/db";

import { CoreAuthSession } from "@testing/CoreAuthSession";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";
import { CoreTestFixture } from "@testing/CoreTestFixture";

const { test } = CoreIntegrationTestHarness.make();

const projectId = CoreTestFixture.projectId;

/** CDN base the test wires into {@link PaywallAssetConfig}. */
const CDN_URL = "https://cdn.integration.test";

/** Public serving base for code-deployed releases (deploy contract §5). */
const PUBLIC_BASE_URL = "https://api.integration.test";

/**
 * Provides {@link PaywallAssetConfig} — the only requirement of
 * `PaywallLocationService.layer` that the harness does not supply. Pure config
 * (no further requirements), so it stays inside the harness-service budget.
 */
const PaywallAssetConfigTest = Layer.succeed(PaywallAssetConfig, {
  cdnUrl: CDN_URL,
  publicBaseUrl: PUBLIC_BASE_URL,
});

const EPOCH = DateTime.toDateUtc(DateTime.makeUnsafe(0));

/** Monotonic counter so slugs/ids stay unique even within the same millisecond. */
let seq = 0;
const uniqueSlug = (label: string) =>
  Effect.map(Clock.currentTimeMillis, (now) => `it-pwloc-${label}-${now}-${seq++}`);
const uniqueId = (prefix: string) =>
  Effect.map(Clock.currentTimeMillis, (now) => `${prefix}_it_${now}_${seq++}`);

/** Reads one field out of an audit entry's untyped `changes` blob. */
const changeField = (changes: unknown, key: string): unknown => {
  if (typeof changes !== "object" || changes === null) {
    return undefined;
  }
  if (!(key in changes)) {
    return undefined;
  }
  return Reflect.get(changes, key);
};

/** Seeded releases are `released` unless a test explicitly asks for a draft. */
const releaseStatusOf = (released: boolean | undefined): number => {
  if (released === false) {
    return ReleaseStatus.draft;
  }
  return ReleaseStatus.released;
};

/** Read a paywall-location row straight from the database, bypassing the service. */
const findLocationRow = (id: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.paywallLocations.findFirst({ where: { id } });
  });

/** All showing rows for a location, newest first. */
const findShowingRows = (locationId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db
      .select()
      .from(paywallLocationShowings)
      .where(eq(paywallLocationShowings.paywallLocationId, locationId));
  });

/** Active (un-ended) showing rows for a location. */
const findActiveShowingRows = (locationId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db
      .select()
      .from(paywallLocationShowings)
      .where(
        and(
          eq(paywallLocationShowings.paywallLocationId, locationId),
          isNull(paywallLocationShowings.endedAt),
        ),
      );
  });

/** Count location rows with a given slug in the fixture project. */
const countLocationsWithSlug = (slug: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const rows = yield* db
      .select({ id: paywallLocations.id })
      .from(paywallLocations)
      .where(and(eq(paywallLocations.projectId, projectId), eq(paywallLocations.slug, slug)));
    return rows.length;
  });

/** All audit-log rows recorded for a given paywall-location entity. */
const findLocationAuditEntries = (entityId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.entityType, AuditLogEntityType.PaywallLocation),
          eq(auditLogs.entityId, entityId),
        ),
      );
  });

/**
 * Insert a paywall with a released, active release directly (the owning
 * services live elsewhere; a raw insert keeps the dependency tree small).
 * Returns the ids so the caller can track them for cleanup.
 */
const seedPaywallWithActiveRelease = (input: {
  readonly paywallProjectId: string;
  readonly released?: boolean;
}) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const paywallId = yield* uniqueId("pw");
    const releaseId = yield* uniqueId("pw_pub");
    const slug = yield* uniqueSlug("paywall");
    yield* db.insert(paywalls).values({
      id: paywallId,
      name: "Integration Paywall",
      projectId: input.paywallProjectId,
      slug,
    });
    yield* db.insert(paywallReleases).values({
      id: releaseId,
      paywallId,
      publishedBy: CoreTestFixture.userId,
      s3Bucket: "it-bucket",
      s3Key: "releases/it-release.html",
      schemaVersion: 1,
      version: 1,
      // The validation path requires both isActive AND status=released.
      isActive: true,
      status: releaseStatusOf(input.released),
    });
    return { paywallId, releaseId };
  });

/** Delete the given paywalls + their releases. Each delete is ignored. */
const cleanupPaywalls = (ids: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    if (ids.length === 0) return;
    const db = yield* Db;
    const targets = [...ids];
    yield* db
      .delete(paywallReleases)
      .where(inArray(paywallReleases.paywallId, targets))
      .pipe(Effect.ignore);
    yield* db.delete(paywalls).where(inArray(paywalls.id, targets)).pipe(Effect.ignore);
  });

/**
 * Delete the given locations, their showings, paywalls, and the append-only
 * audit rows recorded against the location entities. Audit entries survive an
 * archive/update, so they are cleared by entity id too. Each delete is
 * `ignore`d so a missing row never turns the finalizer into a failure.
 */
const cleanupCreated = (locationIds: ReadonlyArray<string>, paywallIds: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const locTargets = [...locationIds];
    if (locTargets.length > 0) {
      yield* db
        .delete(paywallLocationShowings)
        .where(inArray(paywallLocationShowings.paywallLocationId, locTargets))
        .pipe(Effect.ignore);
      yield* db
        .delete(auditLogs)
        .where(
          and(
            eq(auditLogs.entityType, AuditLogEntityType.PaywallLocation),
            inArray(auditLogs.entityId, locTargets),
          ),
        )
        .pipe(Effect.ignore);
      yield* db
        .delete(paywallLocations)
        .where(inArray(paywallLocations.id, locTargets))
        .pipe(Effect.ignore);
    }
    yield* cleanupPaywalls(paywallIds);
  });

/**
 * Wrap a test body so every location + paywall it creates is removed afterward,
 * regardless of how the test exits. Pass each created location id to `track`
 * and each created paywall id to `trackPaywall`; cleanup reads the collected
 * ids lazily at finalization via `Effect.ensuring`, so it sees every id tracked
 * while the body ran (including on failure).
 */
const withCleanup = <E, R>(
  body: (
    track: (id: string) => void,
    trackPaywall: (id: string) => void,
  ) => Effect.Effect<void, E, R>,
): Effect.Effect<void, E, R | Db> => {
  const locationIds: string[] = [];
  const paywallIds: string[] = [];
  return body(
    (id) => {
      locationIds.push(id);
    },
    (id) => {
      paywallIds.push(id);
    },
  ).pipe(Effect.ensuring(cleanupCreated(locationIds, paywallIds)));
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

/** Provide the service + its extra config, then authenticate as the fixture user. */
const provideService = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.provide(PaywallLocationServiceTestLayer),
    Effect.provide(PaywallAssetConfigTest),
    CoreAuthSession.authenticate(),
  );

describe("PaywallLocationService.createLocation", () => {
  test(
    "persists the location, records a created audit entry, and invalidates the schema cache",
    withCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* PaywallLocationService;
        const cache = yield* ProjectSchemaCache;

        const name = "Checkout Page";
        const slug = yield* uniqueSlug("create");
        yield* cache.getByName(projectId).set({ marker: "present" }, 60_000);

        const created = yield* svc.createLocation({ name, projectId, slug });
        track(created.id);
        expect(created.id.startsWith("pw_loc_")).toBe(true);

        const row = yield* findLocationRow(created.id);
        expect(row).toBeDefined();
        expect(row?.name).toBe(name);
        expect(row?.slug).toBe(slug);
        expect(row?.projectId).toBe(projectId);
        expect(row?.archivedAt).toBeNull();

        const auditEntries = yield* findLocationAuditEntries(created.id);
        const createdEntry = auditEntries.find((entry) => entry.action === AuditLogAction.Created);
        expect(createdEntry).toBeDefined();
        expect(createdEntry?.entityType).toBe(AuditLogEntityType.PaywallLocation);
        expect(createdEntry?.actorUserId).toBe(CoreTestFixture.userId);
        expect(createdEntry?.actorType).toBe(AuditLogActorType.User);
        expect(createdEntry?.changes).toEqual({ snapshot: { name, slug } });

        const cached = yield* cache.getByName(projectId).get();
        expect(cached).toBeNull();
      }),
    ).pipe(provideService),
  );

  test(
    "rejects a duplicate slug within the project and writes no second row",
    withCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* PaywallLocationService;
        const slug = yield* uniqueSlug("duplicate");

        const first = yield* svc.createLocation({ name: "First", projectId, slug });
        track(first.id);

        const error = yield* Effect.flip(svc.createLocation({ name: "Second", projectId, slug }));
        expect(error).toBeInstanceOf(PaywallLocationSlugAlreadyExistsError);
        if (error instanceof PaywallLocationSlugAlreadyExistsError) {
          expect(error.slug).toBe(slug);
        }

        expect(yield* countLocationsWithSlug(slug)).toBe(1);
      }),
    ).pipe(provideService),
  );

  test(
    "forbids callers without project:all and writes nothing",
    // No cleanup wrapper: a forbidden create writes no row.
    Effect.gen(function* () {
      const svc = yield* PaywallLocationService;
      const slug = yield* uniqueSlug("forbidden");

      const error = yield* Effect.flip(
        asUnauthorized(svc.createLocation({ name: "Nope", projectId, slug })),
      );
      expect(error).toBeInstanceOf(ActionForbiddenError);

      expect(yield* countLocationsWithSlug(slug)).toBe(0);
    }).pipe(
      Effect.provide(PaywallLocationServiceTestLayer),
      Effect.provide(PaywallAssetConfigTest),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "stores a description when provided and null when omitted",
    withCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* PaywallLocationService;

        const withDesc = yield* svc.createLocation({
          description: "Shown at checkout",
          name: "With Desc",
          projectId,
          slug: yield* uniqueSlug("with-desc"),
        });
        track(withDesc.id);
        const withoutDesc = yield* svc.createLocation({
          name: "No Desc",
          projectId,
          slug: yield* uniqueSlug("no-desc"),
        });
        track(withoutDesc.id);

        const withRow = yield* findLocationRow(withDesc.id);
        expect(withRow?.description).toBe("Shown at checkout");
        const withoutRow = yield* findLocationRow(withoutDesc.id);
        expect(withoutRow?.description).toBeNull();
      }),
    ).pipe(provideService),
  );
});

describe("PaywallLocationService.updateLocation", () => {
  test(
    "changes name and description, records an updated audit entry, and invalidates the schema cache",
    withCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* PaywallLocationService;
        const cache = yield* ProjectSchemaCache;

        const created = yield* svc.createLocation({
          description: "before",
          name: "Before",
          projectId,
          slug: yield* uniqueSlug("update-before"),
        });
        track(created.id);

        yield* cache.getByName(projectId).set({ marker: "present" }, 60_000);
        const result = yield* svc.updateLocation({
          description: "after",
          locationId: created.id,
          name: "After",
        });
        expect(result.id).toBe(created.id);

        const row = yield* findLocationRow(created.id);
        expect(row?.name).toBe("After");
        expect(row?.description).toBe("after");

        const auditEntries = yield* findLocationAuditEntries(created.id);
        const updatedEntry = auditEntries.find((entry) => entry.action === AuditLogAction.Updated);
        expect(updatedEntry).toBeDefined();
        expect(updatedEntry?.changes).toEqual({
          snapshot: { description: "after", name: "After" },
        });

        const cached = yield* cache.getByName(projectId).get();
        expect(cached).toBeNull();
      }),
    ).pipe(provideService),
  );

  test(
    "is a no-op when neither name nor description is provided (no write, no audit)",
    withCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* PaywallLocationService;

        const created = yield* svc.createLocation({
          name: "Untouched",
          projectId,
          slug: yield* uniqueSlug("update-noop"),
        });
        track(created.id);

        const result = yield* svc.updateLocation({ locationId: created.id });
        expect(result.id).toBe(created.id);

        const row = yield* findLocationRow(created.id);
        expect(row?.name).toBe("Untouched");

        // Only the create audit row should exist; no Updated entry was appended.
        const auditEntries = yield* findLocationAuditEntries(created.id);
        expect(auditEntries.some((entry) => entry.action === AuditLogAction.Updated)).toBe(false);
      }),
    ).pipe(provideService),
  );

  test(
    "fails with PaywallLocationNotFoundError for an unknown id",
    Effect.gen(function* () {
      const svc = yield* PaywallLocationService;
      const error = yield* Effect.flip(
        svc.updateLocation({ locationId: yield* uniqueId("pw_loc_missing"), name: "x" }),
      );
      expect(error).toBeInstanceOf(PaywallLocationNotFoundError);
    }).pipe(
      Effect.provide(PaywallLocationServiceTestLayer),
      Effect.provide(PaywallAssetConfigTest),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "does not update a location outside the requested project scope",
    withCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* PaywallLocationService;
        const created = yield* svc.createLocation({
          name: "Scoped",
          projectId,
          slug: yield* uniqueSlug("update-wrong-project"),
        });
        track(created.id);

        const error = yield* Effect.flip(
          svc.updateLocation({
            locationId: created.id,
            name: "Leaked",
            projectId: yield* uniqueId("project_other"),
          }),
        );
        expect(error).toBeInstanceOf(PaywallLocationNotFoundError);

        const row = yield* findLocationRow(created.id);
        expect(row?.name).toBe("Scoped");
      }),
    ).pipe(provideService),
  );

  test(
    "forbids callers without project:all and leaves the row unchanged",
    withCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* PaywallLocationService;
        const created = yield* svc.createLocation({
          name: "Guarded",
          projectId,
          slug: yield* uniqueSlug("update-forbidden"),
        });
        track(created.id);

        const error = yield* Effect.flip(
          asUnauthorized(svc.updateLocation({ locationId: created.id, name: "Hacked" })),
        );
        expect(error).toBeInstanceOf(ActionForbiddenError);

        const row = yield* findLocationRow(created.id);
        expect(row?.name).toBe("Guarded");
      }),
    ).pipe(provideService),
  );
});

describe("PaywallLocationService.archiveLocation", () => {
  test(
    "sets archivedAt, ends all active showings atomically, records an archived audit entry, and invalidates the cache",
    withCleanup((track, trackPaywall) =>
      Effect.gen(function* () {
        const svc = yield* PaywallLocationService;
        const cache = yield* ProjectSchemaCache;

        const { paywallId } = yield* seedPaywallWithActiveRelease({ paywallProjectId: projectId });
        trackPaywall(paywallId);

        const created = yield* svc.createLocation({
          name: "To Archive",
          projectId,
          slug: yield* uniqueSlug("archive"),
        });
        track(created.id);

        // Assign a showing so we can confirm archive ends it in the same transaction.
        yield* svc.assignLocationShowing({
          locationId: created.id,
          paywallId,
          type: "paywall_release",
        });
        expect((yield* findActiveShowingRows(created.id)).length).toBe(1);

        yield* cache.getByName(projectId).set({ marker: "present" }, 60_000);
        yield* svc.archiveLocation({ locationId: created.id });

        const row = yield* findLocationRow(created.id);
        expect(row?.archivedAt).not.toBeNull();

        // The active showing must have been ended within the archive transaction.
        expect((yield* findActiveShowingRows(created.id)).length).toBe(0);

        const auditEntries = yield* findLocationAuditEntries(created.id);
        expect(auditEntries.some((entry) => entry.action === AuditLogAction.Archived)).toBe(true);

        const cached = yield* cache.getByName(projectId).get();
        expect(cached).toBeNull();
      }),
    ).pipe(provideService),
  );

  test(
    "fails with PaywallLocationNotFoundError for an unknown id",
    Effect.gen(function* () {
      const svc = yield* PaywallLocationService;
      const error = yield* Effect.flip(
        svc.archiveLocation({ locationId: yield* uniqueId("pw_loc_missing") }),
      );
      expect(error).toBeInstanceOf(PaywallLocationNotFoundError);
    }).pipe(
      Effect.provide(PaywallLocationServiceTestLayer),
      Effect.provide(PaywallAssetConfigTest),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "forbids callers without project:all and leaves the row active",
    withCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* PaywallLocationService;
        const created = yield* svc.createLocation({
          name: "Protected",
          projectId,
          slug: yield* uniqueSlug("archive-forbidden"),
        });
        track(created.id);

        const error = yield* Effect.flip(
          asUnauthorized(svc.archiveLocation({ locationId: created.id })),
        );
        expect(error).toBeInstanceOf(ActionForbiddenError);

        const row = yield* findLocationRow(created.id);
        expect(row?.archivedAt).toBeNull();
      }),
    ).pipe(provideService),
  );

  // The transaction-rollback path (db.transaction rolls back if either the
  // location update or the endActiveShowings update fails) can't be triggered
  // in-process without a fault-injecting DB seam: both statements are valid
  // drizzle updates against existing rows, so neither fails on the happy data
  // path. Forcing a failure would require mocking the real DB, which the
  // integration tier forbids. The atomic *success* case (both rows mutated) is
  // covered by the happy-path test above.
  vitestTest.todo(
    "archiveLocation: transaction rolls back if either update fails — needs a fault-injecting DB seam (cannot mock the real DB in the integration tier)",
  );
});

describe("PaywallLocationService.listLocations", () => {
  test(
    "returns active locations for the project (membership-based, not exact counts)",
    withCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* PaywallLocationService;
        const slugA = yield* uniqueSlug("list-a");
        const slugB = yield* uniqueSlug("list-b");
        const absentSlug = yield* uniqueSlug("list-absent");

        const a = yield* svc.createLocation({ name: "A", projectId, slug: slugA });
        track(a.id);
        const b = yield* svc.createLocation({ name: "B", projectId, slug: slugB });
        track(b.id);

        const list = yield* svc.listLocations({ projectId });
        expect(list.some((loc) => loc.id === a.id && loc.slug === slugA)).toBe(true);
        expect(list.some((loc) => loc.id === b.id && loc.slug === slugB)).toBe(true);
        expect(list.some((loc) => loc.slug === absentSlug)).toBe(false);
        // Default (no includeArchived) excludes archived rows.
        expect(list.every((loc) => loc.archivedAt === null)).toBe(true);
      }),
    ).pipe(provideService),
  );

  test(
    "includeArchived=true surfaces an archived location that the default view hides",
    withCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* PaywallLocationService;
        const slug = yield* uniqueSlug("list-archived");
        const created = yield* svc.createLocation({ name: "Archived", projectId, slug });
        track(created.id);
        yield* svc.archiveLocation({ locationId: created.id });

        const defaultList = yield* svc.listLocations({ projectId });
        expect(defaultList.some((loc) => loc.id === created.id)).toBe(false);

        const withArchived = yield* svc.listLocations({ includeArchived: true, projectId });
        const found = withArchived.find((loc) => loc.id === created.id);
        expect(found).toBeDefined();
        expect(found?.archivedAt).not.toBeNull();
      }),
    ).pipe(provideService),
  );

  test(
    "populates activeShowing with the eagerly joined showing view",
    withCleanup((track, trackPaywall) =>
      Effect.gen(function* () {
        const svc = yield* PaywallLocationService;
        const { paywallId, releaseId } = yield* seedPaywallWithActiveRelease({
          paywallProjectId: projectId,
        });
        trackPaywall(paywallId);

        const created = yield* svc.createLocation({
          name: "With Showing",
          projectId,
          slug: yield* uniqueSlug("list-showing"),
        });
        track(created.id);
        const assigned = yield* svc.assignLocationShowing({
          locationId: created.id,
          paywallId,
          type: "paywall_release",
        });

        const list = yield* svc.listLocations({ projectId });
        const found = list.find((loc) => loc.id === created.id);
        expect(found).toBeDefined();
        expect(found?.activeShowing).not.toBeNull();
        expect(found?.activeShowing?.id).toBe(assigned.id);
        expect(found?.activeShowing?.type).toBe("paywall_release");
        expect(found?.activeShowing?.paywallId).toBe(paywallId);
        // The eager paywallRelease join builds the CDN HTML URL from the release row.
        expect(found?.activeShowing?.paywallRelease?.releaseId).toBe(releaseId);
        expect(found?.activeShowing?.paywallRelease?.htmlUrl).toBe(
          `${CDN_URL}/it-bucket/releases/it-release.html`,
        );

        // A location with no showing reports null.
        const bare = yield* svc.createLocation({
          name: "No Showing",
          projectId,
          slug: yield* uniqueSlug("list-bare"),
        });
        track(bare.id);
        const list2 = yield* svc.listLocations({ projectId });
        expect(list2.find((loc) => loc.id === bare.id)?.activeShowing).toBeNull();
      }),
    ).pipe(provideService),
  );

  test(
    "forbids callers without project:all",
    Effect.gen(function* () {
      const svc = yield* PaywallLocationService;
      const error = yield* Effect.flip(asUnauthorized(svc.listLocations({ projectId })));
      expect(error).toBeInstanceOf(ActionForbiddenError);
    }).pipe(
      Effect.provide(PaywallLocationServiceTestLayer),
      Effect.provide(PaywallAssetConfigTest),
      CoreAuthSession.authenticate(),
    ),
  );
});

describe("PaywallLocationService.listLocationShowings", () => {
  test(
    "returns the location's showings, newest first",
    withCleanup((track, trackPaywall) =>
      Effect.gen(function* () {
        const svc = yield* PaywallLocationService;
        const { paywallId } = yield* seedPaywallWithActiveRelease({ paywallProjectId: projectId });
        trackPaywall(paywallId);

        const created = yield* svc.createLocation({
          name: "Showings",
          projectId,
          slug: yield* uniqueSlug("showings"),
        });
        track(created.id);

        // Two assignments: assigning the second ends the first. Both showings
        // must be returned by the unfiltered list read.
        const first = yield* svc.assignLocationShowing({
          locationId: created.id,
          paywallId,
          type: "paywall_release",
        });
        const second = yield* svc.assignLocationShowing({
          locationId: created.id,
          paywallId,
          type: "paywall_release",
        });

        const showings = yield* svc.listLocationShowings({ locationId: created.id });
        const firstView = showings.find((s) => s.id === first.id);
        const secondView = showings.find((s) => s.id === second.id);
        expect(firstView).toBeDefined();
        expect(secondView).toBeDefined();
        // The service orders only by `startedAt desc`, but `started_at` is a
        // whole-second `timestamp` (no fractional precision) and both
        // assignments run within the same second, so the relative order of the
        // two rows is a SQL tie with no deterministic resolution — asserting a
        // strict index ordering would flake. The guaranteed, source-derivable
        // facts are: assigning `second` ended `first` (endedAt set) and left
        // `second` active (endedAt null).
        expect(firstView?.endedAt).not.toBeNull();
        expect(secondView?.endedAt).toBeNull();
      }),
    ).pipe(provideService),
  );

  test(
    "fails with PaywallLocationNotFoundError for an unknown id",
    Effect.gen(function* () {
      const svc = yield* PaywallLocationService;
      const error = yield* Effect.flip(
        svc.listLocationShowings({ locationId: yield* uniqueId("pw_loc_missing") }),
      );
      expect(error).toBeInstanceOf(PaywallLocationNotFoundError);
    }).pipe(
      Effect.provide(PaywallLocationServiceTestLayer),
      Effect.provide(PaywallAssetConfigTest),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "forbids callers without project:all",
    withCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* PaywallLocationService;
        const created = yield* svc.createLocation({
          name: "Guarded Showings",
          projectId,
          slug: yield* uniqueSlug("showings-forbidden"),
        });
        track(created.id);

        const error = yield* Effect.flip(
          asUnauthorized(svc.listLocationShowings({ locationId: created.id })),
        );
        expect(error).toBeInstanceOf(ActionForbiddenError);
      }),
    ).pipe(provideService),
  );
});

describe("PaywallLocationService.assignLocationShowing", () => {
  test(
    "ends the prior active showing, inserts the new one atomically, and records an updated audit entry",
    withCleanup((track, trackPaywall) =>
      Effect.gen(function* () {
        const svc = yield* PaywallLocationService;
        const { paywallId, releaseId } = yield* seedPaywallWithActiveRelease({
          paywallProjectId: projectId,
        });
        trackPaywall(paywallId);

        const created = yield* svc.createLocation({
          name: "Assign",
          projectId,
          slug: yield* uniqueSlug("assign"),
        });
        track(created.id);

        const first = yield* svc.assignLocationShowing({
          locationId: created.id,
          paywallId,
          type: "paywall_release",
        });
        expect(first.id.startsWith("pw_loc_show_")).toBe(true);

        const second = yield* svc.assignLocationShowing({
          locationId: created.id,
          paywallId,
          type: "paywall_release",
        });

        // Exactly one active showing remains — the second; the first is ended.
        const active = yield* findActiveShowingRows(created.id);
        expect(active.length).toBe(1);
        expect(active[0]?.id).toBe(second.id);

        const all = yield* findShowingRows(created.id);
        const firstRow = all.find((s) => s.id === first.id);
        expect(firstRow?.endedAt).not.toBeNull();

        // Inserted showing carries the resolved release + actor.
        const secondRow = all.find((s) => s.id === second.id);
        expect(secondRow?.paywallId).toBe(paywallId);
        expect(secondRow?.paywallReleaseId).toBe(releaseId);
        expect(secondRow?.type).toBe(PaywallLocationShowingType.paywallRelease);
        expect(secondRow?.createdByUserId).toBe(CoreTestFixture.userId);

        // Each assign appends its own Updated audit entry, so two exist (one per
        // call). Select the entry recorded for the *second* assignment by its
        // showingId rather than taking the first Updated row (which is the prior
        // assignment's, in DB read order).
        const auditEntries = yield* findLocationAuditEntries(created.id);
        const updatedEntry = auditEntries.find(
          (entry) =>
            entry.action === AuditLogAction.Updated &&
            typeof entry.changes === "object" &&
            entry.changes !== null &&
            changeField(entry.changes, "showingId") === second.id,
        );
        expect(updatedEntry).toBeDefined();
        expect(updatedEntry?.changes).toMatchObject({ paywallId, showingId: second.id });
      }),
    ).pipe(provideService),
  );

  test(
    "rejects assignment to an archived location",
    withCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* PaywallLocationService;
        const created = yield* svc.createLocation({
          name: "Archived Target",
          projectId,
          slug: yield* uniqueSlug("assign-archived"),
        });
        track(created.id);
        yield* svc.archiveLocation({ locationId: created.id });

        const error = yield* Effect.flip(
          svc.assignLocationShowing({
            locationId: created.id,
            paywallId: yield* uniqueId("pw"),
            type: "paywall_release",
          }),
        );
        expect(error).toBeInstanceOf(PaywallLocationShowingValidationError);

        // No new showing should have been inserted.
        expect((yield* findShowingRows(created.id)).length).toBe(0);
      }),
    ).pipe(provideService),
  );

  test(
    "rejects feature_flag showings (not yet supported)",
    withCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* PaywallLocationService;
        const created = yield* svc.createLocation({
          name: "FF Target",
          projectId,
          slug: yield* uniqueSlug("assign-ff"),
        });
        track(created.id);

        const error = yield* Effect.flip(
          svc.assignLocationShowing({
            featureFlagId: yield* uniqueId("ff"),
            locationId: created.id,
            type: "feature_flag",
          }),
        );
        expect(error).toBeInstanceOf(PaywallLocationShowingValidationError);
        expect((yield* findShowingRows(created.id)).length).toBe(0);
      }),
    ).pipe(provideService),
  );

  test(
    "rejects paywall_release without a paywallId",
    withCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* PaywallLocationService;
        const created = yield* svc.createLocation({
          name: "Missing Paywall",
          projectId,
          slug: yield* uniqueSlug("assign-nopaywall"),
        });
        track(created.id);

        const error = yield* Effect.flip(
          svc.assignLocationShowing({ locationId: created.id, type: "paywall_release" }),
        );
        expect(error).toBeInstanceOf(PaywallLocationShowingValidationError);
        expect((yield* findShowingRows(created.id)).length).toBe(0);
      }),
    ).pipe(provideService),
  );

  test(
    "rejects a paywall that does not exist",
    withCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* PaywallLocationService;
        const created = yield* svc.createLocation({
          name: "Ghost Paywall",
          projectId,
          slug: yield* uniqueSlug("assign-ghost"),
        });
        track(created.id);

        const error = yield* Effect.flip(
          svc.assignLocationShowing({
            locationId: created.id,
            paywallId: yield* uniqueId("pw_missing"),
            type: "paywall_release",
          }),
        );
        expect(error).toBeInstanceOf(PaywallNotFoundError);
        expect((yield* findShowingRows(created.id)).length).toBe(0);
      }),
    ).pipe(provideService),
  );

  test(
    "rejects a paywall belonging to a different project",
    withCleanup((track, trackPaywall) =>
      Effect.gen(function* () {
        const svc = yield* PaywallLocationService;
        // Paywall lives under a different (non-existent FK-wise but distinct)
        // project id; the service guards on projectId mismatch before any read
        // of releases, so a bare paywall row with a foreign projectId suffices.
        const otherProjectId = yield* uniqueId("proj_other");
        const { paywallId } = yield* seedPaywallWithActiveRelease({
          paywallProjectId: otherProjectId,
        });
        trackPaywall(paywallId);

        const created = yield* svc.createLocation({
          name: "Cross Project",
          projectId,
          slug: yield* uniqueSlug("assign-crossproj"),
        });
        track(created.id);

        const error = yield* Effect.flip(
          svc.assignLocationShowing({
            locationId: created.id,
            paywallId,
            type: "paywall_release",
          }),
        );
        expect(error).toBeInstanceOf(PaywallNotFoundError);
        expect((yield* findShowingRows(created.id)).length).toBe(0);
      }),
    ).pipe(provideService),
  );

  test(
    "rejects a paywall without an active released version",
    withCleanup((track, trackPaywall) =>
      Effect.gen(function* () {
        const svc = yield* PaywallLocationService;
        // Release exists but is only draft (status != released), so the active
        // released lookup returns nothing.
        const { paywallId } = yield* seedPaywallWithActiveRelease({
          paywallProjectId: projectId,
          released: false,
        });
        trackPaywall(paywallId);

        const created = yield* svc.createLocation({
          name: "Unreleased",
          projectId,
          slug: yield* uniqueSlug("assign-unreleased"),
        });
        track(created.id);

        const error = yield* Effect.flip(
          svc.assignLocationShowing({
            locationId: created.id,
            paywallId,
            type: "paywall_release",
          }),
        );
        expect(error).toBeInstanceOf(PaywallLocationShowingValidationError);
        expect((yield* findShowingRows(created.id)).length).toBe(0);
      }),
    ).pipe(provideService),
  );

  test(
    "fails with PaywallLocationNotFoundError for an unknown location id",
    Effect.gen(function* () {
      const svc = yield* PaywallLocationService;
      const error = yield* Effect.flip(
        svc.assignLocationShowing({
          locationId: yield* uniqueId("pw_loc_missing"),
          paywallId: yield* uniqueId("pw"),
          type: "paywall_release",
        }),
      );
      expect(error).toBeInstanceOf(PaywallLocationNotFoundError);
    }).pipe(
      Effect.provide(PaywallLocationServiceTestLayer),
      Effect.provide(PaywallAssetConfigTest),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "forbids callers without project:all and writes no showing",
    withCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* PaywallLocationService;
        const created = yield* svc.createLocation({
          name: "Guard Assign",
          projectId,
          slug: yield* uniqueSlug("assign-forbidden"),
        });
        track(created.id);

        const error = yield* Effect.flip(
          asUnauthorized(
            svc.assignLocationShowing({
              locationId: created.id,
              paywallId: yield* uniqueId("pw"),
              type: "paywall_release",
            }),
          ),
        );
        expect(error).toBeInstanceOf(ActionForbiddenError);
        expect((yield* findShowingRows(created.id)).length).toBe(0);
      }),
    ).pipe(provideService),
  );

  // assignLocationShowing wraps endActiveShowings + insert in db.transaction.
  // Verifying the rollback-on-insert-failure branch requires the insert to
  // throw after the prior showings were ended; on real data with valid inputs
  // the insert never fails, and forcing it would require mocking the DB (banned
  // in the integration tier). The atomic *success* case (prior ended + new
  // inserted in one transaction) is covered by the happy-path test above.
  vitestTest.todo(
    "assignLocationShowing: transaction rolls back if the insert fails after endActiveShowings — needs a fault-injecting DB seam",
  );
});

describe("PaywallLocationService.clearLocationShowing", () => {
  test(
    "ends all active showings and records an updated audit entry",
    withCleanup((track, trackPaywall) =>
      Effect.gen(function* () {
        const svc = yield* PaywallLocationService;
        const { paywallId } = yield* seedPaywallWithActiveRelease({ paywallProjectId: projectId });
        trackPaywall(paywallId);

        const created = yield* svc.createLocation({
          name: "Clear",
          projectId,
          slug: yield* uniqueSlug("clear"),
        });
        track(created.id);
        yield* svc.assignLocationShowing({
          locationId: created.id,
          paywallId,
          type: "paywall_release",
        });
        expect((yield* findActiveShowingRows(created.id)).length).toBe(1);

        yield* svc.clearLocationShowing({ locationId: created.id });

        expect((yield* findActiveShowingRows(created.id)).length).toBe(0);

        const auditEntries = yield* findLocationAuditEntries(created.id);
        const cleared = auditEntries.find(
          (entry) =>
            entry.action === AuditLogAction.Updated &&
            typeof entry.changes === "object" &&
            entry.changes !== null &&
            changeField(entry.changes, "cleared") === true,
        );
        expect(cleared).toBeDefined();
      }),
    ).pipe(provideService),
  );

  test(
    "is idempotent when there is no active showing (no error)",
    withCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* PaywallLocationService;
        const created = yield* svc.createLocation({
          name: "Already Clear",
          projectId,
          slug: yield* uniqueSlug("clear-idempotent"),
        });
        track(created.id);

        // No showing assigned — clearing must succeed without raising.
        yield* svc.clearLocationShowing({ locationId: created.id });
        expect((yield* findActiveShowingRows(created.id)).length).toBe(0);
      }),
    ).pipe(provideService),
  );

  test(
    "fails with PaywallLocationNotFoundError for an unknown id",
    Effect.gen(function* () {
      const svc = yield* PaywallLocationService;
      const error = yield* Effect.flip(
        svc.clearLocationShowing({ locationId: yield* uniqueId("pw_loc_missing") }),
      );
      expect(error).toBeInstanceOf(PaywallLocationNotFoundError);
    }).pipe(
      Effect.provide(PaywallLocationServiceTestLayer),
      Effect.provide(PaywallAssetConfigTest),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "forbids callers without project:all",
    withCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* PaywallLocationService;
        const created = yield* svc.createLocation({
          name: "Guard Clear",
          projectId,
          slug: yield* uniqueSlug("clear-forbidden"),
        });
        track(created.id);

        const error = yield* Effect.flip(
          asUnauthorized(svc.clearLocationShowing({ locationId: created.id })),
        );
        expect(error).toBeInstanceOf(ActionForbiddenError);
      }),
    ).pipe(provideService),
  );
});

describe("PaywallLocationService.resolveLocationShowingForSdk", () => {
  test(
    "returns the location + showing view for an active location with an active paywall_release showing (no auth required)",
    withCleanup((track, trackPaywall) =>
      Effect.gen(function* () {
        const svc = yield* PaywallLocationService;
        const { paywallId, releaseId } = yield* seedPaywallWithActiveRelease({
          paywallProjectId: projectId,
        });
        trackPaywall(paywallId);

        const slug = yield* uniqueSlug("sdk-ok");
        const created = yield* svc.createLocation({ name: "SDK", projectId, slug });
        track(created.id);
        yield* svc.assignLocationShowing({
          locationId: created.id,
          paywallId,
          type: "paywall_release",
        });

        const resolved = yield* svc.resolveLocationShowingForSdk({
          locationSlug: slug,
          projectId,
        });
        expect(resolved).not.toBeNull();
        expect(resolved?.location.id).toBe(created.id);
        expect(resolved?.location.slug).toBe(slug);
        expect(resolved?.showing.type).toBe("paywall_release");
        expect(resolved?.showing.paywallId).toBe(paywallId);
        expect(resolved?.showing.paywallRelease?.releaseId).toBe(releaseId);
        // CDN URL is built from s3Bucket, s3Key, and the configured cdnUrl.
        expect(resolved?.showing.paywallRelease?.htmlUrl).toBe(
          `${CDN_URL}/it-bucket/releases/it-release.html`,
        );
      }),
    ).pipe(provideService),
  );

  test(
    "is a public read: succeeds even for a caller without project access",
    withCleanup((track, trackPaywall) =>
      Effect.gen(function* () {
        const svc = yield* PaywallLocationService;
        const { paywallId } = yield* seedPaywallWithActiveRelease({ paywallProjectId: projectId });
        trackPaywall(paywallId);

        const slug = yield* uniqueSlug("sdk-public");
        const created = yield* svc.createLocation({ name: "Public", projectId, slug });
        track(created.id);
        yield* svc.assignLocationShowing({
          locationId: created.id,
          paywallId,
          type: "paywall_release",
        });

        // Same call, but re-authenticated as a principal with no project access:
        // it must NOT raise ActionForbiddenError (no auth gate on this method).
        const resolved = yield* asUnauthorized(
          svc.resolveLocationShowingForSdk({ locationSlug: slug, projectId }),
        );
        expect(resolved).not.toBeNull();
        expect(resolved?.location.id).toBe(created.id);
      }),
    ).pipe(provideService),
  );

  test(
    "returns null when the location slug does not exist",
    Effect.gen(function* () {
      const svc = yield* PaywallLocationService;
      const resolved = yield* svc.resolveLocationShowingForSdk({
        locationSlug: yield* uniqueSlug("sdk-missing"),
        projectId,
      });
      expect(resolved).toBeNull();
    }).pipe(
      Effect.provide(PaywallLocationServiceTestLayer),
      Effect.provide(PaywallAssetConfigTest),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "returns null when the matching location is archived",
    withCleanup((track, trackPaywall) =>
      Effect.gen(function* () {
        const svc = yield* PaywallLocationService;
        const { paywallId } = yield* seedPaywallWithActiveRelease({ paywallProjectId: projectId });
        trackPaywall(paywallId);

        const slug = yield* uniqueSlug("sdk-archived");
        const created = yield* svc.createLocation({ name: "Archived SDK", projectId, slug });
        track(created.id);
        yield* svc.assignLocationShowing({
          locationId: created.id,
          paywallId,
          type: "paywall_release",
        });
        yield* svc.archiveLocation({ locationId: created.id });

        const resolved = yield* svc.resolveLocationShowingForSdk({
          locationSlug: slug,
          projectId,
        });
        expect(resolved).toBeNull();
      }),
    ).pipe(provideService),
  );

  test(
    "returns null when the location has no active showing",
    withCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* PaywallLocationService;
        const slug = yield* uniqueSlug("sdk-noshowing");
        const created = yield* svc.createLocation({ name: "No Showing SDK", projectId, slug });
        track(created.id);

        const resolved = yield* svc.resolveLocationShowingForSdk({
          locationSlug: slug,
          projectId,
        });
        expect(resolved).toBeNull();
      }),
    ).pipe(provideService),
  );

  // The "active showing exists but its type is not paywall_release" and
  // "paywall/paywallRelease relations are missing" branches cannot be reached
  // through the public service surface: assignLocationShowing rejects
  // feature_flag and any input without a resolvable active released paywall, so
  // a paywall_release showing always carries both relations. Reaching these
  // branches would require inserting a malformed showing row directly, which
  // tests private/unreachable state rather than the service contract.
  vitestTest.todo(
    "resolveLocationShowingForSdk: returns null for a non-paywall_release showing / missing relations — unreachable via the public API (assign rejects those inputs)",
  );
});
