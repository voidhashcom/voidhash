import { STUDIO_DOMAIN } from '@voidhash/lib';
import { apiKeyClient, organizationClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: `${STUDIO_DOMAIN}`,
  basePath: '/studio/api/auth',
  plugins: [organizationClient(), apiKeyClient()]
});
