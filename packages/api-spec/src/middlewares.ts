import { Schema } from "effect";
import { HttpApiMiddleware, HttpApiSecurity } from "effect/unstable/httpapi";

import { ApiAuthSession } from "./auth";
import { AuthenticationError, NotAuthenticatedError } from "./errors";

export class AuthMiddleware extends HttpApiMiddleware.Service<AuthMiddleware, { provides: ApiAuthSession }>()(
  "Http/AuthenticationMiddleware",
  {
    // Optionally define the error schema for the middleware
    error: Schema.Union([AuthenticationError, NotAuthenticatedError]),
    security: {
      apiKey: HttpApiSecurity.apiKey({
        in: "header",
        key: "x-api-key",
      }),
      betterAuthCookie: HttpApiSecurity.apiKey({
        in: "cookie",
        key: "__Secure-better-auth.session_token",
      }),
      publishableKey: HttpApiSecurity.apiKey({
        in: "header",
        key: "x-publishable-key",
      }),
      secretKey: HttpApiSecurity.apiKey({
        in: "header",
        key: "x-secret-key",
      }),
    },
  }
) {}
