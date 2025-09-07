import { Environment } from '@voidhash/lib/constants';
import type { ApiKeySession, UserSession } from '@/lib/services/auth.service';

export const createMockUserAuthSession = (
  overrides: Partial<UserSession> = {}
): UserSession => ({
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
      permissions: ['organization:all']
    }
  ],
  projects: [
    {
      id: 'test_proj_123',
      slug: 'test-project',
      organizationId: 'test_org_123',
      permissions: ['project:all']
    }
  ],
  environment: null,
  method: 'user',
  ...overrides
});

export const createMockSecretApiKeyAuthSession = (
  overrides: Partial<ApiKeySession> = {}
): ApiKeySession => ({
  user: null,
  customer: null,
  organizations: [
    {
      id: 'test_org_123',
      slug: 'test-org',
      permissions: ['organization:all']
    }
  ],
  projects: [
    {
      id: 'test_proj_123',
      slug: 'test-project',
      organizationId: 'test_org_123',
      permissions: ['project:all']
    }
  ],
  environment: Environment.Production,
  method: 'api-key',
  ...overrides
});
