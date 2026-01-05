import { oauthProviderResourceClient } from '@better-auth/oauth-provider/resource-client';
import { db } from '@voidhash/db';
import { createAuthClient } from 'better-auth/client';
import { createBetterAuth } from './auth';

export const serverClient = createAuthClient({
  plugins: [oauthProviderResourceClient(createBetterAuth(db))] // auth optional
});
