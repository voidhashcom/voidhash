import { HttpApiBuilder } from "@effect/platform";
import { VoidhashV1Api } from "@voidhash/api-spec";
import { UserService } from "@voidhash/core/services";
import { Effect } from "effect";

export const UsersGroupLive = HttpApiBuilder.group(
  VoidhashV1Api,
  "users",
  (handlers) =>
    Effect.gen(function* UsersGroupLive() {
      const userService = yield* UserService;
      return handlers.handle("getUser", () =>
        Effect.gen(function* UsersGroupLive() {
          return yield* userService.getUser();
        })
      );
    })
);
