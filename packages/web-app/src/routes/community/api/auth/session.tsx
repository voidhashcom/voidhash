import { createFileRoute } from "@tanstack/react-router";

import { jsonResponse } from "@/features/auth/lib/http";
import { readStandaloneSession } from "@/features/auth/lib/standalone-session";

/**
 * Returns the current session, including its raw token so the browser can
 * re-seed its bearer-token provider after a reload without making the cookie
 * readable from script.
 */
export const Route = createFileRoute("/api/auth/session")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await readStandaloneSession(request);
        return jsonResponse(
          session === null
            ? { accessToken: null, user: null }
            : { accessToken: session.token, user: session.user },
        );
      },
    },
  },
});
