import type { SchemaObject } from "@voidhash/mimic-core";
import { Effect } from "effect";

import type { ControlStoreApi, SchemaVersionRecord } from "./store.ts";

/**
 * Everything a document needs to migrate itself to the collection's latest
 * schema on load: the latest schema + version plus the full ordered version
 * history. Legacy source fields are retained only so unsupported executable
 * migrations can be detected and rejected.
 */
export interface CollectionContext {
  readonly collectionId: string;
  readonly databaseName: string;
  readonly collectionName: string;
  readonly schemaJson: SchemaObject;
  readonly schemaVersion: number;
  readonly versions: readonly SchemaVersionRecord[];
}

export interface SchemaProviderApi {
  readonly getCollectionContext: (
    collectionId: string,
  ) => Effect.Effect<CollectionContext | undefined>;
}

/** SchemaProvider reading directly from the configured `ControlStore`. */
export const makeControlStoreSchemaProvider = (control: ControlStoreApi): SchemaProviderApi => ({
  getCollectionContext: (collectionId) =>
    Effect.gen(function* () {
      const collection = yield* control.findCollectionById(collectionId);
      if (!collection) return undefined;
      const database = yield* control.findDatabaseById(collection.databaseId);
      if (!database) return undefined;
      const versions = yield* control.listSchemaVersions(collectionId);
      return {
        collectionId,
        databaseName: database.name,
        collectionName: collection.name,
        schemaJson: collection.schemaJson,
        schemaVersion: collection.schemaVersion,
        versions,
      };
    }),
});
