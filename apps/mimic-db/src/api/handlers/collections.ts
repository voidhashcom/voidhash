import { Effect } from "effect";
import { CollectionsRpcs, CurrentUser } from "@voidhash/mimic-server/rpc";

import { HostServiceTag } from "../../app/hostService.ts";

export const CollectionsHandlersLive = CollectionsRpcs.toLayer(
  Effect.gen(function* () {
    const host = yield* HostServiceTag;
    return {
      CreateCollection: ({ databaseId, name, schema }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* host.ensureDatabasePermission(user.userId, user.isSuperuser, databaseId, "write");
          const collection = yield* host.createCollection(databaseId, name, schema);
          return {
            id: collection.id,
            databaseId: collection.databaseId,
            name: collection.name,
          };
        }),
      ListCollections: ({ databaseId }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* host.ensureDatabasePermission(user.userId, user.isSuperuser, databaseId, "read");
          return yield* host.listCollections(databaseId);
        }),
      UpdateCollectionSchema: ({ collectionId, schema, dataMigrationSource }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const databaseId = yield* host.databaseIdForCollection(collectionId);
          yield* host.ensureDatabasePermission(user.userId, user.isSuperuser, databaseId, "admin");
          // Note: today's host method ignores dataMigrationSource for ad-hoc
          // schema updates — `applyMigration` is the only path that consumes
          // bundled data-migration sources. Preserve that behavior.
          void dataMigrationSource;
          const updated = yield* host.updateCollectionSchema(collectionId, schema);
          return { id: updated.id, schemaVersion: updated.schemaVersion };
        }),
      DeleteCollection: ({ collectionId }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const databaseId = yield* host.databaseIdForCollection(collectionId);
          yield* host.ensureDatabasePermission(user.userId, user.isSuperuser, databaseId, "admin");
          yield* host.deleteCollection(collectionId);
        }),
    };
  }),
);
