import { createFileRoute } from "@tanstack/react-router";

import {
  authErrorResponse,
  createWorkosClient,
  getJsonBody,
  jsonResponse,
} from "@/features/auth/lib/workos-user-management.server";

type ForgotPasswordBody = {
  email: string;
};

export const Route = createFileRoute("/api/auth/password/forgot-password")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await getJsonBody<ForgotPasswordBody>(request);
        const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

        if (!email) {
          return authErrorResponse("Enter your email address.");
        }

        try {
          const workos = createWorkosClient();
          await workos.userManagement.createPasswordReset({ email });
        } catch (error) {
          console.error("[auth] WorkOS password reset creation failed", error);
        }

        return jsonResponse({
          ok: true,
          message: "If an account exists for that email, a reset link will be sent.",
        });
      },
    },
  },
});
