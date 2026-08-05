import { createFileRoute } from "@tanstack/react-router";

import {
  authErrorResponse,
  getJsonBody,
  getSafeReturnPathname,
  jsonResponse,
} from "@/features/auth/lib/http";
import {
  mintStandaloneSessionToken,
  standaloneSessionCookie,
  verifyRootCredentials,
} from "@/features/auth/lib/standalone-session";

type SignInBody = {
  username: string;
  password: string;
  returnPathname?: string;
};

/**
 * Consecutive failures per source address, with a fixed backoff once the
 * threshold is crossed. In-process state is correct here because the self-host
 * runtime serves the dashboard from a single Node process; a multi-process
 * composition would need to move this to shared storage.
 */
const FAILURE_THRESHOLD = 5;
const LOCKOUT_MS = 30_000;
const attempts = new Map<string, { failures: number; blockedUntil: number }>();

const clientKey = (request: Request): string =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  request.headers.get("cf-connecting-ip") ||
  "unknown";

const recordFailure = (key: string) => {
  const entry = attempts.get(key) ?? { blockedUntil: 0, failures: 0 };
  entry.failures += 1;
  if (entry.failures >= FAILURE_THRESHOLD) {
    entry.blockedUntil = Date.now() + LOCKOUT_MS;
    entry.failures = 0;
  }
  attempts.set(key, entry);
};

/**
 * Standalone sign-in: verifies the root credentials configured for this
 * deployment and mints the session token.
 *
 * The token is returned in the body as well as the cookie so a split-origin dev
 * setup (dashboard and API on different ports) can send it as a bearer.
 */
export const Route = createFileRoute("/api/auth/sign-in")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = clientKey(request);
        const entry = attempts.get(key);
        if (entry && entry.blockedUntil > Date.now()) {
          return authErrorResponse("Too many attempts. Try again shortly.", 429);
        }

        const body = await getJsonBody<SignInBody>(request);
        const username = typeof body.username === "string" ? body.username : "";
        const password = typeof body.password === "string" ? body.password : "";
        const returnPathname = getSafeReturnPathname(request, body.returnPathname, "/studio");

        if (!(await verifyRootCredentials({ password, username }))) {
          recordFailure(key);
          // Deliberately does not say which field was wrong.
          return authErrorResponse("Incorrect username or password.", 401);
        }

        attempts.delete(key);
        const token = await mintStandaloneSessionToken();

        return jsonResponse(
          { accessToken: token, redirectTo: returnPathname },
          { status: 200 },
          { "Set-Cookie": standaloneSessionCookie(token, request) },
        );
      },
    },
  },
});
