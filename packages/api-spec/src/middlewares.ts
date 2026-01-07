import { HttpApiMiddleware, HttpApiSecurity } from "@effect/platform";
import {
  AuthSession,
  AuthenticationError,
  NotAuthenticatedError,
} from "@voidhash/shared";
import { Schema } from "effect";

export class AuthMiddleware extends HttpApiMiddleware.Tag<AuthMiddleware>()(
  "Http/AuthenticationMiddleware",
  {
    // Optionally define the error schema for the middleware
    failure: Schema.Union(AuthenticationError, NotAuthenticatedError),
    provides: AuthSession,
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
