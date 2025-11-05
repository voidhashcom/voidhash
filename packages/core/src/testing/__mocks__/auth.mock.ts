import type { SecretKeySession, UserSession } from '@voidhash/shared';

export const createMockUserAuthSession = (
  overrides: Partial<UserSession> = {}
): UserSession => ({
  name: 'Test User <test@example.com>',
  user: {
    id: 'user_123',
    email: 'test@example.com',
    name: 'Test User',
    image: null,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  customer: null,
  organizations: [
    {
      id: 'test_org_123',
      slug: 'test-org',
      name: 'Test Organization',
      permissions: ['organization:all']
    }
  ],
  projects: [
    {
      id: 'test_proj_123',
      slug: 'test-project',
      organizationId: 'test_org_123',
      name: 'Test Project',
      permissions: ['project:all']
    }
  ],
  cookie: 'mock-cookie',
  method: 'user',
  ...overrides
});

export const createMockSecretApiKeyAuthSession = (
  overrides: Partial<SecretKeySession> = {}
): SecretKeySession => ({
  name: 'Test Secret Key',
  user: null,
  customer: null,
  organizations: [
    {
      id: 'test_org_123',
      slug: 'test-org',
      name: 'Test Organization',
      permissions: ['organization:all']
    }
  ],
  projects: [
    {
      id: 'test_proj_123',
      slug: 'test-project',
      organizationId: 'test_org_123',
      name: 'Test Project',
      permissions: ['project:all']
    }
  ],
  cookie: null,
  method: 'secret-key',
  ...overrides
});
