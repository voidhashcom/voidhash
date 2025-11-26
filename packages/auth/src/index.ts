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
import { apiKey, organization } from 'better-auth/plugins';

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
    trustedOrigins: [WWW_DOMAIN, STUDIO_DOMAIN, API_DOMAIN, DOCS_DOMAIN],
    plugins: [
      organization(),
      apiKey({
        enableSessionForAPIKeys: true,
        rateLimit: {
          enabled: false
        }
      }),
      nextCookies()
    ]
  });

export const auth = createBetterAuth(db);

// export const auth = betterAuth({
//   baseURL: APP_DOMAIN,
//   database: drizzleAdapter(db, {
//     provider: 'mysql',
//     schema
//   }),
//   socialProviders: {
//     github: {
//       clientId: process.env.GITHUB_CLIENT_ID as string,
//       clientSecret: process.env.GITHUB_CLIENT_SECRET as string
//     }
//   },
//   emailAndPassword: {
//     enabled: true
//   },
//   plugins: [organization(), apiKey(), nextCookies()]
// });
