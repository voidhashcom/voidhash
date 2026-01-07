// import { createBetterAuthOptions } from '@voidhash/auth';
// import { db } from '@voidhash/db';
// import { betterAuth } from 'better-auth';

// export const auth = betterAuth(createBetterAuthOptions(db, 'tanstack-start'));

import { betterAuth } from 'better-auth';
import { genericOAuth } from 'better-auth/plugins';
import { tanstackStartCookies } from 'better-auth/tanstack-start';
import { env } from './env';

export const auth = betterAuth({
  baseURL: env.VITE_APP_STUDIO_BASE_URL,
  basePath: '/studio/api/auth',
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 7 * 24 * 60 * 60, // 7 days cache duration
      strategy: 'jwe', // can be "jwt" or "compact"
      refreshCache: true // Enable stateless refresh
    }
  },
  account: {
    storeStateStrategy: 'cookie',
    storeAccountCookie: true,
    accountLinking: {
      enabled: true,
      allowDifferentEmails: false,
      trustedProviders: ['voidhash-auth']
    }
  },
  // trustedOrigins: [env.VITE_APP_AUTH_BASE_URL],
  // advanced: {
  //   crossSubDomainCookies: {
  //     enabled: true
  //   }
  // },
  plugins: [
    genericOAuth({
      config: [
        {
          providerId: 'voidhash-auth',
          clientId: env.VOIDHASH_AUTH_CLIENT_ID,
          clientSecret: env.VOIDHASH_AUTH_CLIENT_SECRET,
          discoveryUrl: `${env.VITE_APP_AUTH_BASE_URL}/auth/.well-known/openid-configuration`,
          scopes: ['openid', 'email', 'profile'],
          pkce: true
        }
      ]
    }),
    tanstackStartCookies()
  ]
});
