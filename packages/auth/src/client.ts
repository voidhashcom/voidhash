import { APP_DOMAIN } from '@voidhash/lib';
import { apiKeyClient, organizationClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: APP_DOMAIN,
  plugins: [organizationClient(), apiKeyClient()]
});
