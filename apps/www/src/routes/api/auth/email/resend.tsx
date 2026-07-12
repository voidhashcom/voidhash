import { createFileRoute } from "@tanstack/react-router";

import {
  authErrorResponse,
  createWorkosClient,
  findUserIdByEmail,
  getJsonBody,
  jsonResponse,
} from "@/features/auth/lib/workos-user-management.server";

type ResendVerificationBody = {
  email?: string;
  userId?: string;
};

export const Route = createFileRoute("/api/auth/email/resend")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await getJsonBody<ResendVerificationBody>(request);
        const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
        const providedUserId = typeof body.userId === "string" ? body.userId.trim() : "";

        try {
          const workos = createWorkosClient();
          const userId = providedUserId || (await findUserIdByEmail(workos, email));
          if (!userId) {
            return authErrorResponse("We could not find an account for that email.");
          }

          await workos.userManagement.sendVerificationEmail({ userId });
          return jsonResponse({ ok: true });
        } catch (error) {
          const status =
            typeof error === "object" && error !== null && "status" in error
              ? (error as { status?: unknown }).status
              : undefined;
          if (status === 429) {
            return authErrorResponse("Please wait a moment before requesting another code.", 429);
          }
          console.error("[auth] WorkOS resend verification email failed", error);
          return authErrorResponse("We could not send a new code. Please try again.");
        }
      },
    },
  },
});
