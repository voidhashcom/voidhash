import { Effect } from "effect";

import { getUser } from "./get-user";

export class UserService extends Effect.Service<UserService>()("UserService", {
  dependencies: [],
  effect: Effect.gen(function* effect() {
    return {
      getUser: yield* getUser,
    } as const;
  }),
}) {}
