import { type Database, db } from '@voidhash/db';
import * as schema from '@voidhash/db/schema';
import {
  API_DOMAIN,
  APP_DOMAIN,
  DOCS_DOMAIN,
  STUDIO_DOMAIN,
  WWW_DOMAIN
} from '@voidhash/lib';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { apiKey, oidcProvider, organization } from 'better-auth/plugins';

// Mobile app OIDC client configuration
const MOBILE_CLIENT_ID = 'voidhash-mobile-app';
const MOBILE_CLIENT_SECRET = 'voidhash-mobile-secret';

const trustedOrigins = [
  // All domains our apps
  WWW_DOMAIN,
  STUDIO_DOMAIN,
  API_DOMAIN,
  DOCS_DOMAIN,
  // Vercel Mobile Web App
  ...(process.env.NEXT_PUBLIC_VERCEL_ENV === 'development'
    ? ['localhost:8081']
    : [])
];

export const createBetterAuth = (db: Database) =>
  betterAuth({
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
      organization(),
      apiKey({
        rateLimit: {
          enabled: false
        }
      }),
      oidcProvider({
        loginPage: '/studio/login',
        consentPage: '/studio/auth/consent',
        trustedClients: [
          {
            clientId: MOBILE_CLIENT_ID,
            clientSecret: MOBILE_CLIENT_SECRET,
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
        ]
      }),
      nextCookies()
    ]
  });

export { MOBILE_CLIENT_ID, MOBILE_CLIENT_SECRET };

export const auth = createBetterAuth(db);
