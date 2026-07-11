import { Effect } from "effect";
import { CurrentUser, MigrationsRpcs } from "@voidhash/mimic-server/rpc";

import {
  HostServiceTag,
  type ApplyMigrationOptions,
  type MigrationChange as HostMigrationChange,
} from "../../app/hostService.ts";

export const MigrationsHandlersLive = MigrationsRpcs.toLayer(
  Effect.gen(function* () {
    const host = yield* HostServiceTag;
    return {
      ListDatabaseMigrations: ({ databaseId }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* host.ensureDatabasePermission(user.userId, user.isSuperuser, databaseId, "admin");
          return yield* host.listMigrations(databaseId);
        }),
      ApplyDatabaseMigration: ({
        databaseId,
        version,
        name,
        checksum,
        changes,
        mode,
        dryRun,
        batchSize,
        redoSucceededOnReplace,
      }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* host.ensureDatabasePermission(user.userId, user.isSuperuser, databaseId, "admin");

          const options: ApplyMigrationOptions = {
            batchSize,
            dryRun: dryRun ? { ...dryRun } : false,
          };

          // Wire schema is `unknown` for `changes`; cast to the host's
          // typed shape — the host normalizes/validates each change as it
          // processes them.
          const hostChanges = changes as ReadonlyArray<HostMigrationChange>;

          const resolvedMode = mode ?? "apply";

          if (resolvedMode === "rerun") {
            return yield* host.rerunMigration(
              databaseId,
              version,
              name,
              checksum,
              hostChanges,
              options,
            );
          }
          if (resolvedMode === "replace") {
            return yield* host.replaceMigration(databaseId, version, name, checksum, hostChanges, {
              ...options,
              redoSucceeded: redoSucceededOnReplace,
            });
          }
          return yield* host.applyMigration(
            databaseId,
            version,
            name,
            checksum,
            hostChanges,
            options,
          );
        }),
      GetMigrationStatus: ({ databaseId, version }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* host.ensureDatabasePermission(user.userId, user.isSuperuser, databaseId, "admin");
          return yield* host.getMigrationStatus(databaseId, version);
        }),
    };
  }),
);
