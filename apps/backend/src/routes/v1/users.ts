import { User, VoidhashV1Api } from "@voidhash/api-contracts";
import { ApiAuthenticationError } from "@voidhash/api-contracts/errors";
import { UserService } from "@voidhash/core/services";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { bridgeAuthSession } from "../../ApiMiddlewares.ts";

export const UsersGroupLive = HttpApiBuilder.group(VoidhashV1Api, "users", (handlers) =>
  Effect.gen(function* () {
    const userService = yield* UserService;
    return handlers.handle("getUser", () =>
      bridgeAuthSession(userService.getUser().pipe(Effect.map((user) => new User(user)))).pipe(
        Effect.catchTags({
          AuthenticationError: (e) =>
            Effect.fail(new ApiAuthenticationError({ cause: e.cause, message: e.message })),
        }),
      ),
    );
  }),
);
