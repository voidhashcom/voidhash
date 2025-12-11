// import { createBetterAuthOptions } from '@voidhash/auth';
// import { db } from '@voidhash/db';
// import { betterAuth } from 'better-auth';

// export const auth = betterAuth(createBetterAuthOptions(db, 'tanstack-start'));

import { db } from '@voidhash/db';
import * as schema from '@voidhash/db/schema';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import {
  admin,
  apiKey,
  type Client,
  jwt,
  oidcProvider,
  organization
} from 'better-auth/plugins';
import { tanstackStartCookies } from 'better-auth/tanstack-start';
import { env } from './env';

export const TRUSTED_CLIENTS: Client[] = [
  {
    clientId: env.VOIDHASH_STUDIO_CLIENT_ID,
    clientSecret: env.VOIDHASH_STUDIO_CLIENT_SECRET,
    name: 'Voidhash Studio',
    type: 'web',
    redirectUrls: [env.VOIDHASH_STUDIO_REDIRECT_URL],
    disabled: false,
    skipConsent: true, // Skip consent for this trusted client
    metadata: { internal: true }
  },
  {
    clientId: env.VOIDHASH_MOBILE_CLIENT_ID,
    clientSecret: env.VOIDHASH_MOBILE_CLIENT_SECRET,
    name: 'Voidhash Mobile',
    type: 'native',
    redirectUrls: [
      // Production - custom scheme
      'voidhash://auth/callback',
      // Development - custom scheme with path
      ...(process.env.NEXT_PUBLIC_VERCEL_ENV === 'development'
        ? [
            'http://localhost:8081/auth/callback',
            'voidhash-dev://auth/callback'
          ]
        : [])
    ],
    disabled: false,
    skipConsent: true,
    metadata: { internal: true }
  }
] as const;

export const auth = betterAuth({
  baseURL: env.VITE_APP_AUTH_BASE_URL,
  basePath: '/auth/api/auth',
  disabledPaths: ['/token'],
  database: drizzleAdapter(db, {
    provider: 'mysql',
    schema
  }),
  session: {
    expiresIn: 8 * 60 * 60, // 8 hours
    updateAge: 30 * 24 * 60 * 60 // 30 days
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string
    }
  },
  emailAndPassword: {
    enabled: true
  },
  advanced: {
    cookies: {
      session_token: {
        name: 'voidhash_auth_session_token'
      }
    }
  },
  plugins: [
    jwt({
      disableSettingJwtHeader: true
    }),
    organization(),
    apiKey({
      rateLimit: {
        enabled: false
      }
    }),
    admin(),
    oidcProvider({
      loginPage: '/auth/login',
      useJWTPlugin: true,
      consentPage: '/auth/consent',
      trustedClients: TRUSTED_CLIENTS
    }),
    tanstackStartCookies()
  ]
});
