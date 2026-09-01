import * as Effect from "effect/Effect";
import { CurrentUser, ForbiddenError, UsersRpcs } from "@voidhash/mimic-server/rpc";

import { HostServiceTag } from "../../app/hostService.ts";

const requireSuperuser = (user: { isSuperuser: boolean }, action: string) => {
  if (user.isSuperuser) return Effect.void;
  return Effect.fail(
    new ForbiddenError({
      code: "forbidden",
      message: `Superuser permission required for ${action}`,
    }),
  );
};

export const UsersHandlersLive = UsersRpcs.toLayer(
  Effect.gen(function* () {
    const host = yield* HostServiceTag;
    return {
      CreateUser: ({ username, password }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireSuperuser(user, "create user");
          const created = yield* host.createUser(username, password);
          return { id: created.id, username: created.username };
        }),
      ListUsers: () =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireSuperuser(user, "list users");
          return yield* host.listUsers();
        }),
      DeleteUser: ({ userId }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireSuperuser(user, "delete user");
          yield* host.deleteUser(userId);
        }),
    };
  }),
);
