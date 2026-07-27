/**
 * Integration tests for {@link ProjectService}, run against the real backend
 * stack provisioned once by `test/_testing/globalSetup.ts` (live PlanetScale DB
 * + ClickHouse + WorkOS; only the project schema cache is an in-memory stub).
 *
 * Each test drives the service end-to-end and verifies the *persisted* side
 * effects rather than just the method's return value:
 *  - the `project` row written / updated / removed in MySQL,
 *  - the bootstrap `api_key` row `createProject` writes in the same transaction,
 *  - the matching `audit_log` row (entity, action, actor, change snapshot).
 *
 * Conventions used throughout:
 *  - The seeded fixture project ({@link CoreTestFixture}) is reused for the
 *    read/forbidden paths; mutating paths create their own projects under the
 *    fixture organization and clean up after themselves via
 *    {@link withProjectCleanup}, which deletes the project, its bootstrap api
 *    key, and its append-only audit rows on exit (success or failure). The
 *    global teardown sweep is only a backstop. Assertions stay membership-based
 *    (never exact `getProjects` counts) and names embed a unique token so a
 *    leftover row from a crashed run can't collide on the
 *    `(slug, organization_id)` unique index.
 *  - Permission tests reuse the default authenticated effect and re-authenticate
 *    just the call under test via {@link asUnauthorized}; the inner provision
 *    shadows the harness's default full-permission session.
 *  - Typed failures are asserted with `Effect.flip` (project convention),
 *    narrowing the swapped error with `instanceof` before reading its fields,
 *    paired with a DB-state assertion that the failure path wrote nothing.
 */
import { Effect } from "effect";
import { describe, expect } from "vitest";

import { ProjectService } from "@voidhash/core/services";
import {
  ActionForbiddenError,
  AuthenticationError,
  type SecretKeySession,
  type UserSession,
} from "@voidhash/core/domain/auth/Auth";
import { ProjectNotFoundError } from "@voidhash/core/domain/project/Project";
import {
  AuditLogAction,
  AuditLogActorType,
  AuditLogEntityType,
  Db,
  and,
  apiKeys,
  auditLogs,
  eq,
  inArray,
  projects,
} from "@voidhash/db";

import { CoreAuthSession } from "@testing/CoreAuthSession";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";
import { CoreTestFixture } from "@testing/CoreTestFixture";

const { test } = CoreIntegrationTestHarness.make();

const organizationId = CoreTestFixture.organizationId;
const organizationSlug = CoreTestFixture.organizationSlug;
const fixtureProjectId = CoreTestFixture.projectId;
const fixtureProjectSlug = CoreTestFixture.projectSlug;

/** Monotonic counter so names stay unique even within the same millisecond. */
let nameSeq = 0;
/**
 * A display name whose derived slug is unique per call, keeping creates clear of
 * the `(slug, organization_id)` unique index across runs. `createSlug` lowercases
 * and dashes, so the resulting slug looks like `it-project-<label>-<n>`.
 */
const uniqueName = (label: string) => `it project ${label} ${Date.now()} ${nameSeq++}`;

/** Read a project row straight from the database, bypassing the service. */
const findProjectRow = (id: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.projects.findFirst({ where: { id } });
  });

/** All api-key rows the bootstrap step wrote for a project. */
const findApiKeyRows = (projectId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.select().from(apiKeys).where(eq(apiKeys.projectId, projectId));
  });

/** All audit-log rows recorded for a given project entity. */
const findProjectAuditEntries = (entityId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db
      .select()
      .from(auditLogs)
      .where(
        and(eq(auditLogs.entityType, AuditLogEntityType.Project), eq(auditLogs.entityId, entityId)),
      );
  });

/**
 * Delete the given projects, their bootstrap api keys, and their audit rows.
 * Audit entries are append-only and survive a `deleteProject`, so they are
 * cleared by entity id too. Each delete is `ignore`d so a missing row never
 * turns the finalizer into a failure.
 */
const cleanupCreatedProjects = (ids: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    if (ids.length === 0) return;
    const db = yield* Db;
    const targets = [...ids];
    yield* db.delete(apiKeys).where(inArray(apiKeys.projectId, targets)).pipe(Effect.ignore);
    yield* db
      .delete(auditLogs)
      .where(
        and(
          eq(auditLogs.entityType, AuditLogEntityType.Project),
          inArray(auditLogs.entityId, targets),
        ),
      )
      .pipe(Effect.ignore);
    yield* db.delete(projects).where(inArray(projects.id, targets)).pipe(Effect.ignore);
  });

/**
 * Wrap a test body so every project it creates is removed afterward, regardless
 * of how the test exits. Pass each created project id to the `track` callback;
 * cleanup reads the collected ids lazily at finalization via `Effect.ensuring`,
 * so it sees every id tracked while the body ran (including on failure).
 */
const withProjectCleanup = <E, R>(
  body: (track: (id: string) => void) => Effect.Effect<void, E, R>,
): Effect.Effect<void, E, R | Db> => {
  const createdIds: string[] = [];
  return body((id) => {
    createdIds.push(id);
  }).pipe(Effect.ensuring(cleanupCreatedProjects(createdIds)));
};

/** A `user`-method session for the fixture principal carrying no org/project access. */
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
 * A `secret-key`-method session that holds `organization:all` for the fixture
 * org but carries no `user`. It passes the org permission gate yet has no
 * `session.user.id`, so `createProject` reaches its `AuthenticationError` branch.
 */
const sessionWithoutUser = (): SecretKeySession => ({
  cookie: null,
  method: "secret-key",
  name: "Integration Secret Key",
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
  projects: [],
  user: null,
});

/**
 * A `user`-method session for the fixture principal that additionally carries
 * `project:all` for a freshly created project. The default fixture session only
 * grants `project:all` on the *seeded* project, so `checkProjectPermission`
 * (which matches by exact project id, with no org-level fallback) would
 * otherwise reject `updateProject`/`deleteProject` calls against a newly created
 * `proj_…` id.
 */
const sessionWithProjectAccess = (projectId: string): UserSession => ({
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
      id: projectId,
      logo: null,
      name: "Created Project",
      organizationId: CoreTestFixture.organizationId,
      permissions: ["project:all"],
      slug: "created-project",
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

/**
 * Run a single call as a caller with no org/project access. Re-authenticates
 * just this effect with the no-access session; the inner provision shadows the
 * harness's default full-permission session for the wrapped call only.
 */
const asUnauthorized = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(CoreAuthSession.authenticate(sessionWithoutProjectAccess()));

/**
 * Run a single call with `project:all` for the given (freshly created) project.
 * The inner provision shadows the harness's default session, which only grants
 * access to the seeded fixture project.
 */
const asProjectMember = <A, E, R>(projectId: string, effect: Effect.Effect<A, E, R>) =>
  effect.pipe(CoreAuthSession.authenticate(sessionWithProjectAccess(projectId)));

describe("ProjectService.getProjectById", () => {
  test(
    "returns the seeded fixture project by id",
    Effect.gen(function* () {
      const projectService = yield* ProjectService;
      const project = yield* projectService.getProjectById(fixtureProjectId);
      expect(project?.id).toBe(fixtureProjectId);
      expect(project?.slug).toBe(fixtureProjectSlug);
      expect(project?.organizationId).toBe(organizationId);
    }).pipe(Effect.provide(ProjectService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "returns null for an unknown id (before any permission check)",
    Effect.gen(function* () {
      const projectService = yield* ProjectService;
      const project = yield* projectService.getProjectById(`proj_missing_${Date.now()}`);
      expect(project).toBeNull();
    }).pipe(Effect.provide(ProjectService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all for an existing project",
    Effect.gen(function* () {
      const projectService = yield* ProjectService;
      const error = yield* Effect.flip(
        asUnauthorized(projectService.getProjectById(fixtureProjectId)),
      );
      expect(error).toBeInstanceOf(ActionForbiddenError);
    }).pipe(Effect.provide(ProjectService.layer), CoreAuthSession.authenticate()),
  );
});

describe("ProjectService.getProjectBySlug", () => {
  test(
    "returns the fixture project by slug + organizationId",
    Effect.gen(function* () {
      const projectService = yield* ProjectService;
      const project = yield* projectService.getProjectBySlug({
        organizationId,
        slug: fixtureProjectSlug,
      });
      expect(project?.id).toBe(fixtureProjectId);
      expect(project?.slug).toBe(fixtureProjectSlug);
    }).pipe(Effect.provide(ProjectService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "returns null when no project matches the slug",
    Effect.gen(function* () {
      const projectService = yield* ProjectService;
      const project = yield* projectService.getProjectBySlug({
        organizationId,
        slug: `it-project-missing-${Date.now()}`,
      });
      expect(project).toBeNull();
    }).pipe(Effect.provide(ProjectService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all for a matching project",
    Effect.gen(function* () {
      const projectService = yield* ProjectService;
      const error = yield* Effect.flip(
        asUnauthorized(
          projectService.getProjectBySlug({ organizationId, slug: fixtureProjectSlug }),
        ),
      );
      expect(error).toBeInstanceOf(ActionForbiddenError);
    }).pipe(Effect.provide(ProjectService.layer), CoreAuthSession.authenticate()),
  );
});

describe("ProjectService.getProjectBySlugAndOrganizationSlug", () => {
  test(
    "returns the fixture project by project slug + organization slug",
    Effect.gen(function* () {
      const projectService = yield* ProjectService;
      const project = yield* projectService.getProjectBySlugAndOrganizationSlug({
        organizationSlug,
        projectSlug: fixtureProjectSlug,
      });
      expect(project?.id).toBe(fixtureProjectId);
      expect(project?.organizationId).toBe(organizationId);
    }).pipe(Effect.provide(ProjectService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "returns null when the organization slug is unknown",
    Effect.gen(function* () {
      const projectService = yield* ProjectService;
      const project = yield* projectService.getProjectBySlugAndOrganizationSlug({
        organizationSlug: `it-org-missing-${Date.now()}`,
        projectSlug: fixtureProjectSlug,
      });
      expect(project).toBeNull();
    }).pipe(Effect.provide(ProjectService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "returns null when the project slug is unknown under a known organization",
    Effect.gen(function* () {
      const projectService = yield* ProjectService;
      const project = yield* projectService.getProjectBySlugAndOrganizationSlug({
        organizationSlug,
        projectSlug: `it-project-missing-${Date.now()}`,
      });
      expect(project).toBeNull();
    }).pipe(Effect.provide(ProjectService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all for a matching project",
    Effect.gen(function* () {
      const projectService = yield* ProjectService;
      const error = yield* Effect.flip(
        asUnauthorized(
          projectService.getProjectBySlugAndOrganizationSlug({
            organizationSlug,
            projectSlug: fixtureProjectSlug,
          }),
        ),
      );
      expect(error).toBeInstanceOf(ActionForbiddenError);
    }).pipe(Effect.provide(ProjectService.layer), CoreAuthSession.authenticate()),
  );
});

describe("ProjectService.getProjects", () => {
  test(
    "lists projects created under the organization",
    withProjectCleanup((track) =>
      Effect.gen(function* () {
        const projectService = yield* ProjectService;
        const created = yield* projectService.createProject({
          name: uniqueName("list"),
          organizationId,
        });
        track(created.id);

        const list = yield* projectService.getProjects(organizationId);
        expect(list.some((project) => project.id === created.id)).toBe(true);
        expect(list.some((project) => project.id === fixtureProjectId)).toBe(true);
        expect(list.some((project) => project.id === `proj_absent_${Date.now()}`)).toBe(false);
      }),
    ).pipe(Effect.provide(ProjectService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without organization:all",
    Effect.gen(function* () {
      const projectService = yield* ProjectService;
      const error = yield* Effect.flip(asUnauthorized(projectService.getProjects(organizationId)));
      expect(error).toBeInstanceOf(ActionForbiddenError);
    }).pipe(Effect.provide(ProjectService.layer), CoreAuthSession.authenticate()),
  );
});

describe("ProjectService.getProjectsByOrganizationSlug", () => {
  test(
    "lists projects by organization slug",
    withProjectCleanup((track) =>
      Effect.gen(function* () {
        const projectService = yield* ProjectService;
        const created = yield* projectService.createProject({
          name: uniqueName("list-by-org-slug"),
          organizationId,
        });
        track(created.id);

        const list = yield* projectService.getProjectsByOrganizationSlug(organizationSlug);
        expect(list).not.toBeNull();
        expect(list?.some((project) => project.id === created.id)).toBe(true);
        expect(list?.some((project) => project.id === fixtureProjectId)).toBe(true);
      }),
    ).pipe(Effect.provide(ProjectService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "returns null when the organization slug is unknown",
    Effect.gen(function* () {
      const projectService = yield* ProjectService;
      const list = yield* projectService.getProjectsByOrganizationSlug(
        `it-org-missing-${Date.now()}`,
      );
      expect(list).toBeNull();
    }).pipe(Effect.provide(ProjectService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without organization:all",
    Effect.gen(function* () {
      const projectService = yield* ProjectService;
      const error = yield* Effect.flip(
        asUnauthorized(projectService.getProjectsByOrganizationSlug(organizationSlug)),
      );
      expect(error).toBeInstanceOf(ActionForbiddenError);
    }).pipe(Effect.provide(ProjectService.layer), CoreAuthSession.authenticate()),
  );
});

describe("ProjectService.createProject", () => {
  test(
    "writes the project + bootstrap publishable api key and records a created audit entry",
    withProjectCleanup((track) =>
      Effect.gen(function* () {
        const projectService = yield* ProjectService;
        const name = uniqueName("create");

        const created = yield* projectService.createProject({ name, organizationId });
        track(created.id);

        expect(created.id.startsWith("proj_")).toBe(true);
        expect(created.name).toBe(name);
        // A fresh, non-blacklisted, non-colliding name keeps the slug unsuffixed.
        expect(created.slug).toBe(name.toLowerCase().replace(/ /g, "-"));

        const row = yield* findProjectRow(created.id);
        expect(row).toBeDefined();
        expect(row?.name).toBe(name);
        expect(row?.slug).toBe(created.slug);
        expect(row?.organizationId).toBe(organizationId);
        expect(row?.createdByUserId).toBe(CoreTestFixture.userId);

        // The bootstrap publishable api key is written in the same transaction.
        const keys = yield* findApiKeyRows(created.id);
        expect(keys.length).toBe(1);
        expect(keys[0]?.isPublic).toBe(true);
        expect(keys[0]?.prefix).toBe("vh_pk_");
        expect(keys[0]?.name).toBe("Publishable key");
        expect(keys[0]?.id.startsWith("api_pk_")).toBe(true);

        const auditEntries = yield* findProjectAuditEntries(created.id);
        const createdEntry = auditEntries.find((entry) => entry.action === AuditLogAction.Created);
        expect(createdEntry).toBeDefined();
        expect(createdEntry?.entityType).toBe(AuditLogEntityType.Project);
        expect(createdEntry?.actorUserId).toBe(CoreTestFixture.userId);
        expect(createdEntry?.actorType).toBe(AuditLogActorType.User);
        expect(createdEntry?.changes).toEqual({
          snapshot: { id: created.id, name, slug: created.slug },
        });
      }),
    ).pipe(Effect.provide(ProjectService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "appends a short id when the derived slug is blacklisted",
    withProjectCleanup((track) =>
      Effect.gen(function* () {
        const projectService = yield* ProjectService;

        // `createSlug("auth")` === "auth", which is in SLUG_BLACKLIST.
        const created = yield* projectService.createProject({ name: "auth", organizationId });
        track(created.id);

        expect(created.slug).not.toBe("auth");
        expect(created.slug.startsWith("auth-")).toBe(true);

        const row = yield* findProjectRow(created.id);
        expect(row?.slug).toBe(created.slug);
      }),
    ).pipe(Effect.provide(ProjectService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "appends a short id when the derived slug collides with an existing project",
    withProjectCleanup((track) =>
      Effect.gen(function* () {
        const projectService = yield* ProjectService;
        const name = uniqueName("collide");
        const baseSlug = name.toLowerCase().replace(/ /g, "-");

        const first = yield* projectService.createProject({ name, organizationId });
        track(first.id);
        expect(first.slug).toBe(baseSlug);

        // Same name -> same base slug -> collision avoidance appends a short id.
        const second = yield* projectService.createProject({ name, organizationId });
        track(second.id);
        expect(second.slug).not.toBe(baseSlug);
        expect(second.slug.startsWith(`${baseSlug}-`)).toBe(true);

        // Both rows exist with distinct slugs (the unique index was respected).
        const firstRow = yield* findProjectRow(first.id);
        const secondRow = yield* findProjectRow(second.id);
        expect(firstRow?.slug).toBe(baseSlug);
        expect(secondRow?.slug).toBe(second.slug);
      }),
    ).pipe(Effect.provide(ProjectService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without organization:all and writes no project",
    // No cleanup wrapper: a forbidden create writes no row.
    Effect.gen(function* () {
      const projectService = yield* ProjectService;
      const name = uniqueName("create-forbidden");
      const slug = name.toLowerCase().replace(/ /g, "-");

      const error = yield* Effect.flip(
        asUnauthorized(projectService.createProject({ name, organizationId })),
      );
      expect(error).toBeInstanceOf(ActionForbiddenError);

      const db = yield* Db;
      const rows = yield* db
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.organizationId, organizationId), eq(projects.slug, slug)));
      expect(rows.length).toBe(0);
    }).pipe(Effect.provide(ProjectService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "fails with AuthenticationError when the session carries no user and writes no project",
    // No cleanup wrapper: creation fails before any row is written.
    Effect.gen(function* () {
      const projectService = yield* ProjectService;
      const name = uniqueName("create-no-user");
      const slug = name.toLowerCase().replace(/ /g, "-");

      const error = yield* Effect.flip(
        projectService
          .createProject({ name, organizationId })
          .pipe(CoreAuthSession.authenticate(sessionWithoutUser())),
      );
      expect(error).toBeInstanceOf(AuthenticationError);

      const db = yield* Db;
      const rows = yield* db
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.organizationId, organizationId), eq(projects.slug, slug)));
      expect(rows.length).toBe(0);
    }).pipe(Effect.provide(ProjectService.layer), CoreAuthSession.authenticate()),
  );
});

describe("ProjectService.updateProject", () => {
  test(
    "renames the project row and records an updated audit entry",
    withProjectCleanup((track) =>
      Effect.gen(function* () {
        const projectService = yield* ProjectService;
        const created = yield* projectService.createProject({
          name: uniqueName("update-before"),
          organizationId,
        });
        track(created.id);

        const newName = uniqueName("update-after");
        // The default fixture session only grants `project:all` on the seeded
        // project, so the freshly created project needs an explicit grant.
        yield* asProjectMember(
          created.id,
          projectService.updateProject({ id: created.id, name: newName }),
        );

        const row = yield* findProjectRow(created.id);
        expect(row?.name).toBe(newName);
        // The slug is intentionally untouched by an update.
        expect(row?.slug).toBe(created.slug);

        const auditEntries = yield* findProjectAuditEntries(created.id);
        const updatedEntry = auditEntries.find((entry) => entry.action === AuditLogAction.Updated);
        expect(updatedEntry).toBeDefined();
        expect(updatedEntry?.actorUserId).toBe(CoreTestFixture.userId);
        expect(updatedEntry?.changes).toEqual({ snapshot: { name: newName } });
      }),
    ).pipe(Effect.provide(ProjectService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "fails with ProjectNotFoundError when the project does not exist",
    Effect.gen(function* () {
      const projectService = yield* ProjectService;
      const id = `proj_missing_${Date.now()}`;
      const error = yield* Effect.flip(projectService.updateProject({ id, name: "Nope" }));
      expect(error).toBeInstanceOf(ProjectNotFoundError);
      if (error instanceof ProjectNotFoundError) {
        expect(error.projectId).toBe(id);
      }
    }).pipe(Effect.provide(ProjectService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all and leaves the row unchanged",
    withProjectCleanup((track) =>
      Effect.gen(function* () {
        const projectService = yield* ProjectService;
        const created = yield* projectService.createProject({
          name: uniqueName("update-forbidden"),
          organizationId,
        });
        track(created.id);

        const error = yield* Effect.flip(
          asUnauthorized(projectService.updateProject({ id: created.id, name: "Hijacked" })),
        );
        expect(error).toBeInstanceOf(ActionForbiddenError);

        const row = yield* findProjectRow(created.id);
        expect(row?.name).toBe(created.name);
      }),
    ).pipe(Effect.provide(ProjectService.layer), CoreAuthSession.authenticate()),
  );
});

describe("ProjectService.deleteProject", () => {
  test(
    "removes the project row and records a deleted audit entry",
    withProjectCleanup((track) =>
      Effect.gen(function* () {
        const projectService = yield* ProjectService;
        const created = yield* projectService.createProject({
          name: uniqueName("delete"),
          organizationId,
        });
        track(created.id);

        // The default fixture session only grants `project:all` on the seeded
        // project, so the freshly created project needs an explicit grant.
        yield* asProjectMember(created.id, projectService.deleteProject({ id: created.id }));

        const row = yield* findProjectRow(created.id);
        expect(row).toBeUndefined();

        const lookup = yield* projectService.getProjectById(created.id);
        expect(lookup).toBeNull();

        const auditEntries = yield* findProjectAuditEntries(created.id);
        const deletedEntry = auditEntries.find((entry) => entry.action === AuditLogAction.Deleted);
        expect(deletedEntry).toBeDefined();
        expect(deletedEntry?.actorUserId).toBe(CoreTestFixture.userId);
      }),
    ).pipe(Effect.provide(ProjectService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "fails with ProjectNotFoundError when the project does not exist",
    Effect.gen(function* () {
      const projectService = yield* ProjectService;
      const id = `proj_missing_${Date.now()}`;
      const error = yield* Effect.flip(projectService.deleteProject({ id }));
      expect(error).toBeInstanceOf(ProjectNotFoundError);
      if (error instanceof ProjectNotFoundError) {
        expect(error.projectId).toBe(id);
      }
    }).pipe(Effect.provide(ProjectService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all and retains the project",
    withProjectCleanup((track) =>
      Effect.gen(function* () {
        const projectService = yield* ProjectService;
        const created = yield* projectService.createProject({
          name: uniqueName("delete-forbidden"),
          organizationId,
        });
        track(created.id);

        const error = yield* Effect.flip(
          asUnauthorized(projectService.deleteProject({ id: created.id })),
        );
        expect(error).toBeInstanceOf(ActionForbiddenError);

        const row = yield* findProjectRow(created.id);
        expect(row).toBeDefined();
      }),
    ).pipe(Effect.provide(ProjectService.layer), CoreAuthSession.authenticate()),
  );
});
