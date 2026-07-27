import { describe, expect, it } from "vitest";

import {
  authenticateWithOrganizationSelectionChallenge,
  getOrganizationSelectionChallenge,
} from "./workos-user-management.server";

describe("getOrganizationSelectionChallenge", () => {
  it("extracts the WorkOS organization-selection challenge", () => {
    expect(
      getOrganizationSelectionChallenge({
        code: "organization_selection_required",
        pendingAuthenticationToken: "pat_123",
        rawData: {
          organizations: [
            { id: "org_1", name: "Acme" },
            { id: "org_2", name: "Beta" },
          ],
        },
      }),
    ).toEqual({
      organizations: [
        { id: "org_1", name: "Acme" },
        { id: "org_2", name: "Beta" },
      ],
      pendingAuthenticationToken: "pat_123",
    });
  });

  it("reads the pending token from rawData and ignores malformed organizations", () => {
    expect(
      getOrganizationSelectionChallenge({
        rawData: {
          code: "organization_selection_required",
          organizations: [{ id: "org_1" }, { name: "Missing id" }, null],
          pending_authentication_token: "pat_456",
        },
      }),
    ).toEqual({
      organizations: [{ id: "org_1", name: "org_1" }],
      pendingAuthenticationToken: "pat_456",
    });
  });

  it("returns null for non-organization-selection errors", () => {
    expect(
      getOrganizationSelectionChallenge({
        code: "email_verification_required",
        pendingAuthenticationToken: "pat_123",
      }),
    ).toBeNull();
  });
});

describe("authenticateWithOrganizationSelectionChallenge", () => {
  it("authenticates against the first organization returned by WorkOS", async () => {
    const authenticateWithOrganizationSelection = async (payload: unknown) => {
      expect(payload).toEqual({
        clientId: "client_123",
        organizationId: "org_1",
        pendingAuthenticationToken: "pat_123",
        session: {
          cookiePassword: "cookie_secret",
          sealSession: true,
        },
      });

      return { sealedSession: "sealed_session" };
    };

    const result = await authenticateWithOrganizationSelectionChallenge(
      {
        userManagement: {
          authenticateWithOrganizationSelection,
        },
      } as never,
      {
        code: "organization_selection_required",
        pendingAuthenticationToken: "pat_123",
        rawData: {
          organizations: [
            { id: "org_1", name: "Acme" },
            { id: "org_2", name: "Beta" },
          ],
        },
      },
      { clientId: "client_123", cookiePassword: "cookie_secret" },
    );

    expect(result).toEqual({ sealedSession: "sealed_session" });
  });
});
