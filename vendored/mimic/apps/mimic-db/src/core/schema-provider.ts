import type { SchemaObject } from "@voidhash/mimic-core";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

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
  ) => Effect.Effect<Option.Option<CollectionContext>>;
}

/** SchemaProvider reading directly from the configured `ControlStore`. */
export const makeControlStoreSchemaProvider = (control: ControlStoreApi): SchemaProviderApi => ({
  getCollectionContext: (collectionId) =>
    Effect.gen(function* () {
      const collection = yield* control.findCollectionById(collectionId);
      if (Option.isNone(collection)) return Option.none();
      const database = yield* control.findDatabaseById(collection.value.databaseId);
      if (Option.isNone(database)) return Option.none();
      const versions = yield* control.listSchemaVersions(collectionId);
      return Option.some({
        collectionId,
        databaseName: database.value.name,
        collectionName: collection.value.name,
        schemaJson: collection.value.schemaJson,
        schemaVersion: collection.value.schemaVersion,
        versions,
      });
    }),
});
