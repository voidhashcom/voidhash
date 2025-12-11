import {
  adminClient,
  apiKeyClient,
  oidcClient,
  organizationClient
} from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import { env } from './env';

export const createAuthClientOptions = (baseURL: string) => ({
  baseURL,
  basePath: '/auth/api/auth',
  plugins: [organizationClient(), apiKeyClient(), adminClient(), oidcClient()]
});

export const authClient = createAuthClient(
  createAuthClientOptions(env.VITE_APP_AUTH_BASE_URL)
);
