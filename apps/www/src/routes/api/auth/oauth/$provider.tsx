import { createFileRoute } from "@tanstack/react-router";

import {
  createWorkosClient,
  getProviderForSlug,
  getSafeReturnPathnameFromRequest,
  getWorkosAuthConfig,
  jsonResponse,
} from "@/features/auth/lib/workos-user-management.server";

const oauthStateCookieName = "vh-oauth-state";

export const Route = createFileRoute("/api/auth/oauth/$provider")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const provider = getProviderForSlug(params.provider);

        if (!provider) {
          return jsonResponse({ error: "Unsupported OAuth provider." }, { status: 404 });
        }

        const url = new URL(request.url);
        const state = crypto.randomUUID();
        const returnPathname = getSafeReturnPathnameFromRequest(request, "/studio");
        const { clientId } = getWorkosAuthConfig();
        const workos = createWorkosClient();
        const location = workos.userManagement.getAuthorizationUrl({
          clientId,
          provider,
          redirectUri: `${url.origin}/api/auth/oauth/callback`,
          state,
        });

        const cookieValue = encodeURIComponent(JSON.stringify({ returnPathname, state }));
        const secure = url.protocol === "https:" ? "; Secure" : "";

        return new Response(null, {
          headers: {
            Location: location,
            "Set-Cookie": `${oauthStateCookieName}=${cookieValue}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${secure}`,
          },
          status: 307,
        });
      },
    },
  },
});
