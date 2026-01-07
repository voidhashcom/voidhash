import { createAuthClient } from "better-auth/client";
import { genericOAuthClient } from "better-auth/client/plugins";

import { env } from "./env";

export const createAuthClientOptions = (baseURL: string) => ({
  basePath: "/studio/api/auth",
  baseURL,
  plugins: [genericOAuthClient()],
});

export const authClient = createAuthClient(
  createAuthClientOptions(env.VITE_APP_STUDIO_BASE_URL)
);
