import { createFileRoute } from "@tanstack/react-router";

import {
  authenticateWithOrganizationSelectionChallenge,
  createWorkosClient,
  getWorkosAuthConfig,
  redirectWithSession,
} from "@/features/auth/lib/workos-user-management.server";

const oauthStateCookieName = "vh-oauth-state";

const getCookieValue = (request: Request, name: string) => {
  const cookie = request.headers.get("cookie");
  if (!cookie) {
    return undefined;
  }

  return cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
};

const getStoredOAuthState = (request: Request) => {
  const value = getCookieValue(request, oauthStateCookieName);
  if (!value) {
    return undefined;
  }

  try {
    return JSON.parse(decodeURIComponent(value)) as {
      returnPathname?: string;
      state?: string;
    };
  } catch {
    return undefined;
  }
};

const redirectToLogin = (request: Request) => {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return new Response(null, {
    headers: {
      Location: "/auth/login?error=oauth_failed",
      "Set-Cookie": `${oauthStateCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
    },
    status: 303,
  });
};

export const Route = createFileRoute("/api/auth/oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const storedState = getStoredOAuthState(request);
        const returnPathname = storedState?.returnPathname ?? "/studio";

        if (!(code && state && storedState?.state === state)) {
          return redirectToLogin(request);
        }

        try {
          const { clientId, cookiePassword } = getWorkosAuthConfig();
          const workos = createWorkosClient();
          const authResponse = await workos.userManagement.authenticateWithCode({
            clientId,
            code,
            session: {
              cookiePassword,
              sealSession: true,
            },
          });

          const response = await redirectWithSession(authResponse, returnPathname);
          const secure = url.protocol === "https:" ? "; Secure" : "";
          response.headers.append(
            "Set-Cookie",
            `${oauthStateCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
          );
          return response;
        } catch (error) {
          try {
            const { clientId, cookiePassword } = getWorkosAuthConfig();
            const workos = createWorkosClient();
            const authResponse = await authenticateWithOrganizationSelectionChallenge(
              workos,
              error,
              {
                clientId,
                cookiePassword,
              },
            );

            if (authResponse) {
              const response = await redirectWithSession(authResponse, returnPathname);
              const secure = url.protocol === "https:" ? "; Secure" : "";
              response.headers.append(
                "Set-Cookie",
                `${oauthStateCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
              );
              return response;
            }
          } catch (selectionError) {
            console.error("[auth] WorkOS OAuth organization selection failed", selectionError);
          }

          console.error("[auth] WorkOS OAuth callback failed", error);
          return redirectToLogin(request);
        }
      },
    },
  },
});
