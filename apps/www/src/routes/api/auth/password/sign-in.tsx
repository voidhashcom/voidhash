import { createFileRoute } from "@tanstack/react-router";

import {
  authenticateWithOrganizationSelectionChallenge,
  authErrorResponse,
  createWorkosClient,
  getEmailVerificationChallenge,
  getJsonBody,
  getSafeReturnPathname,
  getWorkosAuthConfig,
  jsonResponse,
  responseWithSession,
} from "@/features/auth/lib/workos-user-management.server";

type SignInBody = {
  email: string;
  password: string;
  returnPathname?: string;
};

export const Route = createFileRoute("/api/auth/password/sign-in")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await getJsonBody<SignInBody>(request);
        const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
        const password = typeof body.password === "string" ? body.password : "";
        const returnPathname = getSafeReturnPathname(request, body.returnPathname, "/studio");

        if (!(email && password)) {
          return authErrorResponse("Enter your email and password.");
        }

        try {
          const { clientId, cookiePassword } = getWorkosAuthConfig();
          const workos = createWorkosClient();
          const authResponse = await workos.userManagement.authenticateWithPassword({
            clientId,
            email,
            password,
            session: {
              cookiePassword,
              sealSession: true,
            },
          });

          return responseWithSession(authResponse, { redirectTo: returnPathname });
        } catch (error) {
          // An unverified account can't sign in yet. WorkOS sends a fresh 6-digit
          // code on this attempt, so we hand the challenge back and let the
          // verify-email page take over (this also handles users who closed the
          // page mid sign-up and simply log in again).
          const challenge = getEmailVerificationChallenge(error);
          if (challenge) {
            return jsonResponse({
              email: challenge.email ?? email,
              emailVerificationRequired: true,
              pendingAuthenticationToken: challenge.pendingAuthenticationToken,
              userId: challenge.userId,
            });
          }

          const authResponse = await (async () => {
            try {
              const { clientId, cookiePassword } = getWorkosAuthConfig();
              const workos = createWorkosClient();
              return await authenticateWithOrganizationSelectionChallenge(workos, error, {
                clientId,
                cookiePassword,
              });
            } catch (selectionError) {
              console.error("[auth] WorkOS password organization selection failed", selectionError);
              return null;
            }
          })();

          if (authResponse) {
            return responseWithSession(authResponse, { redirectTo: returnPathname });
          }

          console.error("[auth] WorkOS password sign-in failed", error);
          return authErrorResponse("We could not sign you in with those credentials.", 401);
        }
      },
    },
  },
});
