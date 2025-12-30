import { oauthProvider } from '@better-auth/oauth-provider';
import { db } from '@voidhash/db';
import * as schema from '@voidhash/db/schema';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin, apiKey, jwt, organization } from 'better-auth/plugins';
import { tanstackStartCookies } from 'better-auth/tanstack-start';
import { env } from './env';

// Trusted client configuration for programmatic sync
// These will be created/updated in the database via syncTrustedClients
export interface TrustedClientConfig {
  clientId: string;
  clientSecret: string;
  name: string;
  type: 'web' | 'native' | 'user-agent-based';
  redirectUris: string[];
  disabled: boolean;
  skipConsent: boolean;
  metadata?: Record<string, unknown>;
}

export const TRUSTED_CLIENTS: TrustedClientConfig[] = [
  {
    clientId: env.VOIDHASH_STUDIO_CLIENT_ID,
    clientSecret: env.VOIDHASH_STUDIO_CLIENT_SECRET,
    name: 'Voidhash Studio',
    type: 'web',
    redirectUris: [env.VOIDHASH_STUDIO_REDIRECT_URL],
    disabled: false,
    skipConsent: true,
    metadata: { internal: true }
  },
  {
    clientId: env.VOIDHASH_MOBILE_CLIENT_ID,
    clientSecret: env.VOIDHASH_MOBILE_CLIENT_SECRET,
    name: 'Voidhash Mobile',
    type: 'native',
    redirectUris: [
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
];

// Set of trusted client IDs for caching
export const CACHED_TRUSTED_CLIENT_IDS = new Set(
  TRUSTED_CLIENTS.map((c) => c.clientId)
);

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
    jwt(),
    organization(),
    apiKey({
      rateLimit: {
        enabled: false
      }
    }),
    admin(),
    oauthProvider({
      loginPage: '/login',
      consentPage: '/oauth/consent',
      scopes: ['openid', 'profile', 'email', 'offline_access'],
      cachedTrustedClients: CACHED_TRUSTED_CLIENT_IDS
    }),
    tanstackStartCookies()
  ]
});
