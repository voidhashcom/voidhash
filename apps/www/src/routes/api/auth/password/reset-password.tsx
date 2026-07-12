import { createFileRoute } from "@tanstack/react-router";

import {
  authErrorResponse,
  createWorkosClient,
  getJsonBody,
  jsonResponse,
} from "@/features/auth/lib/workos-user-management.server";

type ResetPasswordBody = {
  password: string;
  token: string;
};

export const Route = createFileRoute("/api/auth/password/reset-password")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await getJsonBody<ResetPasswordBody>(request);
        const token = typeof body.token === "string" ? body.token.trim() : "";
        const password = typeof body.password === "string" ? body.password : "";

        if (!(token && password)) {
          return authErrorResponse("Enter a new password from a valid reset link.");
        }

        try {
          const workos = createWorkosClient();
          await workos.userManagement.resetPassword({
            newPassword: password,
            token,
          });

          return jsonResponse({ redirectTo: "/auth/login?reset=success" });
        } catch (error) {
          console.error("[auth] WorkOS password reset failed", error);
          return authErrorResponse("That reset link is invalid or expired.", 400);
        }
      },
    },
  },
});
