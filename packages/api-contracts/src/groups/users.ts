import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import { ApiAuthenticationError } from "../errors/index.ts";
import { AuthMiddleware } from "../Middlewares.ts";
import { User } from "../Schema.ts";

export const UsersGroup = HttpApiGroup.make("users")
  /**
   * Returns the user behind the credential. Every failure here is an
   * authentication failure — an unknown or non-user credential — so the union
   * carries nothing else.
   *
   * Credential: user.
   */
  .add(
    HttpApiEndpoint.get("getUser", "/current", {
      success: User,
      error: [ApiAuthenticationError],
    }),
  )
  .middleware(AuthMiddleware)
  .prefix("/users");
