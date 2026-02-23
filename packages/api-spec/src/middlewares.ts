import { HttpApiMiddleware, HttpApiSecurity } from "@effect/platform";
import { Schema } from "effect";

import { ApiAuthSession } from "./auth";
import { AuthenticationError, NotAuthenticatedError } from "./errors";

export class AuthMiddleware extends HttpApiMiddleware.Tag<AuthMiddleware>()(
  "Http/AuthenticationMiddleware",
  {
    // Optionally define the error schema for the middleware
    failure: Schema.Union(AuthenticationError, NotAuthenticatedError),
    provides: ApiAuthSession,
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
