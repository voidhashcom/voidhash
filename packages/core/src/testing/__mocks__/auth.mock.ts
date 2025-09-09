import { Environment } from '@voidhash/lib/constants';
import type {
  SecretKeySession,
  UserSession
} from '../../services/auth-service';

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
  overrides: Partial<SecretKeySession> = {}
): SecretKeySession => ({
  name: 'Test Secret Key',
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
  method: 'secret-key',
  ...overrides
});
