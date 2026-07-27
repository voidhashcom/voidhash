import { createFileRoute } from "@tanstack/react-router";

import {
  authenticateWithOrganizationSelectionChallenge,
  authErrorResponse,
  createWorkosClient,
  findUserIdByEmail,
  getJsonBody,
  getSafeReturnPathname,
  getWorkosAuthConfig,
  jsonResponse,
  responseWithSession,
} from "@/features/auth/lib/workos-user-management.server";

type VerifyEmailBody = {
  code: string;
  email?: string;
  pendingAuthenticationToken?: string;
  returnPathname?: string;
};

export const Route = createFileRoute("/api/auth/email/verify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await getJsonBody<VerifyEmailBody>(request);
        const code = typeof body.code === "string" ? body.code.trim() : "";
        const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
        const pendingAuthenticationToken =
          typeof body.pendingAuthenticationToken === "string"
            ? body.pendingAuthenticationToken
            : "";
        const returnPathname = getSafeReturnPathname(request, body.returnPathname, "/studio");

        if (!code) {
          return authErrorResponse("Enter the verification code from your email.");
        }

        try {
          const { clientId, cookiePassword } = getWorkosAuthConfig();
          const workos = createWorkosClient();

          // Preferred path: the pending authentication token from the failed
          // sign-in/sign-up lets us verify the code AND seal a session in one
          // call, so the user lands logged in.
          if (pendingAuthenticationToken) {
            try {
              const authResponse = await workos.userManagement.authenticateWithEmailVerification({
                clientId,
                code,
                pendingAuthenticationToken,
                session: {
                  cookiePassword,
                  sealSession: true,
                },
              });

              return responseWithSession(authResponse, { redirectTo: returnPathname });
            } catch (authError) {
              const organizationSelectionAuthResponse =
                await authenticateWithOrganizationSelectionChallenge(workos, authError, {
                  clientId,
                  cookiePassword,
                });

              if (organizationSelectionAuthResponse) {
                return responseWithSession(organizationSelectionAuthResponse, {
                  redirectTo: returnPathname,
                });
              }

              throw authError;
            }
          }

          // Fallback (no pending token — e.g. the verify page was reopened cold):
          // verify the email by user id, then send the user to sign in.
          const userId = await findUserIdByEmail(workos, email);
          if (!userId) {
            return authErrorResponse("We could not find an account for that email.");
          }

          await workos.userManagement.verifyEmail({ code, userId });
          return jsonResponse({ verified: true });
        } catch (error) {
          console.error("[auth] WorkOS email verification failed", error);
          return authErrorResponse(
            "That code is invalid or has expired. Request a new code or sign in again.",
          );
        }
      },
    },
  },
});
