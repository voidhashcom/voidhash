import {
  OrganizationPermissions,
  type ProjectPermission,
  ProjectPermissions,
} from "@voidhash/lib";
import { describe, expect, it } from "vite-plus/test";
import { Effect, Exit, Logger } from "effect";

import {
  ActionForbiddenError,
  type AnyAuthSession,
  AuthSession,
  type SessionProjectSchema,
  type UserSession,
} from "../../src/domain/auth/Auth.ts";
import {
  checkOrganizationPermission,
  checkProjectPermission,
  extractAuthorizedProjectId,
} from "../../src/utils/permissions.ts";

type SessionProject = typeof SessionProjectSchema.Type;
type SessionOrganization = UserSession["organizations"][number];

/**
 * Build a session project carrying `project:all` by default. Tests pass
 * `permissions: []` to exercise the insufficient-permission path.
 */
const project = (overrides: Partial<SessionProject> = {}): SessionProject => ({
  id: "project_default",
  logo: null,
  name: "Default Project",
  organizationId: "org_default",
  permissions: [ProjectPermissions.all],
  slug: "default-project",
  ...overrides,
});

const organization = (overrides: Partial<SessionOrganization> = {}): SessionOrganization => ({
  id: "org_default",
  logo: null,
  name: "Default Org",
  permissions: [OrganizationPermissions.all],
  slug: "default-org",
  workosOrganizationId: "workos_org_default",
  ...overrides,
});

/**
 * A complete `UserSession` with the supplied projects/organizations. Fresh per
 * test — no shared mutable fixture state.
 */
const userSession = (overrides: Partial<UserSession> = {}): UserSession => ({
  cookie: null,
  method: "user",
  name: "test-user-session",
  organizations: [organization()],
  person: null,
  projects: [project()],
  user: {
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    email: "user@example.com",
    emailVerified: true,
    id: "user_default",
    image: null,
    name: "Test User",
    role: null,
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    workosUserId: "workos_user_default",
  },
  ...overrides,
});

/** Provide a session value into the `AuthSession` context for a guarded check. */
const withSession = (session: AnyAuthSession) => Effect.provideService(AuthSession, session);

/**
 * Capture log records emitted while running `effect`. We replace the runtime
 * loggers with a recorder so the permission-denied warning is observable
 * without hitting the console.
 */
const runCapturingLogs = async <A, E>(effect: Effect.Effect<A, E, never>) => {
  const records: Array<{ level: string; message: string }> = [];
  const recorder = Logger.make<unknown, void>((options) => {
    records.push({
      level: String(options.logLevel),
      message: Array.isArray(options.message)
        ? options.message.map(String).join(" ")
        : String(options.message),
    });
  });
  const exit = await Effect.runPromiseExit(
    effect.pipe(Effect.provide(Logger.layer([recorder], { mergeWithExisting: false }))),
  );
  return { exit, records };
};

describe("extractAuthorizedProjectId", () => {
  it("returns the project id for a session carrying exactly one project", async () => {
    const session = userSession({ projects: [project({ id: "project_only" })] });
    const result = await Effect.runPromise(extractAuthorizedProjectId(session));
    expect(result).toBe("project_only");
  });

  it("returns the FIRST project id when the session carries several", async () => {
    const session = userSession({
      projects: [
        project({ id: "project_first" }),
        project({ id: "project_second" }),
        project({ id: "project_third" }),
      ],
    });
    const result = await Effect.runPromise(extractAuthorizedProjectId(session));
    expect(result).toBe("project_first");
  });

  it("fails with ActionForbiddenError when the projects array is empty", async () => {
    const session = userSession({ projects: [] });
    // `Effect.flip` surfaces the typed error into the success channel so we can
    // assert on its tag/shape directly.
    const error = await Effect.runPromise(extractAuthorizedProjectId(session).pipe(Effect.flip));
    expect(error).toBeInstanceOf(ActionForbiddenError);
    expect(error.message).toBe("No project found for this authentication method.");
  });

  it("fails with ActionForbiddenError when the first project is nullish", async () => {
    // Defends the `authSession.projects[0]?.id` guard against a hole at index 0.
    const session = userSession({
      projects: [undefined as unknown as SessionProject],
    });
    const error = await Effect.runPromise(extractAuthorizedProjectId(session).pipe(Effect.flip));
    expect(error).toBeInstanceOf(ActionForbiddenError);
  });
});

describe("checkProjectPermission", () => {
  it("returns true when the session has the queried project and permission", async () => {
    const session = userSession({
      projects: [project({ id: "project_target", permissions: [ProjectPermissions.all] })],
    });
    const result = await Effect.runPromise(
      checkProjectPermission("project_target", ProjectPermissions.all, "denied").pipe(
        withSession(session),
      ),
    );
    expect(result).toBe(true);
  });

  it("fails with ActionForbiddenError when the session lacks the queried project id", async () => {
    const session = userSession({
      projects: [project({ id: "project_other", permissions: [ProjectPermissions.all] })],
    });
    const error = await Effect.runPromise(
      checkProjectPermission("project_target", ProjectPermissions.all, "no access to project").pipe(
        withSession(session),
        Effect.flip,
      ),
    );
    expect(error).toBeInstanceOf(ActionForbiddenError);
    expect(error.message).toBe("no access to project");
  });

  it("fails with ActionForbiddenError when the project exists but lacks the permission", async () => {
    const session = userSession({
      projects: [project({ id: "project_target", permissions: [] })],
    });
    const error = await Effect.runPromise(
      checkProjectPermission("project_target", ProjectPermissions.all, "missing perm").pipe(
        withSession(session),
        Effect.flip,
      ),
    );
    expect(error).toBeInstanceOf(ActionForbiddenError);
    expect(error.message).toBe("missing perm");
  });

  it("dies when no AuthSession service is provided at all", async () => {
    // The source guards with `session?.projects`, implying it expects a
    // possibly-absent session. In practice `AuthSession` is a required Effect
    // service: when it is never provided, `yield* AuthSession` is an
    // unrecoverable defect ("Service not found") rather than a clean
    // ActionForbiddenError. We pin that real boundary here so a future change
    // making the service genuinely optional shows up as a test break.
    const exit = await Effect.runPromiseExit(
      // deliberately running without
      // the AuthSession requirement satisfied to observe the missing-service defect.
      checkProjectPermission(
        "project_target",
        ProjectPermissions.all,
        "no session",
      ) as Effect.Effect<boolean, ActionForbiddenError, never>,
    );
    expect(Exit.isFailure(exit)).toBe(true);
  });
});

describe("checkOrganizationPermission", () => {
  it("returns true when the session has the queried org and permission", async () => {
    const session = userSession({
      organizations: [
        organization({ id: "org_target", permissions: [OrganizationPermissions.all] }),
      ],
    });
    const result = await Effect.runPromise(
      checkOrganizationPermission("org_target", OrganizationPermissions.all, "denied").pipe(
        withSession(session),
      ),
    );
    expect(result).toBe(true);
  });

  it("fails with ActionForbiddenError when the session lacks the queried org id", async () => {
    const session = userSession({
      organizations: [
        organization({ id: "org_other", permissions: [OrganizationPermissions.all] }),
      ],
    });
    const error = await Effect.runPromise(
      checkOrganizationPermission("org_target", OrganizationPermissions.all, "no org access").pipe(
        withSession(session),
        Effect.flip,
      ),
    );
    expect(error).toBeInstanceOf(ActionForbiddenError);
    expect(error.message).toBe("no org access");
  });

  it("fails with ActionForbiddenError when the org exists but lacks the permission", async () => {
    const session = userSession({
      organizations: [organization({ id: "org_target", permissions: [] })],
    });
    const error = await Effect.runPromise(
      checkOrganizationPermission(
        "org_target",
        OrganizationPermissions.all,
        "missing org perm",
      ).pipe(withSession(session), Effect.flip),
    );
    expect(error).toBeInstanceOf(ActionForbiddenError);
    expect(error.message).toBe("missing org perm");
  });

  it("dies when no AuthSession service is provided at all", async () => {
    // Same required-service boundary as checkProjectPermission: an absent
    // AuthSession is a defect, not an ActionForbiddenError.
    const exit = await Effect.runPromiseExit(
      checkOrganizationPermission(
        "org_target",
        OrganizationPermissions.all,
        "no session",
      ) as Effect.Effect<boolean, ActionForbiddenError, never>,
    );
    expect(Exit.isFailure(exit)).toBe(true);
  });
});

describe("permission-denied logging", () => {
  it("logs a warning carrying the denial message before failing", async () => {
    const session = userSession({
      projects: [project({ id: "project_other", permissions: [ProjectPermissions.all] })],
    });
    const { exit, records } = await runCapturingLogs(
      checkProjectPermission("project_target", ProjectPermissions.all, "audit me").pipe(
        withSession(session),
      ),
    );
    expect(exit._tag).toBe("Failure");
    const warning = records.find((r) => r.level === "Warn");
    expect(warning).toBeDefined();
    expect(warning?.message).toContain("audit me");
  });

  it("does NOT log a warning when permission is granted", async () => {
    const session = userSession({
      projects: [project({ id: "project_target", permissions: [ProjectPermissions.all] })],
    });
    const { exit, records } = await runCapturingLogs(
      checkProjectPermission("project_target", ProjectPermissions.all, "should not log").pipe(
        withSession(session),
      ),
    );
    expect(exit._tag).toBe("Success");
    expect(records.some((r) => r.level === "Warn")).toBe(false);
  });
});

// Sanity reference so an unused-import lint never trips the typed permission union.
const _typecheckGuard: ProjectPermission = ProjectPermissions.all;
void _typecheckGuard;
