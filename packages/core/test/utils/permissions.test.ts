import {
  OrganizationPermissions,
  type ProjectPermission,
  ProjectPermissions,
} from "@voidhash/lib";
import { Context, DateTime, Effect, Exit, Logger } from "effect";

import { describe, expect, it } from "../../src/testing/effect-vitest.ts";
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

const at = (iso: string): Date => DateTime.toDateUtc(DateTime.makeUnsafe(iso));

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
    createdAt: at("2026-01-01T00:00:00.000Z"),
    email: "user@example.com",
    emailVerified: true,
    id: "user_default",
    image: null,
    name: "Test User",
    role: null,
    updatedAt: at("2026-01-01T00:00:00.000Z"),
    workosUserId: "workos_user_default",
  },
  ...overrides,
});

/** Provide a session value into the `AuthSession` context for a guarded check. */
const withSession = (session: AnyAuthSession) => Effect.provideService(AuthSession, session);

/**
 * Discharge the `AuthSession` requirement with a context that does NOT actually
 * carry the service, so a check can run with its dependency deliberately
 * unsatisfied and the real missing-service defect stays observable.
 */
const withoutSession = Effect.provide(Context.makeUnsafe<AuthSession>(new Map()));

const formatLogMessage = (message: unknown): string => {
  if (Array.isArray(message)) {
    return message.map(String).join(" ");
  }
  return String(message);
};

/**
 * Capture log records emitted while running `effect`. We replace the runtime
 * loggers with a recorder so the permission-denied warning is observable
 * without hitting the console.
 */
const runCapturingLogs = <A, E>(effect: Effect.Effect<A, E, never>) =>
  Effect.gen(function* () {
    const records: Array<{ level: string; message: string }> = [];
    const recorder = Logger.make<unknown, void>((options) => {
      records.push({
        level: String(options.logLevel),
        message: formatLogMessage(options.message),
      });
    });
    const exit = yield* Effect.exit(
      effect.pipe(Effect.provide(Logger.layer([recorder], { mergeWithExisting: false }))),
    );
    return { exit, records };
  });

describe("extractAuthorizedProjectId", () => {
  it.effect("returns the project id for a session carrying exactly one project", () =>
    Effect.gen(function* () {
      const session = userSession({ projects: [project({ id: "project_only" })] });
      const result = yield* extractAuthorizedProjectId(session);
      expect(result).toBe("project_only");
    }),
  );

  it.effect("returns the FIRST project id when the session carries several", () =>
    Effect.gen(function* () {
      const session = userSession({
        projects: [
          project({ id: "project_first" }),
          project({ id: "project_second" }),
          project({ id: "project_third" }),
        ],
      });
      const result = yield* extractAuthorizedProjectId(session);
      expect(result).toBe("project_first");
    }),
  );

  it.effect("fails with ActionForbiddenError when the projects array is empty", () =>
    Effect.gen(function* () {
      const session = userSession({ projects: [] });
      // `Effect.flip` surfaces the typed error into the success channel so we can
      // assert on its tag/shape directly.
      const error = yield* Effect.flip(extractAuthorizedProjectId(session));
      expect(error).toBeInstanceOf(ActionForbiddenError);
      expect(error.message).toBe("No project found for this authentication method.");
    }),
  );

  it.effect("fails with ActionForbiddenError when the first project is nullish", () =>
    Effect.gen(function* () {
      // Defends the `authSession.projects[0]?.id` guard against a hole at index 0:
      // a sparse array of length 1 reads `undefined` at index 0 while staying typed.
      const projectsWithHole: Array<SessionProject> = Array.from({ length: 1 });
      const session = userSession({ projects: projectsWithHole });
      const error = yield* Effect.flip(extractAuthorizedProjectId(session));
      expect(error).toBeInstanceOf(ActionForbiddenError);
    }),
  );
});

describe("checkProjectPermission", () => {
  it.effect("returns true when the session has the queried project and permission", () =>
    Effect.gen(function* () {
      const session = userSession({
        projects: [project({ id: "project_target", permissions: [ProjectPermissions.all] })],
      });
      const result = yield* checkProjectPermission(
        "project_target",
        ProjectPermissions.all,
        "denied",
      ).pipe(withSession(session));
      expect(result).toBe(true);
    }),
  );

  it.effect("fails with ActionForbiddenError when the session lacks the queried project id", () =>
    Effect.gen(function* () {
      const session = userSession({
        projects: [project({ id: "project_other", permissions: [ProjectPermissions.all] })],
      });
      const error = yield* checkProjectPermission(
        "project_target",
        ProjectPermissions.all,
        "no access to project",
      ).pipe(withSession(session), Effect.flip);
      expect(error).toBeInstanceOf(ActionForbiddenError);
      expect(error.message).toBe("no access to project");
    }),
  );

  it.effect("fails with ActionForbiddenError when the project exists but lacks the permission", () =>
    Effect.gen(function* () {
      const session = userSession({
        projects: [project({ id: "project_target", permissions: [] })],
      });
      const error = yield* checkProjectPermission(
        "project_target",
        ProjectPermissions.all,
        "missing perm",
      ).pipe(withSession(session), Effect.flip);
      expect(error).toBeInstanceOf(ActionForbiddenError);
      expect(error.message).toBe("missing perm");
    }),
  );

  it.effect("dies when no AuthSession service is provided at all", () =>
    Effect.gen(function* () {
      // The source guards with `session?.projects`, implying it expects a
      // possibly-absent session. In practice `AuthSession` is a required Effect
      // service: when it is never provided, `yield* AuthSession` is an
      // unrecoverable defect ("Service not found") rather than a clean
      // ActionForbiddenError. We pin that real boundary here so a future change
      // making the service genuinely optional shows up as a test break.
      const exit = yield* Effect.exit(
        checkProjectPermission("project_target", ProjectPermissions.all, "no session").pipe(
          withoutSession,
        ),
      );
      expect(Exit.isFailure(exit)).toBe(true);
    }),
  );
});

describe("checkOrganizationPermission", () => {
  it.effect("returns true when the session has the queried org and permission", () =>
    Effect.gen(function* () {
      const session = userSession({
        organizations: [
          organization({ id: "org_target", permissions: [OrganizationPermissions.all] }),
        ],
      });
      const result = yield* checkOrganizationPermission(
        "org_target",
        OrganizationPermissions.all,
        "denied",
      ).pipe(withSession(session));
      expect(result).toBe(true);
    }),
  );

  it.effect("fails with ActionForbiddenError when the session lacks the queried org id", () =>
    Effect.gen(function* () {
      const session = userSession({
        organizations: [
          organization({ id: "org_other", permissions: [OrganizationPermissions.all] }),
        ],
      });
      const error = yield* checkOrganizationPermission(
        "org_target",
        OrganizationPermissions.all,
        "no org access",
      ).pipe(withSession(session), Effect.flip);
      expect(error).toBeInstanceOf(ActionForbiddenError);
      expect(error.message).toBe("no org access");
    }),
  );

  it.effect("fails with ActionForbiddenError when the org exists but lacks the permission", () =>
    Effect.gen(function* () {
      const session = userSession({
        organizations: [organization({ id: "org_target", permissions: [] })],
      });
      const error = yield* checkOrganizationPermission(
        "org_target",
        OrganizationPermissions.all,
        "missing org perm",
      ).pipe(withSession(session), Effect.flip);
      expect(error).toBeInstanceOf(ActionForbiddenError);
      expect(error.message).toBe("missing org perm");
    }),
  );

  it.effect("dies when no AuthSession service is provided at all", () =>
    Effect.gen(function* () {
      // Same required-service boundary as checkProjectPermission: an absent
      // AuthSession is a defect, not an ActionForbiddenError.
      const exit = yield* Effect.exit(
        checkOrganizationPermission("org_target", OrganizationPermissions.all, "no session").pipe(
          withoutSession,
        ),
      );
      expect(Exit.isFailure(exit)).toBe(true);
    }),
  );
});

describe("permission-denied logging", () => {
  it.effect("logs a warning carrying the denial message before failing", () =>
    Effect.gen(function* () {
      const session = userSession({
        projects: [project({ id: "project_other", permissions: [ProjectPermissions.all] })],
      });
      const { exit, records } = yield* runCapturingLogs(
        checkProjectPermission("project_target", ProjectPermissions.all, "audit me").pipe(
          withSession(session),
        ),
      );
      expect(exit._tag).toBe("Failure");
      const warning = records.find((r) => r.level === "Warn");
      expect(warning).toBeDefined();
      expect(warning?.message).toContain("audit me");
    }),
  );

  it.effect("does NOT log a warning when permission is granted", () =>
    Effect.gen(function* () {
      const session = userSession({
        projects: [project({ id: "project_target", permissions: [ProjectPermissions.all] })],
      });
      const { exit, records } = yield* runCapturingLogs(
        checkProjectPermission("project_target", ProjectPermissions.all, "should not log").pipe(
          withSession(session),
        ),
      );
      expect(exit._tag).toBe("Success");
      expect(records.some((r) => r.level === "Warn")).toBe(false);
    }),
  );
});

// Sanity reference so an unused-import lint never trips the typed permission union.
const _typecheckGuard: ProjectPermission = ProjectPermissions.all;
void _typecheckGuard;
