import { oauthProviderClient } from "@better-auth/oauth-provider/client";
import { STUDIO_DOMAIN } from "@voidhash/lib";
import {
  adminClient,
  apiKeyClient,
  organizationClient,
} from "better-auth/client/plugins";

/**
 * Replace localhost with the actual IP address if STUDIO_DOMAIN contains localhost.
 * This allows accessing the server from other devices on the same network.
 */
export const getAuthBaseURL = (): string => {
  if (
    STUDIO_DOMAIN.includes("localhost") &&
    typeof window !== "undefined" &&
    !window.location.hostname.includes("localhost")
  ) {
    const ip = window.location.hostname.split(":")[0] ?? "localhost";
    return STUDIO_DOMAIN.replace("localhost", ip);
  }
  return STUDIO_DOMAIN;
};

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

// export const authClient = createAuthClient(
//   createAuthClientOptions(getBaseURL())
// );
