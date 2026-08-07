/**
 * Integration tests for {@link OrganizationService}, run against the real
 * backend stack provisioned once by `test/_testing/globalSetup.ts` (live
 * PlanetScale DB; only the project schema cache is an in-memory stub).
 *
 * `OrganizationService` orchestrates WorkOS *and* the local DB: WorkOS is the
 * source of truth and every write goes there first, then is mirrored to the
 * `organization` / `member` tables. WorkOS itself is an external provider we
 * cannot stand up in-process, so the tests provide a configurable fake
 * {@link OrgDirectoryPort} (the same provider-agnostic seam the app root wires a
 * live `@workos-inc/node` adapter into) to drive successes and failures.
 * Everything below the port — the DB writes, transactions, rollback
 * compensation, slug uniqueness, and permission checks — runs against the
 * *real* database, and each test asserts the persisted side effect rather than
 * just the return value.
 *
 * `OrganizationLifecyclePort` is the optional extension seam; a recording stub
 * stands in so the non-fatal organization-created hook can be driven to succeed
 * or fail.
 *
 * Conventions used throughout:
 *  - Names/slugs/ids are unique per call so a leftover row from a crashed run
 *    can never collide, and assertions are membership-based (by-id / by-slug),
 *    never exact global counts.
 *  - Every test that writes cleans up after itself via {@link withCleanup}:
 *    organizations and members are deleted on exit, success or failure,
 *    members first. The global teardown sweep does not touch the organization
 *    aggregate, so self-cleanup is the only cleanup.
 *  - Auth is always via {@link CoreAuthSession.authenticate}; permission /
 *    "no user" paths re-authenticate just the call under test with a tailored
 *    session that shadows the harness default.
 *  - Typed failures are asserted with `Effect.flip` and narrowed with
 *    `instanceof`, always paired with a DB-state assertion on the failure path.
 *  - The fixture only seeds it_user/it_org/it_member/it_project, so throwaway
 *    organizations are created with a raw insert (a unique `workosOrganizationId`
 *    to dodge the unique index) when a test needs an org it may freely mutate
 *    without disturbing the shared fixture org.
 */
import { DateTime, Effect, Layer } from "effect";
import { describe, expect } from "vitest";

import {
  OrganizationLifecyclePort,
  OrganizationLifecyclePortError,
  OrganizationService,
  OrganizationServiceError,
  OrgDirectoryPort,
} from "@voidhash/core/services";
import { OrganizationNotFoundError } from "@voidhash/core/domain/organization/Organization";
import { OrgDirectoryPortError } from "@voidhash/core/services/organizations/OrgDirectoryPort";
import type {
  OrgDirectoryMembership,
  OrgDirectoryOrganization,
  OrgDirectoryUser,
} from "@voidhash/core/services/organizations/OrgDirectoryPort";
import {
  ActionForbiddenError,
  type SecretKeySession,
  type UserSession,
} from "@voidhash/core/domain/auth/Auth";
import { Db, eq, inArray, member, organization } from "@voidhash/db";

import { CoreAuthSession } from "@testing/CoreAuthSession";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";
import { CoreTestFixture } from "@testing/CoreTestFixture";

const { test } = CoreIntegrationTestHarness.make();

/** Wall-clock helpers — `DateTime` equivalents of `nowMillis()` / `new Date(...)`. */
const nowMillis = (): number => DateTime.toEpochMillis(DateTime.nowUnsafe());
const now = (): Date => DateTime.toDateUtc(DateTime.nowUnsafe());
const instant = (millis: number): Date => DateTime.toDateUtc(DateTime.makeUnsafe(millis));

/** Monotonic counter so names/slugs stay unique even within the same millisecond. */
let seq = 0;
const uniqueName = (label: string) => `IT Org ${label} ${nowMillis()} ${seq++}`;
const uniqueId = (label: string) => `it-${label}-${nowMillis()}-${seq++}`;

/** Slug `createSlug` produces for a name built by {@link uniqueName} (no blacklist hit). */
const slugFor = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

// --- raw DB read-back helpers (bypass the service) -------------------------

const findOrgRow = (id: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.organization.findFirst({ where: { id } });
  });

const findOrgRowBySlug = (slug: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.organization.findFirst({ where: { slug } });
  });

const findMembersInOrg = (organizationId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.select().from(member).where(eq(member.organizationId, organizationId));
  });

// --- throwaway-row helpers --------------------------------------------------

/** Insert a throwaway organization the test may freely mutate/delete. */
const insertOrg = (input: {
  id: string;
  name: string;
  slug: string;
  workosOrganizationId: string;
}) =>
  Effect.gen(function* () {
    const db = yield* Db;
    yield* db.insert(organization).values({
      createdAt: now(),
      id: input.id,
      logo: null,
      metadata: null,
      name: input.name,
      slug: input.slug,
      workosOrganizationId: input.workosOrganizationId,
    });
  });

/** Insert a throwaway member row pointing at the fixture user by default. */
const insertMember = (input: {
  id: string;
  organizationId: string;
  role: string;
  workosMembershipId: string;
  userId?: string;
}) =>
  Effect.gen(function* () {
    const db = yield* Db;
    yield* db.insert(member).values({
      createdAt: now(),
      id: input.id,
      organizationId: input.organizationId,
      role: input.role,
      userId: input.userId ?? CoreTestFixture.userId,
      workosMembershipId: input.workosMembershipId,
    });
  });

// --- cleanup ----------------------------------------------------------------

interface Tracked {
  orgs: string[];
  members: string[];
}

const cleanup = (tracked: Tracked) =>
  Effect.gen(function* () {
    const db = yield* Db;
    if (tracked.members.length > 0) {
      yield* db
        .delete(member)
        .where(inArray(member.id, [...tracked.members]))
        .pipe(Effect.ignore);
    }
    if (tracked.orgs.length > 0) {
      // Deleting an org cascades its members; clear members by org first too.
      yield* db
        .delete(member)
        .where(inArray(member.organizationId, [...tracked.orgs]))
        .pipe(Effect.ignore);
      yield* db
        .delete(organization)
        .where(inArray(organization.id, [...tracked.orgs]))
        .pipe(Effect.ignore);
    }
  });

/**
 * Wrap a test body so every org/member it tracks is removed afterward,
 * regardless of how the test exits. The body pushes ids into the shared
 * `track` record while it runs; cleanup reads it lazily at finalization via
 * `Effect.ensuring`, so it sees everything tracked (including on failure).
 */
const withCleanup = <E, R>(
  body: (track: Tracked) => Effect.Effect<void, E, R>,
): Effect.Effect<void, E, R | Db> => {
  const tracked: Tracked = { members: [], orgs: [] };
  return body(tracked).pipe(Effect.ensuring(cleanup(tracked)));
};

// --- fake OrgDirectoryPort -----------------------------------------------------

/** Records every call the service makes against the port. */
interface PortCalls {
  createOrganization: Array<{ name: string; externalId: string }>;
  updateOrganization: Array<{ workosOrganizationId: string; name?: string }>;
  deleteOrganization: string[];
  createMembership: Array<{
    workosOrganizationId: string;
    workosUserId: string;
    roleSlug?: string;
  }>;
  listMembershipsForUser: string[];
  updateMembershipRole: Array<{ workosMembershipId: string; roleSlug: string }>;
  deleteMembership: string[];
  findUserByEmail: string[];
}

interface FakePortConfig {
  readonly onCreateOrganization?: (input: {
    name: string;
    externalId: string;
  }) => Effect.Effect<OrgDirectoryOrganization, OrgDirectoryPortError>;
  readonly onUpdateOrganization?: () => Effect.Effect<OrgDirectoryOrganization, OrgDirectoryPortError>;
  readonly onCreateMembership?: (input: {
    workosOrganizationId: string;
    workosUserId: string;
  }) => Effect.Effect<OrgDirectoryMembership, OrgDirectoryPortError>;
  readonly onDeleteMembership?: () => Effect.Effect<void, OrgDirectoryPortError>;
  readonly onUpdateMembershipRole?: () => Effect.Effect<OrgDirectoryMembership, OrgDirectoryPortError>;
  readonly findUserByEmail?: OrgDirectoryUser | null;
  readonly listMembershipsForUser?: ReadonlyArray<OrgDirectoryMembership>;
}

const portError = (message: string) => new OrgDirectoryPortError({ cause: "fake", message });

interface FakePort {
  readonly calls: PortCalls;
  readonly layer: Layer.Layer<OrgDirectoryPort>;
}

/**
 * Build a fake {@link OrgDirectoryPort} layer plus the call log it records into.
 * Defaults are "everything succeeds"; pass overrides to inject failures or
 * pre-existing WorkOS state. The returned `calls` object lets tests assert
 * which port operations ran (e.g. that a rollback `deleteOrganization` fired).
 */
const makeFakePort = (config: FakePortConfig = {}): FakePort => {
  const calls: PortCalls = {
    createMembership: [],
    createOrganization: [],
    deleteMembership: [],
    deleteOrganization: [],
    findUserByEmail: [],
    listMembershipsForUser: [],
    updateMembershipRole: [],
    updateOrganization: [],
  };

  let portSeq = 0;
  const layer = Layer.succeed(OrgDirectoryPort, {
    createMembership: (input) => {
      calls.createMembership.push(input);
      if (config.onCreateMembership) return config.onCreateMembership(input);
      return Effect.succeed({
        id: `wm_${nowMillis()}_${portSeq++}`,
        organizationId: input.workosOrganizationId,
        role: input.roleSlug ?? "member",
        userId: input.workosUserId,
      } satisfies OrgDirectoryMembership);
    },
    createOrganization: (input) => {
      calls.createOrganization.push(input);
      if (config.onCreateOrganization) return config.onCreateOrganization(input);
      return Effect.succeed({
        externalId: input.externalId,
        id: `wo_${nowMillis()}_${portSeq++}`,
        name: input.name,
      } satisfies OrgDirectoryOrganization);
    },
    deleteMembership: (workosMembershipId) => {
      calls.deleteMembership.push(workosMembershipId);
      if (config.onDeleteMembership) return config.onDeleteMembership();
      return Effect.void;
    },
    deleteOrganization: (workosOrganizationId) => {
      calls.deleteOrganization.push(workosOrganizationId);
      return Effect.void;
    },
    findUserByEmail: (email) => {
      calls.findUserByEmail.push(email);
      return Effect.succeed(config.findUserByEmail ?? null);
    },
    getOrganization: (workosOrganizationId) =>
      Effect.succeed({ externalId: null, id: workosOrganizationId, name: "fake" }),
    getOrganizationByExternalId: () => Effect.succeed(null),
    listMembershipsForUser: (workosUserId) => {
      calls.listMembershipsForUser.push(workosUserId);
      return Effect.succeed(config.listMembershipsForUser ?? []);
    },
    updateMembershipRole: (workosMembershipId, input) => {
      calls.updateMembershipRole.push({ roleSlug: input.roleSlug, workosMembershipId });
      if (config.onUpdateMembershipRole) return config.onUpdateMembershipRole();
      return Effect.succeed({
        id: workosMembershipId,
        organizationId: "wo_x",
        role: input.roleSlug,
        userId: "wu_x",
      } satisfies OrgDirectoryMembership);
    },
    updateOrganization: (input) => {
      calls.updateOrganization.push(input);
      if (config.onUpdateOrganization) return config.onUpdateOrganization();
      return Effect.succeed({
        externalId: null,
        id: input.workosOrganizationId,
        name: input.name ?? "fake",
      } satisfies OrgDirectoryOrganization);
    },
  });

  return { calls, layer };
};

// --- fake OrganizationLifecyclePort ----------------------------------------

interface LifecycleCalls {
  organizationCreated: Array<{ organizationId: string; email?: string }>;
}

interface FakeLifecycle {
  readonly calls: LifecycleCalls;
  readonly layer: Layer.Layer<OrganizationLifecyclePort>;
}

const makeFakeLifecycle = (options: { fail?: boolean } = {}): FakeLifecycle => {
  const calls: LifecycleCalls = { organizationCreated: [] };
  const layer = Layer.succeed(OrganizationLifecyclePort, {
    organizationCreated: (input) => {
      calls.organizationCreated.push(input);
      if (options.fail) {
        return Effect.fail(
          new OrganizationLifecyclePortError({
            cause: "fake",
            message: "organization-created hook failed",
          }),
        );
      }
      return Effect.void;
    },
  });
  return { calls, layer };
};

// --- layer assembly ---------------------------------------------------------

/**
 * Provide `OrganizationService` plus its non-harness collaborators: the fake
 * WorkOS port and a recording lifecycle stub. Provided at the top-level test pipe so the body's
 * `OrganizationService` requirement is fully discharged before the harness sees
 * it (leaving only harness services in `R`).
 */
const orgServiceLayer = (port: FakePort, lifecycle: FakeLifecycle) =>
  Layer.mergeAll(
    OrganizationService.layer.pipe(
      Layer.provide(Layer.mergeAll(port.layer, lifecycle.layer)),
    ),
    port.layer,
    lifecycle.layer,
  );

// --- session builders -------------------------------------------------------

/** Applies the `workosUserId` override, treating an absent key as "keep the fixture value". */
const resolveWorkosUserId = (override: string | null | undefined): string | null => {
  if (override === undefined) return CoreTestFixture.workosUserId;
  return override;
};

/** Full-permission user session carrying `organization:all` for the given org ids. */
const userSessionWithOrgs = (
  orgIds: ReadonlyArray<string>,
  overrides: { workosUserId?: string | null } = {},
): UserSession => ({
  cookie: null,
  method: "user",
  name: `${CoreTestFixture.userName} <${CoreTestFixture.userEmail}>`,
  organizations: orgIds.map((id) => ({
    id,
    logo: null,
    name: `org-${id}`,
    permissions: ["organization:all"],
    slug: `slug-${id}`,
    workosOrganizationId: `wo-${id}`,
  })),
  person: null,
  projects: [],
  user: {
    createdAt: instant(0),
    email: CoreTestFixture.userEmail,
    emailVerified: true,
    id: CoreTestFixture.userId,
    image: null,
    name: CoreTestFixture.userName,
    role: null,
    updatedAt: instant(0),
    workosUserId: resolveWorkosUserId(overrides.workosUserId),
  },
});

/** A user session with no organization access (forbidden-path principal). */
const sessionWithoutOrgAccess = (): UserSession => userSessionWithOrgs([]);

/** A secret-key session — `user` is null, so it cannot create organizations. */
const secretKeySession = (): SecretKeySession => ({
  cookie: null,
  method: "secret-key",
  name: "secret-key principal",
  organizations: [],
  person: null,
  projects: [],
  user: null,
});

/** Re-authenticate a single call with a tailored session (shadows the default). */
const as =
  (session: UserSession | SecretKeySession) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    effect.pipe(CoreAuthSession.authenticate(session));

// ---------------------------------------------------------------------------

describe("OrganizationService.getOrganizationById", () => {
  test(
    "returns the org row for a caller with organization:all",
    Effect.gen(function* () {
      const svc = yield* OrganizationService;
      const org = yield* svc
        .getOrganizationById(CoreTestFixture.organizationId)
        .pipe(as(userSessionWithOrgs([CoreTestFixture.organizationId])));
      expect(org.id).toBe(CoreTestFixture.organizationId);
      expect(org.slug).toBe(CoreTestFixture.organizationSlug);
    }).pipe(
      Effect.provide(orgServiceLayer(makeFakePort(), makeFakeLifecycle())),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "fails with OrganizationNotFoundError for an unknown id",
    Effect.gen(function* () {
      const svc = yield* OrganizationService;
      const error = yield* Effect.flip(svc.getOrganizationById(`org_missing_${nowMillis()}`));
      expect(error).toBeInstanceOf(OrganizationNotFoundError);
    }).pipe(
      Effect.provide(orgServiceLayer(makeFakePort(), makeFakeLifecycle())),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "forbids a caller without organization:all",
    Effect.gen(function* () {
      const svc = yield* OrganizationService;
      const error = yield* Effect.flip(
        svc.getOrganizationById(CoreTestFixture.organizationId).pipe(as(sessionWithoutOrgAccess())),
      );
      expect(error).toBeInstanceOf(ActionForbiddenError);
    }).pipe(
      Effect.provide(orgServiceLayer(makeFakePort(), makeFakeLifecycle())),
      CoreAuthSession.authenticate(),
    ),
  );
});

describe("OrganizationService.getOrganizationBySlug", () => {
  test(
    "returns the org row by slug for an authorized caller",
    Effect.gen(function* () {
      const svc = yield* OrganizationService;
      const org = yield* svc
        .getOrganizationBySlug(CoreTestFixture.organizationSlug)
        .pipe(as(userSessionWithOrgs([CoreTestFixture.organizationId])));
      expect(org.id).toBe(CoreTestFixture.organizationId);
    }).pipe(
      Effect.provide(orgServiceLayer(makeFakePort(), makeFakeLifecycle())),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "fails with OrganizationNotFoundError for an unknown slug",
    Effect.gen(function* () {
      const svc = yield* OrganizationService;
      const error = yield* Effect.flip(svc.getOrganizationBySlug(`it-missing-${nowMillis()}`));
      expect(error).toBeInstanceOf(OrganizationNotFoundError);
    }).pipe(
      Effect.provide(orgServiceLayer(makeFakePort(), makeFakeLifecycle())),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "forbids a caller without organization:all",
    Effect.gen(function* () {
      const svc = yield* OrganizationService;
      const error = yield* Effect.flip(
        svc
          .getOrganizationBySlug(CoreTestFixture.organizationSlug)
          .pipe(as(sessionWithoutOrgAccess())),
      );
      expect(error).toBeInstanceOf(ActionForbiddenError);
    }).pipe(
      Effect.provide(orgServiceLayer(makeFakePort(), makeFakeLifecycle())),
      CoreAuthSession.authenticate(),
    ),
  );
});

describe("OrganizationService.createOrganization", () => {
  test(
    "creates the WorkOS org, local org + owner member, runs the created hook, returns {id,name,slug}",
    (() => {
      const port = makeFakePort();
      const lifecycle = makeFakeLifecycle();
      return withCleanup((track) =>
        Effect.gen(function* () {
          const svc = yield* OrganizationService;
          const name = uniqueName("create");

          const created = yield* svc.createOrganization({ name });
          track.orgs.push(created.id);

          expect(created.id.startsWith("org_")).toBe(true);
          expect(created.name).toBe(name);
          expect(created.slug).toBe(slugFor(name));

          // WorkOS create-then-mirror order: org and membership both created.
          expect(port.calls.createOrganization.some((c) => c.externalId === created.id)).toBe(true);
          expect(port.calls.createMembership.length).toBe(1);

          const orgRow = yield* findOrgRow(created.id);
          expect(orgRow?.name).toBe(name);
          expect(orgRow?.slug).toBe(slugFor(name));
          expect(orgRow?.workosOrganizationId).toBeDefined();

          const members = yield* findMembersInOrg(created.id);
          const owner = members.find((m) => m.userId === CoreTestFixture.userId);
          expect(owner).toBeDefined();
          expect(owner?.role).toBe("owner");

          // The lifecycle hook was invoked for the new org (non-fatal step, but it ran).
          expect(
            lifecycle.calls.organizationCreated.some(
              (c) => c.organizationId === created.id,
            ),
          ).toBe(true);
        }),
      ).pipe(Effect.provide(orgServiceLayer(port, lifecycle)), CoreAuthSession.authenticate());
    })(),
  );

  test(
    "appends a short id when the base slug is in SLUG_BLACKLIST",
    (() => {
      const port = makeFakePort();
      const lifecycle = makeFakeLifecycle();
      return withCleanup((track) =>
        Effect.gen(function* () {
          const svc = yield* OrganizationService;
          // "auth" is in SLUG_BLACKLIST, so the slug must be suffixed.
          const created = yield* svc.createOrganization({ name: "auth" });
          track.orgs.push(created.id);

          expect(created.slug).not.toBe("auth");
          expect(created.slug.startsWith("auth-")).toBe(true);

          const orgRow = yield* findOrgRow(created.id);
          expect(orgRow?.slug).toBe(created.slug);
        }),
      ).pipe(Effect.provide(orgServiceLayer(port, lifecycle)), CoreAuthSession.authenticate());
    })(),
  );

  test(
    "appends a short id when the base slug already exists in the DB",
    (() => {
      const port = makeFakePort();
      const lifecycle = makeFakeLifecycle();
      return withCleanup((track) =>
        Effect.gen(function* () {
          const svc = yield* OrganizationService;
          const name = uniqueName("collide");

          const first = yield* svc.createOrganization({ name });
          track.orgs.push(first.id);
          const second = yield* svc.createOrganization({ name });
          track.orgs.push(second.id);

          expect(first.slug).toBe(slugFor(name));
          expect(second.slug).not.toBe(first.slug);
          expect(second.slug.startsWith(slugFor(name))).toBe(true);

          const firstRow = yield* findOrgRow(first.id);
          const secondRow = yield* findOrgRow(second.id);
          expect(firstRow?.slug).toBe(first.slug);
          expect(secondRow?.slug).toBe(second.slug);
        }),
      ).pipe(Effect.provide(orgServiceLayer(port, lifecycle)), CoreAuthSession.authenticate());
    })(),
  );

  test(
    "fails with OrganizationServiceError when WorkOS createOrganization fails, writing no local rows",
    (() => {
      const port = makeFakePort({
        onCreateOrganization: () => Effect.fail(portError("workos org create boom")),
      });
      const lifecycle = makeFakeLifecycle();
      const name = uniqueName("wos-fail");
      return Effect.gen(function* () {
        const svc = yield* OrganizationService;
        const error = yield* Effect.flip(svc.createOrganization({ name }));
        expect(error).toBeInstanceOf(OrganizationServiceError);

        // No membership attempt, and nothing landed locally for the derived slug.
        expect(port.calls.createMembership.length).toBe(0);
        const orgRow = yield* findOrgRowBySlug(slugFor(name));
        expect(orgRow).toBeUndefined();
      }).pipe(Effect.provide(orgServiceLayer(port, lifecycle)), CoreAuthSession.authenticate());
    })(),
  );

  test(
    "fails and rolls back the WorkOS org when createMembership fails",
    (() => {
      const port = makeFakePort({
        onCreateMembership: () => Effect.fail(portError("workos membership boom")),
      });
      const lifecycle = makeFakeLifecycle();
      const name = uniqueName("wm-fail");
      return Effect.gen(function* () {
        const svc = yield* OrganizationService;
        const error = yield* Effect.flip(svc.createOrganization({ name }));
        expect(error).toBeInstanceOf(OrganizationServiceError);

        // Compensation: the just-created WorkOS org was torn down.
        expect(port.calls.deleteOrganization.length).toBe(1);
        const orgRow = yield* findOrgRowBySlug(slugFor(name));
        expect(orgRow).toBeUndefined();
      }).pipe(Effect.provide(orgServiceLayer(port, lifecycle)), CoreAuthSession.authenticate());
    })(),
  );

  test(
    "fails and rolls back the WorkOS org when the local DB write fails",
    (() => {
      // Force a real DB failure: have WorkOS hand back a workosOrganizationId that
      // already exists (the fixture org), violating the unique index on the
      // `organization` insert and aborting the mirror transaction.
      const port = makeFakePort({
        onCreateOrganization: (input) =>
          Effect.succeed({
            externalId: input.externalId,
            id: CoreTestFixture.workosOrganizationId,
            name: input.name,
          }),
      });
      const lifecycle = makeFakeLifecycle();
      const name = uniqueName("db-fail");
      return Effect.gen(function* () {
        const svc = yield* OrganizationService;
        const error = yield* Effect.flip(svc.createOrganization({ name }));
        expect(error).toBeInstanceOf(OrganizationServiceError);

        // Compensation: WorkOS org deleted; no orphan local org for our slug.
        expect(port.calls.deleteOrganization.length).toBe(1);
        const orgRow = yield* findOrgRowBySlug(slugFor(name));
        expect(orgRow).toBeUndefined();
      }).pipe(Effect.provide(orgServiceLayer(port, lifecycle)), CoreAuthSession.authenticate());
    })(),
  );

  test(
    "still creates the org when the organization-created hook fails (non-fatal)",
    (() => {
      const port = makeFakePort();
      const lifecycle = makeFakeLifecycle({ fail: true });
      return withCleanup((track) =>
        Effect.gen(function* () {
          const svc = yield* OrganizationService;
          const name = uniqueName("lifecycle-fail");

          const created = yield* svc.createOrganization({ name });
          track.orgs.push(created.id);

          expect(created.name).toBe(name);
          expect(lifecycle.calls.organizationCreated.length).toBe(1);

          // The org + owner member persisted despite the hook failure.
          const orgRow = yield* findOrgRow(created.id);
          expect(orgRow).toBeDefined();
          const members = yield* findMembersInOrg(created.id);
          expect(members.length).toBe(1);
        }),
      ).pipe(Effect.provide(orgServiceLayer(port, lifecycle)), CoreAuthSession.authenticate());
    })(),
  );

  test(
    "fails with OrganizationServiceError for an api-key (no user) session, writing nothing",
    (() => {
      const port = makeFakePort();
      const lifecycle = makeFakeLifecycle();
      const name = uniqueName("no-user");
      return Effect.gen(function* () {
        const svc = yield* OrganizationService;
        const error = yield* Effect.flip(
          svc.createOrganization({ name }).pipe(as(secretKeySession())),
        );
        expect(error).toBeInstanceOf(OrganizationServiceError);

        // Bailed before any WorkOS or DB write.
        expect(port.calls.createOrganization.length).toBe(0);
        const orgRow = yield* findOrgRowBySlug(slugFor(name));
        expect(orgRow).toBeUndefined();
      }).pipe(Effect.provide(orgServiceLayer(port, lifecycle)), CoreAuthSession.authenticate());
    })(),
  );

  test(
    "fails with OrganizationServiceError when the session user has no WorkOS id and none is found by email",
    (() => {
      const port = makeFakePort({ findUserByEmail: null });
      const lifecycle = makeFakeLifecycle();
      const name = uniqueName("no-workos-id");
      return Effect.gen(function* () {
        const svc = yield* OrganizationService;
        const error = yield* Effect.flip(
          svc
            .createOrganization({ name })
            .pipe(as(userSessionWithOrgs([], { workosUserId: null }))),
        );
        expect(error).toBeInstanceOf(OrganizationServiceError);

        // findUserByEmail was consulted and returned nothing; no org created.
        expect(port.calls.findUserByEmail.length).toBe(1);
        expect(port.calls.createOrganization.length).toBe(0);
        const orgRow = yield* findOrgRowBySlug(slugFor(name));
        expect(orgRow).toBeUndefined();
      }).pipe(Effect.provide(orgServiceLayer(port, lifecycle)), CoreAuthSession.authenticate());
    })(),
  );
});

describe("OrganizationService.updateOrganization", () => {
  test(
    "renames the org in WorkOS and the local DB",
    (() => {
      const port = makeFakePort();
      const lifecycle = makeFakeLifecycle();
      const orgId = uniqueId("upd-org");
      const wo = uniqueId("upd-wo");
      return withCleanup((track) =>
        Effect.gen(function* () {
          yield* insertOrg({
            id: orgId,
            name: "Before",
            slug: uniqueId("upd-slug"),
            workosOrganizationId: wo,
          });
          track.orgs.push(orgId);

          const svc = yield* OrganizationService;
          const newName = uniqueName("renamed");
          yield* svc
            .updateOrganization({ name: newName, organizationId: orgId })
            .pipe(as(userSessionWithOrgs([orgId])));

          expect(port.calls.updateOrganization.some((c) => c.workosOrganizationId === wo)).toBe(
            true,
          );
          const orgRow = yield* findOrgRow(orgId);
          expect(orgRow?.name).toBe(newName);
        }),
      ).pipe(Effect.provide(orgServiceLayer(port, lifecycle)), CoreAuthSession.authenticate());
    })(),
  );

  test(
    "forbids a caller without organization:all and writes nothing",
    (() => {
      const port = makeFakePort();
      const lifecycle = makeFakeLifecycle();
      return Effect.gen(function* () {
        const svc = yield* OrganizationService;
        const before = yield* findOrgRow(CoreTestFixture.organizationId);
        const error = yield* Effect.flip(
          svc
            .updateOrganization({
              name: "Hijacked",
              organizationId: CoreTestFixture.organizationId,
            })
            .pipe(as(sessionWithoutOrgAccess())),
        );
        expect(error).toBeInstanceOf(ActionForbiddenError);

        expect(port.calls.updateOrganization.length).toBe(0);
        const after = yield* findOrgRow(CoreTestFixture.organizationId);
        expect(after?.name).toBe(before?.name);
      }).pipe(Effect.provide(orgServiceLayer(port, lifecycle)), CoreAuthSession.authenticate());
    })(),
  );

  test(
    "fails with OrganizationNotFoundError for an unknown org",
    (() => {
      const port = makeFakePort();
      const lifecycle = makeFakeLifecycle();
      const orgId = `org_missing_${nowMillis()}`;
      return Effect.gen(function* () {
        const svc = yield* OrganizationService;
        const error = yield* Effect.flip(
          svc
            .updateOrganization({ name: "Nope", organizationId: orgId })
            .pipe(as(userSessionWithOrgs([orgId]))),
        );
        expect(error).toBeInstanceOf(OrganizationNotFoundError);
        expect(port.calls.updateOrganization.length).toBe(0);
      }).pipe(Effect.provide(orgServiceLayer(port, lifecycle)), CoreAuthSession.authenticate());
    })(),
  );

  test(
    "fails with OrganizationServiceError on a WorkOS update failure and leaves the name unchanged",
    (() => {
      const port = makeFakePort({
        onUpdateOrganization: () => Effect.fail(portError("workos update boom")),
      });
      const lifecycle = makeFakeLifecycle();
      const orgId = uniqueId("upd-fail-org");
      return withCleanup((track) =>
        Effect.gen(function* () {
          yield* insertOrg({
            id: orgId,
            name: "Keep",
            slug: uniqueId("upd-fail-slug"),
            workosOrganizationId: uniqueId("upd-fail-wo"),
          });
          track.orgs.push(orgId);

          const svc = yield* OrganizationService;
          const error = yield* Effect.flip(
            svc
              .updateOrganization({ name: "Changed", organizationId: orgId })
              .pipe(as(userSessionWithOrgs([orgId]))),
          );
          expect(error).toBeInstanceOf(OrganizationServiceError);

          const orgRow = yield* findOrgRow(orgId);
          expect(orgRow?.name).toBe("Keep");
        }),
      ).pipe(Effect.provide(orgServiceLayer(port, lifecycle)), CoreAuthSession.authenticate());
    })(),
  );
});

describe("OrganizationService.deleteOrganization", () => {
  test(
    "deletes the org in WorkOS and locally, cascading members",
    (() => {
      const port = makeFakePort();
      const lifecycle = makeFakeLifecycle();
      const orgId = uniqueId("del-org");
      const wo = uniqueId("del-wo");
      return withCleanup((track) =>
        Effect.gen(function* () {
          track.orgs.push(orgId);
          yield* insertOrg({
            id: orgId,
            name: "Doomed",
            slug: uniqueId("del-slug"),
            workosOrganizationId: wo,
          });
          yield* insertMember({
            id: uniqueId("del-mem"),
            organizationId: orgId,
            role: "owner",
            workosMembershipId: uniqueId("del-wm"),
          });

          const svc = yield* OrganizationService;
          yield* svc
            .deleteOrganization({ organizationId: orgId })
            .pipe(as(userSessionWithOrgs([orgId])));

          expect(port.calls.deleteOrganization).toContain(wo);
          const orgRow = yield* findOrgRow(orgId);
          expect(orgRow).toBeUndefined();
          const members = yield* findMembersInOrg(orgId);
          expect(members.length).toBe(0);
        }),
      ).pipe(Effect.provide(orgServiceLayer(port, lifecycle)), CoreAuthSession.authenticate());
    })(),
  );

  test(
    "forbids a caller without organization:all and retains the org",
    (() => {
      const port = makeFakePort();
      const lifecycle = makeFakeLifecycle();
      return Effect.gen(function* () {
        const svc = yield* OrganizationService;
        const error = yield* Effect.flip(
          svc
            .deleteOrganization({ organizationId: CoreTestFixture.organizationId })
            .pipe(as(sessionWithoutOrgAccess())),
        );
        expect(error).toBeInstanceOf(ActionForbiddenError);

        expect(port.calls.deleteOrganization.length).toBe(0);
        const orgRow = yield* findOrgRow(CoreTestFixture.organizationId);
        expect(orgRow).toBeDefined();
      }).pipe(Effect.provide(orgServiceLayer(port, lifecycle)), CoreAuthSession.authenticate());
    })(),
  );

  test(
    "succeeds silently and skips WorkOS when the org row is absent (idempotent)",
    (() => {
      const port = makeFakePort();
      const lifecycle = makeFakeLifecycle();
      const orgId = `org_missing_${nowMillis()}`;
      return Effect.gen(function* () {
        const svc = yield* OrganizationService;
        yield* svc
          .deleteOrganization({ organizationId: orgId })
          .pipe(as(userSessionWithOrgs([orgId])));

        // No WorkOS delete fired because there was no local org to mirror.
        expect(port.calls.deleteOrganization.length).toBe(0);
      }).pipe(Effect.provide(orgServiceLayer(port, lifecycle)), CoreAuthSession.authenticate());
    })(),
  );
});
