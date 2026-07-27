import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";

import type { AnyAuthSession, UserSession } from "@voidhash/rpc";

import { AuthenticationError, AuthSession } from "../../../src/domain/auth/Auth.ts";
import { UserService } from "../../../src/services/users/UserService.ts";

/**
 * UserService is pure Effect logic: `getUser` reads the optional `AuthSession`
 * service and maps it to the public `User` shape (logos forced to `null`,
 * permissions dropped). No DB, no network — so we drive it as a unit test,
 * providing a hand-built session value directly via `Effect.provideService`.
 */

/** Fresh, fully-typed `user`-method session for each test; `overrides` keeps fixtures independent. */
const userSession = (overrides: Partial<UserSession> = {}): UserSession => ({
  cookie: null,
  method: "user",
  name: "session-name",
  organizations: [
    {
      id: "org-1",
      logo: null,
      name: "Org One",
      permissions: ["org:read"],
      slug: "org-one",
      workosOrganizationId: "wos_org_1",
    },
  ],
  person: null,
  projects: [
    {
      id: "proj-1",
      logo: null,
      name: "Project One",
      organizationId: "org-1",
      permissions: ["project:read"],
      slug: "project-one",
    },
  ],
  user: {
    createdAt: new Date("2026-01-01T00:00:00Z"),
    email: "user@example.com",
    emailVerified: true,
    id: "user-1",
    image: null,
    name: "User One",
    role: "admin",
    updatedAt: new Date("2026-02-01T00:00:00Z"),
    workosUserId: "wos_user_1",
  },
  ...overrides,
});

/** Resolve the service and invoke `getUser` — the impl lives on the resolved instance, not the tag. */
const getUser = Effect.gen(function* () {
  const service = yield* UserService;
  return yield* service.getUser();
});

/** Run `getUser` against a provided session value and return the success channel. */
const runGetUser = (session: AnyAuthSession) =>
  Effect.runPromise(
    getUser.pipe(Effect.provideService(AuthSession, session), Effect.provide(UserService.layer)),
  );

describe("UserService.getUser", () => {
  it("returns the user with mapped organizations and projects from the session", async () => {
    const session = userSession();
    const user = await runGetUser(session);

    // The user fields are spread through verbatim.
    expect(user.id).toBe("user-1");
    expect(user.email).toBe("user@example.com");
    expect(user.emailVerified).toBe(true);
    expect(user.name).toBe("User One");
    expect(user.role).toBe("admin");
    expect(user.image).toBeNull();
    expect(user.createdAt).toEqual(session.user.createdAt);
    expect(user.updatedAt).toEqual(session.user.updatedAt);

    expect(user.organizations).toHaveLength(1);
    expect(user.projects).toHaveLength(1);
  });

  it("maps each organization to {id, logo:null, name, slug, workosOrganizationId, internalFeatureFlags}, dropping permissions", async () => {
    const user = await runGetUser(userSession());

    expect(user.organizations[0]).toEqual({
      id: "org-1",
      logo: null,
      name: "Org One",
      slug: "org-one",
      workosOrganizationId: "wos_org_1",
      // No InternalFeatureFlagService is provided in this unit, so flags resolve
      // to the empty fallback.
      internalFeatureFlags: [],
    });
    // permissions are intentionally not part of the public projection.
    expect(user.organizations[0]).not.toHaveProperty("permissions");
  });

  it("maps each project to {id, logo:null, name, organizationId, slug}, dropping permissions", async () => {
    const user = await runGetUser(userSession());

    expect(user.projects[0]).toEqual({
      id: "proj-1",
      logo: null,
      name: "Project One",
      organizationId: "org-1",
      slug: "project-one",
    });
    expect(user.projects[0]).not.toHaveProperty("permissions");
  });

  it("returns empty organizations/projects arrays when the session has none", async () => {
    const user = await runGetUser(userSession({ organizations: [], projects: [] }));

    expect(user.organizations).toEqual([]);
    expect(user.projects).toEqual([]);
  });

  it("maps multiple organizations and projects preserving their order", async () => {
    const user = await runGetUser(
      userSession({
        organizations: [
          {
            id: "org-a",
            logo: null,
            name: "A",
            permissions: [],
            slug: "a",
            workosOrganizationId: "wos_a",
          },
          {
            id: "org-b",
            logo: null,
            name: "B",
            permissions: [],
            slug: "b",
            workosOrganizationId: "wos_b",
          },
        ],
        projects: [
          {
            id: "proj-a",
            logo: null,
            name: "PA",
            organizationId: "org-a",
            permissions: [],
            slug: "pa",
          },
          {
            id: "proj-b",
            logo: null,
            name: "PB",
            organizationId: "org-b",
            permissions: [],
            slug: "pb",
          },
        ],
      }),
    );

    expect(user.organizations.map((o) => o.id)).toEqual(["org-a", "org-b"]);
    expect(user.projects.map((p) => p.id)).toEqual(["proj-a", "proj-b"]);
  });

  it("fails with AuthenticationError when no AuthSession is provided (Option.none)", async () => {
    // `Effect.flip` moves the typed error into the success channel so we can
    // assert on its class directly. No session is provided here, so the
    // `Effect.serviceOption(AuthSession)` read yields `Option.none()`.
    const error = await Effect.runPromise(
      getUser.pipe(Effect.provide(UserService.layer), Effect.flip),
    );

    expect(error).toBeInstanceOf(AuthenticationError);
    expect((error as AuthenticationError).cause).toBe("User not found");
  });

  it("fails with AuthenticationError when the session carries no user (e.g. secret-key session)", async () => {
    // A secret-key session is present but its `user` field is `null`; `getUser`
    // must reject it rather than synthesizing a user.
    const secretKeySession: AnyAuthSession = {
      cookie: null,
      method: "secret-key",
      name: "service-account",
      organizations: [],
      person: null,
      projects: [],
      user: null,
    };

    const error = await Effect.runPromise(
      getUser.pipe(
        Effect.provideService(AuthSession, secretKeySession),
        Effect.provide(UserService.layer),
        Effect.flip,
      ),
    );

    expect(error).toBeInstanceOf(AuthenticationError);
    expect((error as AuthenticationError).message).toBe("User not found");
  });
});
