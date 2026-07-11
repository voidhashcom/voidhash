import { Schema } from "effect";
import { HttpApiMiddleware } from "effect/unstable/httpapi";

import { ApiAuthSession } from "./Auth.ts";
import { ApiAuthenticationError, ApiNotAuthenticatedError } from "./errors/index.ts";

export class AuthMiddleware extends HttpApiMiddleware.Service<
  AuthMiddleware,
  { provides: ApiAuthSession }
>()("Http/AuthenticationMiddleware", {
  error: Schema.Union([ApiAuthenticationError, ApiNotAuthenticatedError]),
}) {}
