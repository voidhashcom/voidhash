import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import { ApiActionForbiddenError } from "../errors/index.ts";
import { AuthMiddleware } from "../Middlewares.ts";
import { Session } from "../Schema.ts";

export const AuthGroup = HttpApiGroup.make("auth")
  .add(
    HttpApiEndpoint.get("session", "/session", {
      success: Session,
      error: [ApiActionForbiddenError],
    }).middleware(AuthMiddleware),
  )
  .prefix("/auth");
