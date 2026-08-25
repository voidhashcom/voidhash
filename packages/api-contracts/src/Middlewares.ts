import { HttpApiMiddleware } from "effect/unstable/httpapi";

import { ApiAuthSession } from "./Auth.ts";
import {
  ApiAuthenticationError,
  ApiAuthServiceError,
  ApiNotAuthenticatedError,
} from "./errors/index.ts";

export class AuthMiddleware extends HttpApiMiddleware.Service<
  AuthMiddleware,
  { provides: ApiAuthSession }
>()("Http/AuthenticationMiddleware", {
  error: [ApiAuthenticationError, ApiAuthServiceError, ApiNotAuthenticatedError],
}) {}
