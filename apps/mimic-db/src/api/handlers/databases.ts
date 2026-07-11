import { Effect } from "effect";
import { CurrentUser, DatabasesRpcs, ForbiddenError } from "@voidhash/mimic-server/rpc";

import { HostServiceTag } from "../../app/hostService.ts";

const requireSuperuser = (user: { isSuperuser: boolean }, action: string) =>
  user.isSuperuser
    ? Effect.void
    : Effect.fail(
        new ForbiddenError({
          code: "forbidden",
          message: `Superuser permission required for ${action}`,
        }),
      );

export const DatabasesHandlersLive = DatabasesRpcs.toLayer(
  Effect.gen(function* () {
    const host = yield* HostServiceTag;
    return {
      CreateDatabase: ({ name, description }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireSuperuser(user, "create database");
          return yield* host.createDatabase(name, description);
        }),
      ListDatabases: () =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireSuperuser(user, "list databases");
          return yield* host.listDatabases();
        }),
      DeleteDatabase: ({ databaseId }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireSuperuser(user, "delete database");
          yield* host.deleteDatabase(databaseId);
        }),
    };
  }),
);
