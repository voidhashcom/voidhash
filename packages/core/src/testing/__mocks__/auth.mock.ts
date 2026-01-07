import type { SecretKeySession, UserSession } from "@voidhash/shared";

export const createMockUserAuthSession = (
  overrides: Partial<UserSession> = {}
): UserSession => ({
  name: "Test User <test@example.com>",
  user: {
    createdAt: new Date(),
    email: "test@example.com",
    emailVerified: true,
    id: "user_123",
    image: null,
    name: "Test User",
    updatedAt: new Date(),
  },
  customer: null,
  organizations: [
    {
      id: "test_org_123",
      name: "Test Organization",
      permissions: ["organization:all"],
      slug: "test-org",
    },
  ],
  projects: [
    {
      id: "test_proj_123",
      name: "Test Project",
      organizationId: "test_org_123",
      permissions: ["project:all"],
      slug: "test-project",
    },
  ],
  cookie: "mock-cookie",
  method: "user",
  ...overrides,
});

export const createMockSecretApiKeyAuthSession = (
  overrides: Partial<SecretKeySession> = {}
): SecretKeySession => ({
  name: "Test Secret Key",
  user: null,
  customer: null,
  organizations: [
    {
      id: "test_org_123",
      name: "Test Organization",
      permissions: ["organization:all"],
      slug: "test-org",
    },
  ],
  projects: [
    {
      id: "test_proj_123",
      name: "Test Project",
      organizationId: "test_org_123",
      permissions: ["project:all"],
      slug: "test-project",
    },
  ],
  cookie: null,
  method: "secret-key",
  ...overrides,
});
