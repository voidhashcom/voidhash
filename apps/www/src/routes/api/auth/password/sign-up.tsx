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

type SignUpBody = {
  email: string;
  firstName?: string;
  lastName?: string;
  password: string;
  returnPathname?: string;
};

export const Route = createFileRoute("/api/auth/password/sign-up")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await getJsonBody<SignUpBody>(request);
        const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
        const password = typeof body.password === "string" ? body.password : "";
        const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
        const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
        const returnPathname = getSafeReturnPathname(request, body.returnPathname, "/studio");

        if (!(email && password)) {
          return authErrorResponse("Enter your email and password.");
        }

        try {
          const { clientId, cookiePassword } = getWorkosAuthConfig();
          const workos = createWorkosClient();

          await workos.userManagement.createUser({
            email,
            firstName: firstName || undefined,
            lastName: lastName || undefined,
            password,
          });

          // The account now exists. Try to start a session immediately; if the
          // WorkOS environment requires email verification, this step throws and
          // we surface a "verify your email" state instead of a generic failure.
          try {
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
          } catch (authError) {
            const challenge = getEmailVerificationChallenge(authError);
            if (challenge) {
              // Account created and WorkOS sent a 6-digit verification code. We
              // hand the pending token + user id to the client so the
              // verify-email page can complete verification and start a session.
              return jsonResponse({
                email: challenge.email ?? email,
                emailVerificationRequired: true,
                pendingAuthenticationToken: challenge.pendingAuthenticationToken,
                userId: challenge.userId,
              });
            }

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
        } catch (error) {
          console.error("[auth] WorkOS password sign-up failed", error);
          return authErrorResponse("We could not create an account with those details.");
        }
      },
    },
  },
});
