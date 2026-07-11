import { describe, expect, it } from "vite-plus/test";

import type { AnyAuthSession } from "../../domain/auth/Auth.ts";
import { isSessionOrganizationMember } from "../../utils/permissions.ts";

const makeSession = (orgIds: readonly string[]): AnyAuthSession => ({
  cookie: null,
  method: "secret-key",
  name: "ci-key",
  organizations: orgIds.map((id) => ({
    id,
    logo: null,
    name: id,
    permissions: ["project:all"],
    slug: id,
    workosOrganizationId: null,
  })),
  person: null,
  projects: [],
  user: null,
});

describe("isSessionOrganizationMember", () => {
  it("is true when the org is present in the session", () => {
    expect(isSessionOrganizationMember(makeSession(["org_1", "org_2"]), "org_2")).toBe(true);
  });

  it("is false when the org is absent (cross-org access denied)", () => {
    expect(isSessionOrganizationMember(makeSession(["org_1"]), "org_2")).toBe(false);
  });

  it("is false for a session with no organizations", () => {
    expect(isSessionOrganizationMember(makeSession([]), "org_1")).toBe(false);
  });
});
