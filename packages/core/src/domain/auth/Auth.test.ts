import { describe, expect, it } from "vite-plus/test";

import { makeInternalProjectAuthSession, makeInternalProjectUserAuthSession } from "./Auth.ts";

describe("makeInternalProjectAuthSession", () => {
  it("constructs a project-scoped session that uses normal service authorization", () => {
    const session = makeInternalProjectAuthSession(
      {
        id: "project-1",
        name: "Project",
        organizationId: "organization-1",
        slug: "project",
      },
      "Agent session",
    );

    expect(session).toMatchObject({
      method: "secret-key",
      name: "Agent session",
      projects: [
        {
          id: "project-1",
          organizationId: "organization-1",
          permissions: ["project:all"],
          slug: "project",
        },
      ],
    });
    expect(session.organizations).toEqual([]);
    expect(session.user).toBeNull();
  });

  it("preserves an authenticated user across a trusted runtime boundary", () => {
    const session = makeInternalProjectUserAuthSession(
      {
        id: "project-1",
        name: "Project",
        organizationId: "organization-1",
        slug: "project",
      },
      "user-1",
      "Agent session",
    );

    expect(session).toMatchObject({
      method: "user",
      name: "Agent session",
      projects: [
        {
          id: "project-1",
          organizationId: "organization-1",
          permissions: ["project:all"],
        },
      ],
      user: { id: "user-1" },
    });
  });
});
