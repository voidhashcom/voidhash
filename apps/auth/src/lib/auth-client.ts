import { oauthProviderClient } from "@better-auth/oauth-provider/client";
import {
  adminClient,
  apiKeyClient,
  organizationClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { env } from "./env";

export const createAuthClientOptions = (baseURL: string) => ({
  basePath: "/auth/api/auth",
  baseURL,
  plugins: [
    organizationClient(),
    apiKeyClient(),
    adminClient(),
    oauthProviderClient(),
  ],
});

export const authClient = createAuthClient(
  createAuthClientOptions(env.VITE_APP_AUTH_BASE_URL)
);
