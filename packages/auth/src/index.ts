import { oauthProvider } from "@better-auth/oauth-provider";
import type { Database } from "@voidhash/db";
import * as schema from "@voidhash/db/schema";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, apiKey, jwt, organization } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import type { Resend } from "resend";

/**
 * Creates a betterAuth instance with the provided database.
 * Use this factory function when you need to inject a custom database instance.
 */
export const createBetterAuthOptions = ({
  db,
  baseURL,
  trustedClientIds,
}: {
  db: Database;
  baseURL: string;
  trustedClientIds: Set<string>;
  resend?: Resend;
  emailFrom?: string;
}) => ({
  advanced: {
    cookies: {
      session_token: {
        name: "voidhash_auth_session_token",
      },
    },
  },
  basePath: "/auth/api/auth",
  baseURL,
  database: drizzleAdapter(db, {
    provider: "mysql",
    schema,
  }),
  disabledPaths: ["/token"],

  plugins: [
    jwt(),
    organization(),
    apiKey({
      enableSessionForAPIKeys: true,
      rateLimit: {
        enabled: false,
      },
    }),
    admin(),
    oauthProvider({
      cachedTrustedClients: trustedClientIds,
      consentPage: "/auth/oauth/consent",
      loginPage: "/auth/login",
      scopes: ["openid", "profile", "email", "offline_access"],
    }),
    tanstackStartCookies(),
  ],
  session: {
    expiresIn: 8 * 60 * 60, // 8 hours
    updateAge: 30 * 24 * 60 * 60, // 30 days,
    storeSessionInDatabase: true,
  },
});
