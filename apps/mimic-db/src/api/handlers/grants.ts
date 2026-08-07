import { Effect } from "effect";
import { CurrentUser, ForbiddenError, GrantsRpcs } from "@voidhash/mimic-server/rpc";

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

export const GrantsHandlersLive = GrantsRpcs.toLayer(
  Effect.gen(function* () {
    const host = yield* HostServiceTag;
    return {
      GrantPermission: ({ userId, databaseId, permission }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireSuperuser(user, "grant permission");
          yield* host.grantPermission(userId, databaseId, permission);
        }),
      RevokePermission: ({ userId, databaseId }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireSuperuser(user, "revoke permission");
          yield* host.revokePermission(userId, databaseId);
        }),
      ListGrants: ({ userId }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireSuperuser(user, "list grants");
          return yield* host.listGrants(userId);
        }),
    };
  }),
);
