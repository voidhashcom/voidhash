import { describe, expect, it } from "vite-plus/test";

import type { AnyAuthSession, PublishableKeySession } from "../../../src/domain/auth/Auth.ts";
import { elevateProjectAccess } from "../../../src/services/sdk/elevate-auth.ts";

const ELEVATED_PERMISSION = "project:all";

type SessionProject = AnyAuthSession["projects"][number];

/** Fresh, per-test project fixture under the `it_org` organization. */
const project = (
  id: string,
  permissions: ReadonlyArray<string> = ["project:read"],
): SessionProject => ({
  id,
  logo: null,
  name: `name-${id}`,
  organizationId: "org_1",
  permissions: [...permissions],
  slug: `slug-${id}`,
});

/**
 * Fresh publishable-key session fixture — the realistic principal that
 * `SdkService` elevates. Each call returns a brand-new object graph so tests
 * never share mutable state.
 */
const publishableSession = (
  projects: ReadonlyArray<SessionProject> = [project("proj_1")],
): PublishableKeySession => ({
  cookie: null,
  method: "publishable-key",
  name: "sdk-publishable",
  organizations: [
    {
      id: "org_1",
      logo: null,
      name: "Org One",
      permissions: ["organization:read"],
      slug: "org-one",
      workosOrganizationId: null,
    },
  ],
  person: { distinctId: "person_1" },
  projects: [...projects],
  user: null,
});

describe("elevateProjectAccess", () => {
  it("adds project:all permission to the matching project id", () => {
    const session = publishableSession([project("proj_1", ["project:read"])]);

    const elevated = elevateProjectAccess(session, "proj_1");

    const target = elevated.projects.find((p) => p.id === "proj_1");
    expect(target?.permissions).toContain(ELEVATED_PERMISSION);
  });

  it("does not mutate the input session", () => {
    const session = publishableSession([project("proj_1", ["project:read"])]);
    // Snapshot the permissions array reference + contents before elevation.
    const originalProjects = session.projects;
    const originalPerms = session.projects[0]?.permissions;
    const originalPermsCopy = [...(originalPerms ?? [])];

    elevateProjectAccess(session, "proj_1");

    // The original arrays must be untouched (no in-place push / splice).
    expect(session.projects).toBe(originalProjects);
    expect(session.projects[0]?.permissions).toBe(originalPerms);
    expect(session.projects[0]?.permissions).toEqual(originalPermsCopy);
    expect(session.projects[0]?.permissions).not.toContain(ELEVATED_PERMISSION);
  });

  it("returns a new session object (not the same reference)", () => {
    const session = publishableSession([project("proj_1")]);

    const elevated = elevateProjectAccess(session, "proj_1");

    expect(elevated).not.toBe(session);
    expect(elevated.projects).not.toBe(session.projects);
  });

  it("survives a deeply frozen input (purely non-mutating)", () => {
    const session = publishableSession([project("proj_1", ["project:read"])]);
    Object.freeze(session);
    Object.freeze(session.projects);
    for (const p of session.projects) {
      Object.freeze(p);
      Object.freeze(p.permissions);
    }

    const elevated = elevateProjectAccess(session, "proj_1");

    expect(elevated.projects.find((p) => p.id === "proj_1")?.permissions).toContain(
      ELEVATED_PERMISSION,
    );
  });

  it("preserves existing permissions on the matching project", () => {
    const session = publishableSession([project("proj_1", ["project:read", "project:write"])]);

    const elevated = elevateProjectAccess(session, "proj_1");

    const target = elevated.projects.find((p) => p.id === "proj_1");
    expect(target?.permissions).toEqual(["project:read", "project:write", ELEVATED_PERMISSION]);
  });

  it("ignores non-matching project ids", () => {
    const session = publishableSession([project("proj_1", ["project:read"])]);

    const elevated = elevateProjectAccess(session, "proj_does_not_exist");

    const target = elevated.projects.find((p) => p.id === "proj_1");
    expect(target?.permissions).toEqual(["project:read"]);
    expect(target?.permissions).not.toContain(ELEVATED_PERMISSION);
  });

  it("does not add a duplicate project:all if already present", () => {
    const session = publishableSession([project("proj_1", ["project:read", ELEVATED_PERMISSION])]);

    const elevated = elevateProjectAccess(session, "proj_1");

    const target = elevated.projects.find((p) => p.id === "proj_1");
    expect(target?.permissions).toEqual(["project:read", ELEVATED_PERMISSION]);
    expect(target?.permissions.filter((perm) => perm === ELEVATED_PERMISSION).length).toBe(1);
  });

  it("returns the same permissions array reference when already elevated (no needless copy)", () => {
    const original = project("proj_1", ["project:read", ELEVATED_PERMISSION]);
    const session = publishableSession([original]);

    const elevated = elevateProjectAccess(session, "proj_1");

    const target = elevated.projects.find((p) => p.id === "proj_1");
    expect(target?.permissions).toBe(original.permissions);
  });

  it("handles an empty projects array", () => {
    const session = publishableSession([]);

    const elevated = elevateProjectAccess(session, "proj_1");

    expect(elevated.projects).toEqual([]);
  });

  it("elevates only the target project among multiple projects", () => {
    const session = publishableSession([
      project("proj_1", ["project:read"]),
      project("proj_2", ["project:read"]),
      project("proj_3", ["project:read"]),
    ]);

    const elevated = elevateProjectAccess(session, "proj_2");

    const byId = (id: string) => elevated.projects.find((p) => p.id === id);
    expect(byId("proj_1")?.permissions).not.toContain(ELEVATED_PERMISSION);
    expect(byId("proj_2")?.permissions).toContain(ELEVATED_PERMISSION);
    expect(byId("proj_3")?.permissions).not.toContain(ELEVATED_PERMISSION);
  });

  it("preserves all other session fields unchanged", () => {
    const session = publishableSession([project("proj_1")]);

    const elevated = elevateProjectAccess(session, "proj_1");

    expect(elevated.method).toBe(session.method);
    expect(elevated.name).toBe(session.name);
    expect(elevated.cookie).toBe(session.cookie);
    expect(elevated.user).toBe(session.user);
    expect(elevated.person).toBe(session.person);
    expect(elevated.organizations).toBe(session.organizations);
  });

  it("leaves untouched projects as the same reference (only the target is copied)", () => {
    const untouched = project("proj_2", ["project:read"]);
    const session = publishableSession([project("proj_1"), untouched]);

    const elevated = elevateProjectAccess(session, "proj_1");

    expect(elevated.projects.find((p) => p.id === "proj_2")).toBe(untouched);
  });
});
