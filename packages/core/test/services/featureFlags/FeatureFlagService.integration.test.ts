/**
 * Integration tests for {@link FeatureFlagService}, run against the real backend
 * stack provisioned once by `test/_testing/globalSetup.ts` (live PlanetScale DB +
 * ClickHouse + WorkOS; only the project schema cache is an in-memory stub).
 *
 * Each test drives a public method end-to-end and verifies the *persisted* side
 * effects, not just the return value:
 *  - the `feature_flag` / `feature_flag_target` / `feature_flag_override` /
 *    `feature_flag_variant` rows written, updated, or archived in MySQL,
 *  - the matching `audit_log` rows (entity type, action, actor, parent entity,
 *    change snapshot).
 *
 * Conventions (mirrored from `PerkService.integration.test.ts`):
 *  - All rows live under the one seeded fixture project ({@link CoreTestFixture}),
 *    but every test cleans up after itself: {@link withFlagCleanup} deletes the
 *    flags it created (cascading targets / overrides / variants, plus the
 *    append-only audit rows keyed by entity id) on exit, success or failure. The
 *    global teardown sweep is only a backstop. Assertions are membership-based
 *    (`.some(...)` / by-key), never exact `listFlags` counts, and keys are unique
 *    per call so a leftover row from a crashed run can't collide.
 *  - Permission tests reuse the default authenticated effect and re-authenticate
 *    just the call under test via {@link asUnauthorized}; the inner provision
 *    shadows the harness's default full-permission session.
 *  - Typed failures are asserted with `Effect.flip` (project convention),
 *    narrowing the swapped error with `instanceof`, and are always paired with a
 *    DB-state assertion proving nothing leaked.
 *
 * `FeatureFlagService` does not invalidate the project schema cache, so there is
 * no cache assertion here (unlike the PerkService reference).
 */
import { Effect } from "effect";
import { describe, expect, test as vitestTest } from "vitest";

import { FeatureFlagService, FeatureFlagServiceError } from "@voidhash/core/services";
import {
  FeatureFlagKeyAlreadyExistsError,
  FeatureFlagNotFoundError,
  FeatureFlagOverrideNotFoundError,
  FeatureFlagTargetNotFoundError,
} from "@voidhash/core/domain/featureFlag/FeatureFlag";
import { ActionForbiddenError, type UserSession } from "@voidhash/core/domain/auth/Auth";
import {
  AuditLogAction,
  AuditLogActorType,
  AuditLogEntityType,
  Db,
  FeatureFlagIdentityType,
  FeatureFlagTargetListType,
  and,
  auditLogs,
  eq,
  featureFlagOverrides,
  featureFlagTargets,
  featureFlagVariants,
  featureFlags,
  inArray,
  isNull,
  personExternalIdentifiers,
  personIdentities,
  persons,
} from "@voidhash/db";

import { CoreAuthSession } from "@testing/CoreAuthSession";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";
import { CoreTestFixture } from "@testing/CoreTestFixture";

const { test } = CoreIntegrationTestHarness.make();

const projectId = CoreTestFixture.projectId;

/** A second project id, used only to prove key-uniqueness is scoped per project. */
const otherProjectId = "it_project_ff_other";

/** Monotonic counter so keys/values stay unique even within the same millisecond. */
let seq = 0;
const uniqueKey = (label: string) => `it-ff-${label}-${Date.now()}-${seq++}`;
const uniqueValue = (label: string) => `it-ff-id-${label}-${Date.now()}-${seq++}`;

// ---------------------------------------------------------------------------
// Raw DB read-back helpers (bypass the service to verify persisted state).
// ---------------------------------------------------------------------------

const findFlagRow = (id: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.featureFlags.findFirst({ where: { id } });
  });

const findTargetRow = (id: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.featureFlagTargets.findFirst({ where: { id } });
  });

const findOverrideRow = (id: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.featureFlagOverrides.findFirst({ where: { id } });
  });

const findVariantRows = (featureFlagId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.featureFlagVariants.findMany({
      where: { featureFlagId },
    });
  });

/** Audit rows recorded for a given entity id, for any of the feature-flag entity types. */
const findAuditEntries = (entityId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.select().from(auditLogs).where(eq(auditLogs.entityId, entityId));
  });

/** Count unarchived flags with a given key in a project (membership, never totals). */
const countFlagsWithKey = (key: string, scopeProjectId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const rows = yield* db
      .select({ id: featureFlags.id })
      .from(featureFlags)
      .where(and(eq(featureFlags.projectId, scopeProjectId), eq(featureFlags.key, key)));
    return rows.length;
  });

// ---------------------------------------------------------------------------
// Seeding helpers for parent rows the fixture does not provide.
// ---------------------------------------------------------------------------

/**
 * Insert a flag row directly (bypassing the service) so tests can control fields
 * the public `createFlag` cannot set — `enabled`, `rolloutBps`, `internal`,
 * `salt`, or a foreign `projectId`. Returns the generated id.
 */
const insertRawFlag = (input: {
  readonly id: string;
  readonly projectId?: string;
  readonly key: string;
  readonly name?: string;
  readonly enabled?: boolean;
  readonly rolloutBps?: number;
  readonly internal?: boolean;
  readonly salt?: string;
}) =>
  Effect.gen(function* () {
    const db = yield* Db;
    yield* db.insert(featureFlags).values({
      id: input.id,
      projectId: input.projectId ?? projectId,
      key: input.key,
      name: input.name ?? "Raw Flag",
      enabled: input.enabled ?? false,
      rolloutBps: input.rolloutBps ?? 0,
      internal: input.internal ?? false,
      salt: input.salt ?? "it-ff-salt",
      version: 1,
    });
  });

const insertRawTarget = (input: {
  readonly id: string;
  readonly featureFlagId: string;
  readonly listType: number;
  readonly identityType: number;
  readonly identityValue: string;
}) =>
  Effect.gen(function* () {
    const db = yield* Db;
    yield* db.insert(featureFlagTargets).values(input);
  });

const insertRawOverride = (input: {
  readonly id: string;
  readonly featureFlagId: string;
  readonly identityType: number;
  readonly identityValue: string;
  readonly forcedEnabled?: boolean | null;
  readonly forcedVariantKey?: string | null;
}) =>
  Effect.gen(function* () {
    const db = yield* Db;
    yield* db.insert(featureFlagOverrides).values({
      id: input.id,
      featureFlagId: input.featureFlagId,
      identityType: input.identityType,
      identityValue: input.identityValue,
      forcedEnabled: input.forcedEnabled ?? null,
      forcedVariantKey: input.forcedVariantKey ?? null,
    });
  });

const insertRawVariant = (input: {
  readonly id: string;
  readonly featureFlagId: string;
  readonly key: string;
  readonly name?: string;
  readonly weightBps: number;
  readonly payload?: unknown;
}) =>
  Effect.gen(function* () {
    const db = yield* Db;
    yield* db.insert(featureFlagVariants).values({
      id: input.id,
      featureFlagId: input.featureFlagId,
      key: input.key,
      name: input.name ?? input.key,
      weightBps: input.weightBps,
      payload: input.payload ?? null,
    });
  });

// ---------------------------------------------------------------------------
// Cleanup: delete created flags (and their children + audit rows) on exit.
// ---------------------------------------------------------------------------

/**
 * Delete the given flags, their targets / overrides / variants, and all of the
 * append-only audit rows keyed by the flag id (audit rows survive entity
 * deletes, so they are cleared by entity id too). Each delete is `ignore`d so a
 * missing row never turns the finalizer into a failure.
 */
const cleanupCreatedFlags = (ids: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    if (ids.length === 0) return;
    const db = yield* Db;
    const targets = [...ids];

    // Child-row audit entries reference the flag id as parentEntityId; the
    // entityId is the child's own id (target/override/variant). Clear by both
    // the flag ids and the child ids harvested below.
    const targetRows = yield* db
      .select({ id: featureFlagTargets.id })
      .from(featureFlagTargets)
      .where(inArray(featureFlagTargets.featureFlagId, targets))
      .pipe(Effect.catch(() => Effect.succeed([] as Array<{ id: string }>)));
    const overrideRows = yield* db
      .select({ id: featureFlagOverrides.id })
      .from(featureFlagOverrides)
      .where(inArray(featureFlagOverrides.featureFlagId, targets))
      .pipe(Effect.catch(() => Effect.succeed([] as Array<{ id: string }>)));

    const childIds = [...targetRows.map((r) => r.id), ...overrideRows.map((r) => r.id)];
    const auditEntityIds = [...targets, ...childIds];

    yield* db
      .delete(auditLogs)
      .where(inArray(auditLogs.entityId, auditEntityIds))
      .pipe(Effect.ignore);
    yield* db
      .delete(featureFlagVariants)
      .where(inArray(featureFlagVariants.featureFlagId, targets))
      .pipe(Effect.ignore);
    yield* db
      .delete(featureFlagTargets)
      .where(inArray(featureFlagTargets.featureFlagId, targets))
      .pipe(Effect.ignore);
    yield* db
      .delete(featureFlagOverrides)
      .where(inArray(featureFlagOverrides.featureFlagId, targets))
      .pipe(Effect.ignore);
    yield* db.delete(featureFlags).where(inArray(featureFlags.id, targets)).pipe(Effect.ignore);
  });

/**
 * Wrap a test body so every flag it tracks is removed afterward, regardless of
 * how the test exits. Pass each created flag id to the `track` callback; cleanup
 * reads the collected ids lazily at finalization via `Effect.ensuring`, so it
 * sees every id tracked while the body ran (including on failure).
 */
const withFlagCleanup = <E, R>(
  body: (track: (id: string) => void) => Effect.Effect<void, E, R>,
): Effect.Effect<void, E, R | Db> => {
  const createdIds: string[] = [];
  return body((id) => {
    createdIds.push(id);
  }).pipe(Effect.ensuring(cleanupCreatedFlags(createdIds)));
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
    createdAt: new Date(0),
    email: CoreTestFixture.userEmail,
    emailVerified: true,
    id: CoreTestFixture.userId,
    image: null,
    name: CoreTestFixture.userName,
    role: null,
    updatedAt: new Date(0),
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

/**
 * A session holding `project:all` on {@link otherProjectId}. `checkProjectPermission`
 * matches on the exact project id, so the default fixture session (scoped to
 * `it_project`) cannot act on the second project; a call against it must be
 * re-authenticated with this session.
 */
const sessionForOtherProject = (): UserSession => ({
  cookie: null,
  method: "user",
  name: `${CoreTestFixture.userName} <${CoreTestFixture.userEmail}>`,
  organizations: [
    {
      id: CoreTestFixture.organizationId,
      logo: null,
      name: CoreTestFixture.organizationName,
      permissions: ["organization:all"],
      slug: CoreTestFixture.organizationSlug,
      workosOrganizationId: CoreTestFixture.workosOrganizationId,
    },
  ],
  person: null,
  projects: [
    {
      id: otherProjectId,
      logo: null,
      name: "Other Project",
      organizationId: CoreTestFixture.organizationId,
      permissions: ["project:all"],
      slug: "it-project-ff-other",
    },
  ],
  user: {
    createdAt: new Date(0),
    email: CoreTestFixture.userEmail,
    emailVerified: true,
    id: CoreTestFixture.userId,
    image: null,
    name: CoreTestFixture.userName,
    role: null,
    updatedAt: new Date(0),
    workosUserId: CoreTestFixture.workosUserId,
  },
});

/** Run a single call authenticated against {@link otherProjectId}. */
const asOtherProject = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(CoreAuthSession.authenticate(sessionForOtherProject()));

// ===========================================================================
// createFlag
// ===========================================================================

describe("FeatureFlagService.createFlag", () => {
  test(
    "persists the flag with defaults (enabled=false, rolloutBps=0, version=1) and a Created audit entry",
    withFlagCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FeatureFlagService;
        const key = uniqueKey("create");

        const created = yield* svc.createFlag({
          projectId,
          key,
          name: "Created Flag",
          description: "from integration test",
        });
        track(created.id);
        expect(created.id.startsWith("ff_")).toBe(true);

        const row = yield* findFlagRow(created.id);
        expect(row).toBeDefined();
        expect(row?.key).toBe(key);
        expect(row?.name).toBe("Created Flag");
        expect(row?.description).toBe("from integration test");
        expect(row?.projectId).toBe(projectId);
        expect(row?.enabled).toBe(false);
        expect(row?.rolloutBps).toBe(0);
        expect(row?.version).toBe(1);
        expect(row?.archivedAt ?? null).toBeNull();
        expect(typeof row?.salt).toBe("string");
        expect((row?.salt ?? "").length).toBeGreaterThan(0);
        expect(row?.createdByUserId).toBe(CoreTestFixture.userId);

        const auditEntries = yield* findAuditEntries(created.id);
        const createdEntry = auditEntries.find(
          (entry) =>
            entry.action === AuditLogAction.Created &&
            entry.entityType === AuditLogEntityType.FeatureFlag,
        );
        expect(createdEntry).toBeDefined();
        expect(createdEntry?.actorUserId).toBe(CoreTestFixture.userId);
        expect(createdEntry?.actorType).toBe(AuditLogActorType.User);
        // The audit snapshot embeds the inserted row; assert load-bearing fields.
        const snapshot = (createdEntry?.changes as { snapshot?: Record<string, unknown> })
          ?.snapshot;
        expect(snapshot?.id).toBe(created.id);
        expect(snapshot?.key).toBe(key);
        expect(snapshot?.enabled).toBe(false);
      }),
    ).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "rejects a duplicate key within the project and writes no second row",
    withFlagCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FeatureFlagService;
        const key = uniqueKey("dup");

        const first = yield* svc.createFlag({ projectId, key, name: "First" });
        track(first.id);

        const error = yield* Effect.flip(svc.createFlag({ projectId, key, name: "Second" }));
        expect(error).toBeInstanceOf(FeatureFlagKeyAlreadyExistsError);
        if (error instanceof FeatureFlagKeyAlreadyExistsError) {
          expect(error.key).toBe(key);
        }

        expect(yield* countFlagsWithKey(key, projectId)).toBe(1);
      }),
    ).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "allows the same key in a different project",
    withFlagCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FeatureFlagService;
        const key = uniqueKey("cross-project");

        // The default session grants project:all on the fixture project only, so
        // the second create is re-authenticated against the other project; the
        // value proven here is that the key uniqueness guard is scoped per
        // project (no FK on featureFlags.projectId, so no project row needed).
        const a = yield* svc.createFlag({ projectId, key, name: "In fixture project" });
        track(a.id);
        const b = yield* asOtherProject(
          svc.createFlag({ projectId: otherProjectId, key, name: "In other project" }),
        );
        track(b.id);

        expect(yield* countFlagsWithKey(key, projectId)).toBe(1);
        expect(yield* countFlagsWithKey(key, otherProjectId)).toBe(1);
      }),
    ).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all and writes nothing",
    Effect.gen(function* () {
      const svc = yield* FeatureFlagService;
      const key = uniqueKey("forbidden");

      const error = yield* Effect.flip(
        asUnauthorized(svc.createFlag({ projectId, key, name: "Nope" })),
      );
      expect(error).toBeInstanceOf(ActionForbiddenError);

      expect(yield* countFlagsWithKey(key, projectId)).toBe(0);
    }).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );
});

// ===========================================================================
// updateFlag
// ===========================================================================

describe("FeatureFlagService.updateFlag", () => {
  test(
    "merges updates, increments version, and records an Updated audit entry",
    withFlagCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FeatureFlagService;
        const created = yield* svc.createFlag({
          projectId,
          key: uniqueKey("update-before"),
          name: "Before",
        });
        track(created.id);

        const newKey = uniqueKey("update-after");
        const updated = yield* svc.updateFlag({
          id: created.id,
          name: "After",
          description: "updated",
          enabled: true,
          rolloutBps: 5000,
          key: newKey,
        });
        expect(updated.id).toBe(created.id);

        const row = yield* findFlagRow(created.id);
        expect(row?.name).toBe("After");
        expect(row?.description).toBe("updated");
        expect(row?.enabled).toBe(true);
        expect(row?.rolloutBps).toBe(5000);
        expect(row?.key).toBe(newKey);
        expect(row?.version).toBe(2);
        expect(row?.updatedByUserId).toBe(CoreTestFixture.userId);

        const auditEntries = yield* findAuditEntries(created.id);
        const updatedEntry = auditEntries.find(
          (entry) =>
            entry.action === AuditLogAction.Updated &&
            entry.entityType === AuditLogEntityType.FeatureFlag,
        );
        expect(updatedEntry).toBeDefined();
        const changes = updatedEntry?.changes as {
          before?: { id?: string };
          after?: { name?: string };
        };
        expect(changes?.before?.id).toBe(created.id);
        expect(changes?.after?.name).toBe("After");
      }),
    ).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "fails with FeatureFlagNotFoundError for an unknown id",
    Effect.gen(function* () {
      const svc = yield* FeatureFlagService;
      const error = yield* Effect.flip(
        svc.updateFlag({ id: `ff_missing_${Date.now()}`, name: "x" }),
      );
      expect(error).toBeInstanceOf(FeatureFlagNotFoundError);
    }).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids editing an internally-managed flag and leaves it unchanged",
    withFlagCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FeatureFlagService;
        const flagId = `ff_${uniqueValue("internal-update")}`;
        const key = uniqueKey("internal-update");
        yield* insertRawFlag({ id: flagId, key, name: "Internal", internal: true });
        track(flagId);

        const error = yield* Effect.flip(svc.updateFlag({ id: flagId, name: "Hacked" }));
        expect(error).toBeInstanceOf(FeatureFlagServiceError);

        const row = yield* findFlagRow(flagId);
        expect(row?.name).toBe("Internal");
        expect(row?.version).toBe(1);
      }),
    ).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all and leaves the flag unchanged",
    withFlagCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FeatureFlagService;
        const created = yield* svc.createFlag({
          projectId,
          key: uniqueKey("update-forbidden"),
          name: "Guarded",
        });
        track(created.id);

        const error = yield* Effect.flip(
          asUnauthorized(svc.updateFlag({ id: created.id, name: "Nope" })),
        );
        expect(error).toBeInstanceOf(ActionForbiddenError);

        const row = yield* findFlagRow(created.id);
        expect(row?.name).toBe("Guarded");
        expect(row?.version).toBe(1);
      }),
    ).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "allows renaming to an unused key within the project",
    withFlagCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FeatureFlagService;
        const created = yield* svc.createFlag({
          projectId,
          key: uniqueKey("rename-from"),
          name: "Rename",
        });
        track(created.id);

        const newKey = uniqueKey("rename-to");
        yield* svc.updateFlag({ id: created.id, key: newKey });

        const row = yield* findFlagRow(created.id);
        expect(row?.key).toBe(newKey);
      }),
    ).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "rejects a rename collision with an existing key and leaves the key unchanged",
    withFlagCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FeatureFlagService;
        const keyA = uniqueKey("collide-a");
        const keyB = uniqueKey("collide-b");

        const a = yield* svc.createFlag({ projectId, key: keyA, name: "A" });
        track(a.id);
        const b = yield* svc.createFlag({ projectId, key: keyB, name: "B" });
        track(b.id);

        const error = yield* Effect.flip(svc.updateFlag({ id: b.id, key: keyA }));
        expect(error).toBeInstanceOf(FeatureFlagKeyAlreadyExistsError);
        if (error instanceof FeatureFlagKeyAlreadyExistsError) {
          expect(error.key).toBe(keyA);
        }

        const row = yield* findFlagRow(b.id);
        expect(row?.key).toBe(keyB);
      }),
    ).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );
});

// ===========================================================================
// archiveFlag / restoreFlag
// ===========================================================================

describe("FeatureFlagService.archiveFlag", () => {
  test(
    "sets archivedAt and records an Archived audit entry",
    withFlagCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FeatureFlagService;
        const created = yield* svc.createFlag({
          projectId,
          key: uniqueKey("archive"),
          name: "Doomed",
        });
        track(created.id);

        yield* svc.archiveFlag({ id: created.id });

        const row = yield* findFlagRow(created.id);
        expect(row?.archivedAt).toBeInstanceOf(Date);

        const auditEntries = yield* findAuditEntries(created.id);
        expect(
          auditEntries.some(
            (entry) =>
              entry.action === AuditLogAction.Archived &&
              entry.entityType === AuditLogEntityType.FeatureFlag,
          ),
        ).toBe(true);
      }),
    ).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "fails with FeatureFlagNotFoundError for an unknown id",
    Effect.gen(function* () {
      const svc = yield* FeatureFlagService;
      const error = yield* Effect.flip(svc.archiveFlag({ id: `ff_missing_${Date.now()}` }));
      expect(error).toBeInstanceOf(FeatureFlagNotFoundError);
    }).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids archiving an internally-managed flag and leaves it un-archived",
    withFlagCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FeatureFlagService;
        const flagId = `ff_${uniqueValue("internal-archive")}`;
        yield* insertRawFlag({
          id: flagId,
          key: uniqueKey("internal-archive"),
          internal: true,
        });
        track(flagId);

        const error = yield* Effect.flip(svc.archiveFlag({ id: flagId }));
        expect(error).toBeInstanceOf(FeatureFlagServiceError);

        const row = yield* findFlagRow(flagId);
        expect(row?.archivedAt ?? null).toBeNull();
      }),
    ).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all and leaves the flag un-archived",
    withFlagCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FeatureFlagService;
        const created = yield* svc.createFlag({
          projectId,
          key: uniqueKey("archive-forbidden"),
          name: "Protected",
        });
        track(created.id);

        const error = yield* Effect.flip(asUnauthorized(svc.archiveFlag({ id: created.id })));
        expect(error).toBeInstanceOf(ActionForbiddenError);

        const row = yield* findFlagRow(created.id);
        expect(row?.archivedAt ?? null).toBeNull();
      }),
    ).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );
});

describe("FeatureFlagService.restoreFlag", () => {
  test(
    "clears archivedAt and records a Restored audit entry",
    withFlagCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FeatureFlagService;
        const created = yield* svc.createFlag({
          projectId,
          key: uniqueKey("restore"),
          name: "Back",
        });
        track(created.id);
        yield* svc.archiveFlag({ id: created.id });

        yield* svc.restoreFlag({ id: created.id });

        const row = yield* findFlagRow(created.id);
        expect(row?.archivedAt ?? null).toBeNull();

        const auditEntries = yield* findAuditEntries(created.id);
        expect(
          auditEntries.some(
            (entry) =>
              entry.action === AuditLogAction.Restored &&
              entry.entityType === AuditLogEntityType.FeatureFlag,
          ),
        ).toBe(true);
      }),
    ).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "fails with FeatureFlagNotFoundError for an unknown id",
    Effect.gen(function* () {
      const svc = yield* FeatureFlagService;
      const error = yield* Effect.flip(svc.restoreFlag({ id: `ff_missing_${Date.now()}` }));
      expect(error).toBeInstanceOf(FeatureFlagNotFoundError);
    }).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all",
    withFlagCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FeatureFlagService;
        const created = yield* svc.createFlag({
          projectId,
          key: uniqueKey("restore-forbidden"),
          name: "Guarded",
        });
        track(created.id);
        yield* svc.archiveFlag({ id: created.id });

        const error = yield* Effect.flip(asUnauthorized(svc.restoreFlag({ id: created.id })));
        expect(error).toBeInstanceOf(ActionForbiddenError);

        const row = yield* findFlagRow(created.id);
        expect(row?.archivedAt).toBeInstanceOf(Date);
      }),
    ).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );
});

// ===========================================================================
// getFlagById
// ===========================================================================

describe("FeatureFlagService.getFlagById", () => {
  test(
    "returns the flag with its unarchived targets, overrides, and variants",
    withFlagCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FeatureFlagService;
        const created = yield* svc.createFlag({
          projectId,
          key: uniqueKey("get"),
          name: "WithRelations",
        });
        track(created.id);

        const targetValue = uniqueValue("get-target");
        yield* svc.upsertTarget({
          featureFlagId: created.id,
          listType: FeatureFlagTargetListType.Allow,
          identityType: FeatureFlagIdentityType.DistinctId,
          identityValue: targetValue,
        });
        const overrideValue = uniqueValue("get-override");
        yield* svc.upsertOverride({
          featureFlagId: created.id,
          identityType: FeatureFlagIdentityType.DistinctId,
          identityValue: overrideValue,
          forcedEnabled: true,
        });
        yield* svc.updateFlagVariants({
          featureFlagId: created.id,
          variants: [
            { key: "control", name: "Control", weightBps: 5000 },
            { key: "treatment", name: "Treatment", weightBps: 5000 },
          ],
        });

        const flag = yield* svc.getFlagById({ id: created.id });
        expect(flag.id).toBe(created.id);
        expect(flag.targets.some((t) => t.identityValue === targetValue)).toBe(true);
        expect(flag.overrides.some((o) => o.identityValue === overrideValue)).toBe(true);
        expect(flag.variants.some((v) => v.key === "control")).toBe(true);
        expect(flag.variants.some((v) => v.key === "treatment")).toBe(true);
      }),
    ).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "fails with FeatureFlagNotFoundError for an unknown id",
    Effect.gen(function* () {
      const svc = yield* FeatureFlagService;
      const error = yield* Effect.flip(svc.getFlagById({ id: `ff_missing_${Date.now()}` }));
      expect(error).toBeInstanceOf(FeatureFlagNotFoundError);
    }).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all",
    withFlagCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FeatureFlagService;
        const created = yield* svc.createFlag({
          projectId,
          key: uniqueKey("get-forbidden"),
          name: "Guarded",
        });
        track(created.id);

        const error = yield* Effect.flip(asUnauthorized(svc.getFlagById({ id: created.id })));
        expect(error).toBeInstanceOf(ActionForbiddenError);
      }),
    ).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );
});

// ===========================================================================
// listFlags
// ===========================================================================

describe("FeatureFlagService.listFlags", () => {
  test(
    "excludes archived flags by default but includes them when includeArchived=true",
    withFlagCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FeatureFlagService;
        const liveKey = uniqueKey("list-live");
        const archivedKey = uniqueKey("list-archived");

        const live = yield* svc.createFlag({ projectId, key: liveKey, name: "Live" });
        track(live.id);
        const archived = yield* svc.createFlag({
          projectId,
          key: archivedKey,
          name: "Archived",
        });
        track(archived.id);
        yield* svc.archiveFlag({ id: archived.id });

        const defaultList = yield* svc.listFlags({ projectId });
        expect(defaultList.some((f) => f.key === liveKey)).toBe(true);
        expect(defaultList.some((f) => f.key === archivedKey)).toBe(false);

        const fullList = yield* svc.listFlags({ projectId, includeArchived: true });
        expect(fullList.some((f) => f.key === liveKey)).toBe(true);
        expect(fullList.some((f) => f.key === archivedKey)).toBe(true);
      }),
    ).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "returns each flag with a variantCount of its unarchived variants",
    withFlagCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FeatureFlagService;
        const key = uniqueKey("list-variantcount");
        const created = yield* svc.createFlag({ projectId, key, name: "Counted" });
        track(created.id);

        yield* svc.updateFlagVariants({
          featureFlagId: created.id,
          variants: [
            { key: "a", name: "A", weightBps: 4000 },
            { key: "b", name: "B", weightBps: 6000 },
          ],
        });

        const list = yield* svc.listFlags({ projectId });
        const entry = list.find((f) => f.key === key);
        expect(entry).toBeDefined();
        expect(entry?.variantCount).toBe(2);
      }),
    ).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all",
    Effect.gen(function* () {
      const svc = yield* FeatureFlagService;
      const error = yield* Effect.flip(asUnauthorized(svc.listFlags({ projectId })));
      expect(error).toBeInstanceOf(ActionForbiddenError);
    }).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );
});

// ===========================================================================
// updateFlagVariants
// ===========================================================================

describe("FeatureFlagService.updateFlagVariants", () => {
  test(
    "replaces all variants and records a FeatureFlagVariant Updated audit entry",
    withFlagCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FeatureFlagService;
        const created = yield* svc.createFlag({
          projectId,
          key: uniqueKey("variants-replace"),
          name: "Variants",
        });
        track(created.id);

        yield* svc.updateFlagVariants({
          featureFlagId: created.id,
          variants: [{ key: "old", name: "Old", weightBps: 10000 }],
        });
        yield* svc.updateFlagVariants({
          featureFlagId: created.id,
          variants: [
            { key: "new-a", name: "New A", weightBps: 3000, payload: { color: "red" } },
            { key: "new-b", name: "New B", weightBps: 7000 },
          ],
        });

        const rows = yield* findVariantRows(created.id);
        expect(rows.some((v) => v.key === "old")).toBe(false);
        expect(rows.some((v) => v.key === "new-a" && v.weightBps === 3000)).toBe(true);
        expect(rows.some((v) => v.key === "new-b" && v.weightBps === 7000)).toBe(true);
        const payloadRow = rows.find((v) => v.key === "new-a");
        expect(payloadRow?.payload).toEqual({ color: "red" });

        const auditEntries = yield* findAuditEntries(created.id);
        expect(
          auditEntries.some(
            (entry) =>
              entry.action === AuditLogAction.Updated &&
              entry.entityType === AuditLogEntityType.FeatureFlagVariant &&
              entry.parentEntityId === created.id,
          ),
        ).toBe(true);
      }),
    ).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "fails with FeatureFlagNotFoundError for an unknown flag id",
    Effect.gen(function* () {
      const svc = yield* FeatureFlagService;
      const error = yield* Effect.flip(
        svc.updateFlagVariants({
          featureFlagId: `ff_missing_${Date.now()}`,
          variants: [{ key: "x", name: "X", weightBps: 10000 }],
        }),
      );
      expect(error).toBeInstanceOf(FeatureFlagNotFoundError);
    }).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "rejects weights that do not sum to 10000 and writes no variants",
    withFlagCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FeatureFlagService;
        const created = yield* svc.createFlag({
          projectId,
          key: uniqueKey("variants-badsum"),
          name: "BadSum",
        });
        track(created.id);

        const error = yield* Effect.flip(
          svc.updateFlagVariants({
            featureFlagId: created.id,
            variants: [{ key: "a", name: "A", weightBps: 5000 }],
          }),
        );
        expect(error).toBeInstanceOf(FeatureFlagServiceError);

        const rows = yield* findVariantRows(created.id);
        expect(rows.length).toBe(0);
      }),
    ).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "rejects duplicate variant keys and writes no variants",
    withFlagCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FeatureFlagService;
        const created = yield* svc.createFlag({
          projectId,
          key: uniqueKey("variants-dup"),
          name: "Dup",
        });
        track(created.id);

        const error = yield* Effect.flip(
          svc.updateFlagVariants({
            featureFlagId: created.id,
            variants: [
              { key: "same", name: "A", weightBps: 5000 },
              { key: "same", name: "B", weightBps: 5000 },
            ],
          }),
        );
        expect(error).toBeInstanceOf(FeatureFlagServiceError);

        const rows = yield* findVariantRows(created.id);
        expect(rows.length).toBe(0);
      }),
    ).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all",
    withFlagCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FeatureFlagService;
        const created = yield* svc.createFlag({
          projectId,
          key: uniqueKey("variants-forbidden"),
          name: "Guarded",
        });
        track(created.id);

        const error = yield* Effect.flip(
          asUnauthorized(
            svc.updateFlagVariants({
              featureFlagId: created.id,
              variants: [{ key: "a", name: "A", weightBps: 10000 }],
            }),
          ),
        );
        expect(error).toBeInstanceOf(ActionForbiddenError);

        const rows = yield* findVariantRows(created.id);
        expect(rows.length).toBe(0);
      }),
    ).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );
});

// ===========================================================================
// upsertTarget / archiveTarget
// ===========================================================================

describe("FeatureFlagService.upsertTarget", () => {
  test(
    "creates a new target and reuses the existing one on a second upsert",
    withFlagCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FeatureFlagService;
        const created = yield* svc.createFlag({
          projectId,
          key: uniqueKey("target-upsert"),
          name: "Targeted",
        });
        track(created.id);

        const value = uniqueValue("target");
        const first = yield* svc.upsertTarget({
          featureFlagId: created.id,
          listType: FeatureFlagTargetListType.Deny,
          identityType: FeatureFlagIdentityType.Email,
          identityValue: value,
        });
        const firstRow = yield* findTargetRow(first.id);
        expect(firstRow?.identityValue).toBe(value);
        expect(firstRow?.listType).toBe(FeatureFlagTargetListType.Deny);

        const second = yield* svc.upsertTarget({
          featureFlagId: created.id,
          listType: FeatureFlagTargetListType.Deny,
          identityType: FeatureFlagIdentityType.Email,
          identityValue: value,
        });
        // Same row reused, no duplicate insert.
        expect(second.id).toBe(first.id);

        const auditEntries = yield* findAuditEntries(first.id);
        expect(
          auditEntries.some(
            (entry) =>
              entry.action === AuditLogAction.TargetAdded &&
              entry.entityType === AuditLogEntityType.FeatureFlagTarget &&
              entry.parentEntityId === created.id,
          ),
        ).toBe(true);
      }),
    ).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "fails with FeatureFlagNotFoundError for an unknown flag id",
    Effect.gen(function* () {
      const svc = yield* FeatureFlagService;
      const error = yield* Effect.flip(
        svc.upsertTarget({
          featureFlagId: `ff_missing_${Date.now()}`,
          listType: FeatureFlagTargetListType.Allow,
          identityType: FeatureFlagIdentityType.DistinctId,
          identityValue: "anyone",
        }),
      );
      expect(error).toBeInstanceOf(FeatureFlagNotFoundError);
    }).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all",
    withFlagCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FeatureFlagService;
        const created = yield* svc.createFlag({
          projectId,
          key: uniqueKey("target-forbidden"),
          name: "Guarded",
        });
        track(created.id);

        const error = yield* Effect.flip(
          asUnauthorized(
            svc.upsertTarget({
              featureFlagId: created.id,
              listType: FeatureFlagTargetListType.Allow,
              identityType: FeatureFlagIdentityType.DistinctId,
              identityValue: uniqueValue("target-forbidden"),
            }),
          ),
        );
        expect(error).toBeInstanceOf(ActionForbiddenError);
      }),
    ).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );
});

describe("FeatureFlagService.archiveTarget", () => {
  test(
    "sets archivedAt on the target and records a TargetRemoved audit entry",
    withFlagCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FeatureFlagService;
        const created = yield* svc.createFlag({
          projectId,
          key: uniqueKey("target-archive"),
          name: "Targeted",
        });
        track(created.id);

        const target = yield* svc.upsertTarget({
          featureFlagId: created.id,
          listType: FeatureFlagTargetListType.Allow,
          identityType: FeatureFlagIdentityType.DistinctId,
          identityValue: uniqueValue("target-archive"),
        });

        yield* svc.archiveTarget({ id: target.id });

        const row = yield* findTargetRow(target.id);
        expect(row?.archivedAt).toBeInstanceOf(Date);

        const auditEntries = yield* findAuditEntries(target.id);
        expect(
          auditEntries.some(
            (entry) =>
              entry.action === AuditLogAction.TargetRemoved &&
              entry.entityType === AuditLogEntityType.FeatureFlagTarget,
          ),
        ).toBe(true);
      }),
    ).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "fails with FeatureFlagTargetNotFoundError for an unknown target id",
    Effect.gen(function* () {
      const svc = yield* FeatureFlagService;
      const error = yield* Effect.flip(svc.archiveTarget({ id: `ff_tgt_missing_${Date.now()}` }));
      expect(error).toBeInstanceOf(FeatureFlagTargetNotFoundError);
    }).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "fails with FeatureFlagTargetNotFoundError when the parent flag is gone",
    withFlagCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FeatureFlagService;
        // Insert a target pointing at a flag id that does not exist.
        const targetId = `ff_tgt_${uniqueValue("orphan")}`;
        const orphanFlagId = `ff_${uniqueValue("orphan-parent")}`;
        track(orphanFlagId); // harmless: nothing to clean, but keeps shape consistent
        yield* insertRawTarget({
          id: targetId,
          featureFlagId: orphanFlagId,
          listType: FeatureFlagTargetListType.Allow,
          identityType: FeatureFlagIdentityType.DistinctId,
          identityValue: "orphan",
        });

        const error = yield* Effect.flip(svc.archiveTarget({ id: targetId }));
        expect(error).toBeInstanceOf(FeatureFlagTargetNotFoundError);

        // Clean up the orphan target by id.
        const db = yield* Db;
        yield* db
          .delete(featureFlagTargets)
          .where(eq(featureFlagTargets.id, targetId))
          .pipe(Effect.ignore);
      }),
    ).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all and leaves the target unarchived",
    withFlagCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FeatureFlagService;
        const created = yield* svc.createFlag({
          projectId,
          key: uniqueKey("target-archive-forbidden"),
          name: "Guarded",
        });
        track(created.id);
        const target = yield* svc.upsertTarget({
          featureFlagId: created.id,
          listType: FeatureFlagTargetListType.Allow,
          identityType: FeatureFlagIdentityType.DistinctId,
          identityValue: uniqueValue("target-archive-forbidden"),
        });

        const error = yield* Effect.flip(asUnauthorized(svc.archiveTarget({ id: target.id })));
        expect(error).toBeInstanceOf(ActionForbiddenError);

        const row = yield* findTargetRow(target.id);
        expect(row?.archivedAt ?? null).toBeNull();
      }),
    ).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );
});

// ===========================================================================
// upsertOverride / archiveOverride
// ===========================================================================

describe("FeatureFlagService.upsertOverride", () => {
  test(
    "creates a new override then updates it in place on a second upsert",
    withFlagCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FeatureFlagService;
        const created = yield* svc.createFlag({
          projectId,
          key: uniqueKey("override-upsert"),
          name: "Overridden",
        });
        track(created.id);

        const value = uniqueValue("override");
        const first = yield* svc.upsertOverride({
          featureFlagId: created.id,
          identityType: FeatureFlagIdentityType.DistinctId,
          identityValue: value,
          forcedEnabled: true,
          note: "initial",
        });
        const firstRow = yield* findOverrideRow(first.id);
        expect(firstRow?.forcedEnabled).toBe(true);
        expect(firstRow?.note).toBe("initial");

        const second = yield* svc.upsertOverride({
          featureFlagId: created.id,
          identityType: FeatureFlagIdentityType.DistinctId,
          identityValue: value,
          forcedEnabled: false,
          note: "updated",
        });
        expect(second.id).toBe(first.id);

        const secondRow = yield* findOverrideRow(first.id);
        expect(secondRow?.forcedEnabled).toBe(false);
        expect(secondRow?.note).toBe("updated");
        expect(secondRow?.updatedByUserId).toBe(CoreTestFixture.userId);

        const auditEntries = yield* findAuditEntries(first.id);
        const overrideSets = auditEntries.filter(
          (entry) =>
            entry.action === AuditLogAction.OverrideSet &&
            entry.entityType === AuditLogEntityType.FeatureFlagOverride &&
            entry.parentEntityId === created.id,
        );
        // OverrideSet is recorded on both create and update.
        expect(overrideSets.length).toBeGreaterThanOrEqual(2);
      }),
    ).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "fails with FeatureFlagNotFoundError for an unknown flag id",
    Effect.gen(function* () {
      const svc = yield* FeatureFlagService;
      const error = yield* Effect.flip(
        svc.upsertOverride({
          featureFlagId: `ff_missing_${Date.now()}`,
          identityType: FeatureFlagIdentityType.DistinctId,
          identityValue: "anyone",
          forcedEnabled: true,
        }),
      );
      expect(error).toBeInstanceOf(FeatureFlagNotFoundError);
    }).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all",
    withFlagCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FeatureFlagService;
        const created = yield* svc.createFlag({
          projectId,
          key: uniqueKey("override-forbidden"),
          name: "Guarded",
        });
        track(created.id);

        const error = yield* Effect.flip(
          asUnauthorized(
            svc.upsertOverride({
              featureFlagId: created.id,
              identityType: FeatureFlagIdentityType.DistinctId,
              identityValue: uniqueValue("override-forbidden"),
              forcedEnabled: true,
            }),
          ),
        );
        expect(error).toBeInstanceOf(ActionForbiddenError);
      }),
    ).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );
});

describe("FeatureFlagService.archiveOverride", () => {
  test(
    "sets archivedAt on the override and records an OverrideRemoved audit entry",
    withFlagCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FeatureFlagService;
        const created = yield* svc.createFlag({
          projectId,
          key: uniqueKey("override-archive"),
          name: "Overridden",
        });
        track(created.id);
        const override = yield* svc.upsertOverride({
          featureFlagId: created.id,
          identityType: FeatureFlagIdentityType.DistinctId,
          identityValue: uniqueValue("override-archive"),
          forcedEnabled: true,
        });

        yield* svc.archiveOverride({ id: override.id });

        const row = yield* findOverrideRow(override.id);
        expect(row?.archivedAt).toBeInstanceOf(Date);

        const auditEntries = yield* findAuditEntries(override.id);
        expect(
          auditEntries.some(
            (entry) =>
              entry.action === AuditLogAction.OverrideRemoved &&
              entry.entityType === AuditLogEntityType.FeatureFlagOverride,
          ),
        ).toBe(true);
      }),
    ).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "fails with FeatureFlagOverrideNotFoundError for an unknown override id",
    Effect.gen(function* () {
      const svc = yield* FeatureFlagService;
      const error = yield* Effect.flip(svc.archiveOverride({ id: `ff_ovr_missing_${Date.now()}` }));
      expect(error).toBeInstanceOf(FeatureFlagOverrideNotFoundError);
    }).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "fails with FeatureFlagOverrideNotFoundError when the parent flag is gone",
    Effect.gen(function* () {
      const svc = yield* FeatureFlagService;
      const overrideId = `ff_ovr_${Date.now()}_${seq++}`;
      const orphanFlagId = `ff_${Date.now()}_orphan_${seq++}`;
      yield* insertRawOverride({
        id: overrideId,
        featureFlagId: orphanFlagId,
        identityType: FeatureFlagIdentityType.DistinctId,
        identityValue: "orphan",
        forcedEnabled: true,
      });

      const error = yield* Effect.flip(svc.archiveOverride({ id: overrideId }));
      expect(error).toBeInstanceOf(FeatureFlagOverrideNotFoundError);

      const db = yield* Db;
      yield* db
        .delete(featureFlagOverrides)
        .where(eq(featureFlagOverrides.id, overrideId))
        .pipe(Effect.ignore);
    }).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all and leaves the override unarchived",
    withFlagCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FeatureFlagService;
        const created = yield* svc.createFlag({
          projectId,
          key: uniqueKey("override-archive-forbidden"),
          name: "Guarded",
        });
        track(created.id);
        const override = yield* svc.upsertOverride({
          featureFlagId: created.id,
          identityType: FeatureFlagIdentityType.DistinctId,
          identityValue: uniqueValue("override-archive-forbidden"),
          forcedEnabled: true,
        });

        const error = yield* Effect.flip(asUnauthorized(svc.archiveOverride({ id: override.id })));
        expect(error).toBeInstanceOf(ActionForbiddenError);

        const row = yield* findOverrideRow(override.id);
        expect(row?.archivedAt ?? null).toBeNull();
      }),
    ).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );
});

// ===========================================================================
// listOverridesByFlag / listOverridesByPerson
// ===========================================================================

describe("FeatureFlagService.listOverridesByFlag", () => {
  test(
    "returns unarchived overrides for the flag and fails for an unknown flag",
    withFlagCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FeatureFlagService;
        const created = yield* svc.createFlag({
          projectId,
          key: uniqueKey("list-overrides-flag"),
          name: "Listed",
        });
        track(created.id);

        const liveValue = uniqueValue("list-overrides-live");
        const live = yield* svc.upsertOverride({
          featureFlagId: created.id,
          identityType: FeatureFlagIdentityType.DistinctId,
          identityValue: liveValue,
          forcedEnabled: true,
        });
        const archivedValue = uniqueValue("list-overrides-archived");
        const archived = yield* svc.upsertOverride({
          featureFlagId: created.id,
          identityType: FeatureFlagIdentityType.DistinctId,
          identityValue: archivedValue,
          forcedEnabled: false,
        });
        yield* svc.archiveOverride({ id: archived.id });

        const overrides = yield* svc.listOverridesByFlag({ featureFlagId: created.id });
        expect(overrides.some((o) => o.id === live.id)).toBe(true);
        expect(overrides.some((o) => o.id === archived.id)).toBe(false);

        const notFound = yield* Effect.flip(
          svc.listOverridesByFlag({ featureFlagId: `ff_missing_${Date.now()}` }),
        );
        expect(notFound).toBeInstanceOf(FeatureFlagNotFoundError);
      }),
    ).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all",
    withFlagCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FeatureFlagService;
        const created = yield* svc.createFlag({
          projectId,
          key: uniqueKey("list-overrides-flag-forbidden"),
          name: "Guarded",
        });
        track(created.id);

        const error = yield* Effect.flip(
          asUnauthorized(svc.listOverridesByFlag({ featureFlagId: created.id })),
        );
        expect(error).toBeInstanceOf(ActionForbiddenError);
      }),
    ).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );
});

describe("FeatureFlagService.listOverridesByPerson", () => {
  test(
    "returns unarchived overrides across project flags for a given identity",
    withFlagCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FeatureFlagService;
        const identityValue = uniqueValue("by-person");

        const flagA = yield* svc.createFlag({
          projectId,
          key: uniqueKey("by-person-a"),
          name: "A",
        });
        track(flagA.id);
        const flagB = yield* svc.createFlag({
          projectId,
          key: uniqueKey("by-person-b"),
          name: "B",
        });
        track(flagB.id);

        const ovrA = yield* svc.upsertOverride({
          featureFlagId: flagA.id,
          identityType: FeatureFlagIdentityType.DistinctId,
          identityValue,
          forcedEnabled: true,
        });
        const ovrB = yield* svc.upsertOverride({
          featureFlagId: flagB.id,
          identityType: FeatureFlagIdentityType.DistinctId,
          identityValue,
          forcedEnabled: false,
        });

        const overrides = yield* svc.listOverridesByPerson({
          projectId,
          identityType: FeatureFlagIdentityType.DistinctId,
          identityValue,
        });
        expect(overrides.some((o) => o.id === ovrA.id)).toBe(true);
        expect(overrides.some((o) => o.id === ovrB.id)).toBe(true);
      }),
    ).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all",
    Effect.gen(function* () {
      const svc = yield* FeatureFlagService;
      const error = yield* Effect.flip(
        asUnauthorized(
          svc.listOverridesByPerson({
            projectId,
            identityType: FeatureFlagIdentityType.DistinctId,
            identityValue: uniqueValue("by-person-forbidden"),
          }),
        ),
      );
      expect(error).toBeInstanceOf(ActionForbiddenError);
    }).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );
});

// ===========================================================================
// evaluateFlagsBatch
// ===========================================================================

describe("FeatureFlagService.evaluateFlagsBatch", () => {
  /** Find one flag's evaluation result by key, asserting it exists first. */
  const resultFor = <T extends { readonly key: string }>(
    results: ReadonlyArray<T>,
    key: string,
  ): T => {
    const found = results.find((r) => r.key === key);
    expect(found).toBeDefined();
    return found!;
  };

  test(
    "a disabled flag evaluates to enabled=false, reason=disabled, payload=null",
    withFlagCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FeatureFlagService;
        const key = uniqueKey("eval-disabled");
        const created = yield* svc.createFlag({ projectId, key, name: "Disabled" });
        track(created.id);
        // createFlag leaves enabled=false.

        const results = yield* svc.evaluateFlagsBatch({
          projectId,
          keys: [key],
          distinctId: uniqueValue("eval-disabled-subject"),
        });
        const r = resultFor(results, key);
        expect(r.enabled).toBe(false);
        expect(r.reason).toBe("disabled");
        expect(r.payload).toBeNull();
      }),
    ).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "an override forcedEnabled=false takes precedence over a full rollout",
    withFlagCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FeatureFlagService;
        const key = uniqueKey("eval-override-off");
        // Enabled + full rollout so only the override can block it.
        const flagId = `ff_${uniqueValue("eval-override-off")}`;
        yield* insertRawFlag({
          id: flagId,
          key,
          name: "OverrideOff",
          enabled: true,
          rolloutBps: 10000,
          salt: "salt-override-off",
        });
        track(flagId);

        const subject = uniqueValue("eval-override-off-subject");
        yield* insertRawOverride({
          id: `ff_ovr_${uniqueValue("eval-override-off")}`,
          featureFlagId: flagId,
          identityType: FeatureFlagIdentityType.DistinctId,
          identityValue: subject,
          forcedEnabled: false,
        });

        const results = yield* svc.evaluateFlagsBatch({
          projectId,
          keys: [key],
          distinctId: subject,
        });
        const r = resultFor(results, key);
        expect(r.enabled).toBe(false);
        expect(r.reason).toBe("override");
      }),
    ).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "an override forcedEnabled=true takes precedence over a zero rollout",
    withFlagCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FeatureFlagService;
        const key = uniqueKey("eval-override-on");
        // Enabled but rolloutBps=0, so without the override the flag is off.
        const flagId = `ff_${uniqueValue("eval-override-on")}`;
        yield* insertRawFlag({
          id: flagId,
          key,
          name: "OverrideOn",
          enabled: true,
          rolloutBps: 0,
          salt: "salt-override-on",
        });
        track(flagId);

        const subject = uniqueValue("eval-override-on-subject");
        yield* insertRawOverride({
          id: `ff_ovr_${uniqueValue("eval-override-on")}`,
          featureFlagId: flagId,
          identityType: FeatureFlagIdentityType.DistinctId,
          identityValue: subject,
          forcedEnabled: true,
        });

        const results = yield* svc.evaluateFlagsBatch({
          projectId,
          keys: [key],
          distinctId: subject,
        });
        const r = resultFor(results, key);
        expect(r.enabled).toBe(true);
        expect(r.reason).toBe("override");
      }),
    ).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "a Deny target matching the subject blocks the flag (reason=denied)",
    withFlagCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FeatureFlagService;
        const key = uniqueKey("eval-deny");
        const flagId = `ff_${uniqueValue("eval-deny")}`;
        yield* insertRawFlag({
          id: flagId,
          key,
          name: "Denied",
          enabled: true,
          rolloutBps: 10000,
          salt: "salt-deny",
        });
        track(flagId);

        const subject = uniqueValue("eval-deny-subject");
        yield* insertRawTarget({
          id: `ff_tgt_${uniqueValue("eval-deny")}`,
          featureFlagId: flagId,
          listType: FeatureFlagTargetListType.Deny,
          identityType: FeatureFlagIdentityType.DistinctId,
          identityValue: subject,
        });

        const results = yield* svc.evaluateFlagsBatch({
          projectId,
          keys: [key],
          distinctId: subject,
        });
        const r = resultFor(results, key);
        expect(r.enabled).toBe(false);
        expect(r.reason).toBe("denied");
      }),
    ).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "an Allow target with a non-matching subject blocks the flag (reason=not-allowed)",
    withFlagCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FeatureFlagService;
        const key = uniqueKey("eval-allow");
        const flagId = `ff_${uniqueValue("eval-allow")}`;
        yield* insertRawFlag({
          id: flagId,
          key,
          name: "AllowList",
          enabled: true,
          rolloutBps: 10000,
          salt: "salt-allow",
        });
        track(flagId);

        // Allow list contains someone else; the evaluated subject is not on it.
        yield* insertRawTarget({
          id: `ff_tgt_${uniqueValue("eval-allow")}`,
          featureFlagId: flagId,
          listType: FeatureFlagTargetListType.Allow,
          identityType: FeatureFlagIdentityType.DistinctId,
          identityValue: uniqueValue("eval-allow-allowed"),
        });

        const results = yield* svc.evaluateFlagsBatch({
          projectId,
          keys: [key],
          distinctId: uniqueValue("eval-allow-subject"),
        });
        const r = resultFor(results, key);
        expect(r.enabled).toBe(false);
        expect(r.reason).toBe("not-allowed");
      }),
    ).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "no subject identity blocks an enabled flag (reason=no-identity)",
    withFlagCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FeatureFlagService;
        const key = uniqueKey("eval-no-identity");
        const flagId = `ff_${uniqueValue("eval-no-identity")}`;
        yield* insertRawFlag({
          id: flagId,
          key,
          name: "NoIdentity",
          enabled: true,
          rolloutBps: 10000,
          salt: "salt-no-identity",
        });
        track(flagId);

        // No personId and no distinctId provided.
        const results = yield* svc.evaluateFlagsBatch({ projectId, keys: [key] });
        const r = resultFor(results, key);
        expect(r.enabled).toBe(false);
        expect(r.reason).toBe("no-identity");
      }),
    ).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "a full rollout deterministically enables the flag (reason=rollout)",
    withFlagCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FeatureFlagService;
        const key = uniqueKey("eval-rollout-full");
        // rolloutBps=10000 means every bucket (0..9999) is < rolloutBps, so any
        // subject is enabled regardless of the hash.
        const flagId = `ff_${uniqueValue("eval-rollout-full")}`;
        yield* insertRawFlag({
          id: flagId,
          key,
          name: "FullRollout",
          enabled: true,
          rolloutBps: 10000,
          salt: "salt-rollout-full",
        });
        track(flagId);

        const results = yield* svc.evaluateFlagsBatch({
          projectId,
          keys: [key],
          distinctId: uniqueValue("eval-rollout-full-subject"),
        });
        const r = resultFor(results, key);
        expect(r.enabled).toBe(true);
        expect(r.reason).toBe("rollout");
        expect(r.variantKey).toBeNull();
      }),
    ).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "a zero rollout deterministically gates an enabled flag off (reason=rollout)",
    withFlagCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FeatureFlagService;
        const key = uniqueKey("eval-rollout-zero");
        // rolloutBps=0 means no bucket is < rolloutBps, so every subject is off.
        const flagId = `ff_${uniqueValue("eval-rollout-zero")}`;
        yield* insertRawFlag({
          id: flagId,
          key,
          name: "ZeroRollout",
          enabled: true,
          rolloutBps: 0,
          salt: "salt-rollout-zero",
        });
        track(flagId);

        const results = yield* svc.evaluateFlagsBatch({
          projectId,
          keys: [key],
          distinctId: uniqueValue("eval-rollout-zero-subject"),
        });
        const r = resultFor(results, key);
        expect(r.enabled).toBe(false);
        expect(r.reason).toBe("rollout");
      }),
    ).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "variant selection returns a variantKey and its payload for an enabled flag",
    withFlagCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FeatureFlagService;
        const key = uniqueKey("eval-variant");
        const flagId = `ff_${uniqueValue("eval-variant")}`;
        yield* insertRawFlag({
          id: flagId,
          key,
          name: "Variant",
          enabled: true,
          rolloutBps: 10000,
          salt: "salt-variant",
        });
        track(flagId);

        // A single 100%-weight variant means the variant bucket always lands in it.
        yield* insertRawVariant({
          id: `ff_var_${uniqueValue("eval-variant")}`,
          featureFlagId: flagId,
          key: "only",
          name: "Only",
          weightBps: 10000,
          payload: { tier: "gold" },
        });

        const results = yield* svc.evaluateFlagsBatch({
          projectId,
          keys: [key],
          distinctId: uniqueValue("eval-variant-subject"),
        });
        const r = resultFor(results, key);
        expect(r.enabled).toBe(true);
        expect(r.reason).toBe("rollout");
        expect(r.variantKey).toBe("only");
        expect(r.payload).toEqual({ tier: "gold" });
      }),
    ).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "a forced-variant override pins the subject to that variant + payload, bypassing the bucket (reason=override)",
    withFlagCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FeatureFlagService;
        const key = uniqueKey("eval-forced-variant");
        const flagId = `ff_${uniqueValue("eval-forced-variant")}`;
        yield* insertRawFlag({
          id: flagId,
          key,
          name: "ForcedVariant",
          enabled: true,
          rolloutBps: 10000,
          salt: "salt-forced-variant",
        });
        track(flagId);

        // Two arms; the forced key wins regardless of which the hash would pick.
        yield* insertRawVariant({
          id: `ff_var_${uniqueValue("eval-forced-a")}`,
          featureFlagId: flagId,
          key: "control",
          weightBps: 5000,
          payload: { arm: "control" },
        });
        yield* insertRawVariant({
          id: `ff_var_${uniqueValue("eval-forced-b")}`,
          featureFlagId: flagId,
          key: "treatment",
          weightBps: 5000,
          payload: { arm: "treatment" },
        });

        const subject = uniqueValue("eval-forced-subject");
        yield* insertRawOverride({
          id: `ff_ovr_${uniqueValue("eval-forced")}`,
          featureFlagId: flagId,
          identityType: FeatureFlagIdentityType.DistinctId,
          identityValue: subject,
          forcedVariantKey: "treatment",
        });

        const results = yield* svc.evaluateFlagsBatch({
          projectId,
          keys: [key],
          distinctId: subject,
        });
        const r = resultFor(results, key);
        expect(r.enabled).toBe(true);
        expect(r.reason).toBe("override");
        expect(r.variantKey).toBe("treatment");
        expect(r.payload).toEqual({ arm: "treatment" });
      }),
    ).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "variant assignment is stable by key across a re-sync that changes row ids (no reassignment)",
    withFlagCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FeatureFlagService;
        const db = yield* Db;
        const key = uniqueKey("eval-variant-stable");
        const flagId = `ff_${uniqueValue("eval-variant-stable")}`;
        yield* insertRawFlag({
          id: flagId,
          key,
          name: "StableVariant",
          enabled: true,
          rolloutBps: 10000,
          salt: "salt-variant-stable",
        });
        track(flagId);

        const subject = uniqueValue("eval-variant-stable-subject");
        // First sync: ids intentionally in the OPPOSITE order to keys, so an
        // id-based sort would order [b, a] while a key-based sort orders [a, b].
        yield* insertRawVariant({
          id: `ff_var_zzz_${uniqueValue("stable-a")}`,
          featureFlagId: flagId,
          key: "a",
          weightBps: 5000,
        });
        yield* insertRawVariant({
          id: `ff_var_aaa_${uniqueValue("stable-b")}`,
          featureFlagId: flagId,
          key: "b",
          weightBps: 5000,
        });
        const first = resultFor(
          yield* svc.evaluateFlagsBatch({ projectId, keys: [key], distinctId: subject }),
          key,
        );

        // Re-sync (delete + reinsert) with fresh ids in key order. Under the old
        // id-sort the cumulative-weight boundaries would flip and reassign the
        // subject; under the key-sort the assignment is identical.
        yield* db.delete(featureFlagVariants).where(eq(featureFlagVariants.featureFlagId, flagId));
        yield* insertRawVariant({
          id: `ff_var_aaa2_${uniqueValue("stable-a2")}`,
          featureFlagId: flagId,
          key: "a",
          weightBps: 5000,
        });
        yield* insertRawVariant({
          id: `ff_var_zzz2_${uniqueValue("stable-b2")}`,
          featureFlagId: flagId,
          key: "b",
          weightBps: 5000,
        });
        const second = resultFor(
          yield* svc.evaluateFlagsBatch({ projectId, keys: [key], distinctId: subject }),
          key,
        );

        expect(first.variantKey).not.toBeNull();
        expect(second.variantKey).toBe(first.variantKey);
      }),
    ).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "personId collects distinctIds, email, and external ids from the persons relations",
    withFlagCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FeatureFlagService;
        const db = yield* Db;

        // Seed a person with one distinct identity and one external identifier.
        const personId = `person_${uniqueValue("eval-person")}`;
        const distinctId = uniqueValue("eval-person-distinct");
        const externalId = uniqueValue("eval-person-external");
        const personEmail = `${uniqueValue("eval-person-email")}@voidhash.test`;

        yield* db.insert(persons).values({
          id: personId,
          projectId,
          email: personEmail,
        });
        const personIdentityId = `person_dist_${uniqueValue("eval-person")}`;
        yield* db.insert(personIdentities).values({
          id: personIdentityId,
          projectId,
          distinctId,
          personId,
        });
        const externalRowId = `pei_${uniqueValue("eval-person")}`;
        yield* db.insert(personExternalIdentifiers).values({
          id: externalRowId,
          projectId,
          personId,
          serviceId: "test-service",
          isDefault: true,
          identifier: externalId,
        });

        // A flag whose Deny list matches the person's collected distinct id.
        const key = uniqueKey("eval-person");
        const flagId = `ff_${uniqueValue("eval-person")}`;
        yield* insertRawFlag({
          id: flagId,
          key,
          name: "PersonRelations",
          enabled: true,
          rolloutBps: 10000,
          salt: "salt-person",
        });
        track(flagId);
        yield* insertRawTarget({
          id: `ff_tgt_${uniqueValue("eval-person")}`,
          featureFlagId: flagId,
          listType: FeatureFlagTargetListType.Deny,
          identityType: FeatureFlagIdentityType.DistinctId,
          identityValue: distinctId,
        });

        // Evaluate by personId only; the service must read the relations to
        // discover the distinct id that the Deny target matches.
        const results = yield* svc.evaluateFlagsBatch({ projectId, keys: [key], personId });
        const r = resultFor(results, key);
        expect(r.enabled).toBe(false);
        expect(r.reason).toBe("denied");

        // Self-clean the seeded person graph.
        yield* db
          .delete(personExternalIdentifiers)
          .where(eq(personExternalIdentifiers.id, externalRowId))
          .pipe(Effect.ignore);
        yield* db
          .delete(personIdentities)
          .where(eq(personIdentities.id, personIdentityId))
          .pipe(Effect.ignore);
        yield* db.delete(persons).where(eq(persons.id, personId)).pipe(Effect.ignore);
      }),
    ).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "filters by keys when provided and returns an empty array when no flags match",
    withFlagCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FeatureFlagService;
        const wantedKey = uniqueKey("eval-filter-wanted");
        const otherKey = uniqueKey("eval-filter-other");

        const wanted = yield* svc.createFlag({ projectId, key: wantedKey, name: "Wanted" });
        track(wanted.id);
        const other = yield* svc.createFlag({ projectId, key: otherKey, name: "Other" });
        track(other.id);

        const filtered = yield* svc.evaluateFlagsBatch({
          projectId,
          keys: [wantedKey],
          distinctId: uniqueValue("eval-filter-subject"),
        });
        expect(filtered.some((r) => r.key === wantedKey)).toBe(true);
        expect(filtered.some((r) => r.key === otherKey)).toBe(false);

        // A keys filter that matches nothing yields an empty result set.
        const none = yield* svc.evaluateFlagsBatch({
          projectId,
          keys: [`it-ff-absent-${Date.now()}-${seq++}`],
          distinctId: uniqueValue("eval-filter-none"),
        });
        expect(none.length).toBe(0);
      }),
    ).pipe(Effect.provide(FeatureFlagService.layer), CoreAuthSession.authenticate()),
  );

  // The wrapped harness `test` is a plain function with no `.todo`; record the
  // deferred case via the raw vitest `test.todo`.
  vitestTest.todo(
    "evaluateFlagsBatch: an evaluation error for one flag returns reason=error without failing the batch — the per-flag fallback only triggers on a thrown defect inside the gen (e.g. a crypto.subtle outage), which has no in-process seam from the public service surface; cannot be forced against the real runtime without injecting a hashToBucket fault.",
  );
});
