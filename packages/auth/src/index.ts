import { oauthProvider } from '@better-auth/oauth-provider';
import { type Database, db } from '@voidhash/db';
import * as schema from '@voidhash/db/schema';
import {
  API_DOMAIN,
  APP_DOMAIN,
  AUTH_DOMAIN,
  DOCS_DOMAIN,
  STUDIO_DOMAIN,
  WWW_DOMAIN
} from '@voidhash/lib';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { admin, apiKey, jwt, organization } from 'better-auth/plugins';
import { tanstackStartCookies } from 'better-auth/tanstack-start';

// Mobile app OAuth client configuration
const MOBILE_CLIENT_ID = 'voidhash-mobile-app';
const MOBILE_CLIENT_SECRET = 'voidhash-mobile-secret';

const trustedOrigins = [
  // All domains our apps
  WWW_DOMAIN,
  STUDIO_DOMAIN,
  API_DOMAIN,
  DOCS_DOMAIN,
  AUTH_DOMAIN,
  // Vercel Mobile Web App
  ...(process.env.NEXT_PUBLIC_VERCEL_ENV === 'development'
    ? ['localhost:8081']
    : [])
];

// Set of trusted client IDs for caching
const CACHED_TRUSTED_CLIENT_IDS = new Set([MOBILE_CLIENT_ID]);

export const createBetterAuthOptions = (
  db: Database,
  framework: 'next' | 'tanstack-start'
) => ({
  baseURL: STUDIO_DOMAIN,
  database: drizzleAdapter(db, {
    provider: 'mysql',
    schema
  }),
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
    crossSubDomainCookies: {
      enabled: process.env.NODE_ENV === 'production',
      domain: `.${APP_DOMAIN}`
    }
  },
  trustedOrigins,

  plugins: [
    jwt(),
    organization(),
    apiKey({
      rateLimit: {
        enabled: false
      }
    }),
    admin({
      adminUserIds: process.env.ADMIN_USER_IDS?.split(',').filter(Boolean) ?? []
    }),
    oauthProvider({
      loginPage: '/auth/login',
      consentPage: '/auth/oauth/consent',
      scopes: ['openid', 'profile', 'email', 'offline_access'],
      cachedTrustedClients: CACHED_TRUSTED_CLIENT_IDS
    }),
    framework === 'next' ? nextCookies() : tanstackStartCookies()
  ]
});

export const createBetterAuth = (db: Database) =>
  betterAuth(createBetterAuthOptions(db, 'next'));

export { MOBILE_CLIENT_ID, MOBILE_CLIENT_SECRET };

export const auth = createBetterAuth(db);
