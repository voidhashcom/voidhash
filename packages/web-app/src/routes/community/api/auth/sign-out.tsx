import { createFileRoute } from "@tanstack/react-router";

import { jsonResponse } from "@/features/auth/lib/http";
import { clearedStandaloneSessionCookie } from "@/features/auth/lib/standalone-session";

/** Clears the standalone session cookie. */
export const Route = createFileRoute("/api/auth/sign-out")({
  server: {
    handlers: {
      POST: async () =>
        jsonResponse(
          { ok: true },
          { status: 200 },
          {
            "Set-Cookie": clearedStandaloneSessionCookie(),
          },
        ),
    },
  },
});
