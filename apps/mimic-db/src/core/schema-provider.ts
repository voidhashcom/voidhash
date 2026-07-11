import type { SchemaObject } from "@voidhash/mimic-core";
import { Effect } from "effect";

import type { ControlStoreApi, SchemaVersionRecord } from "./store.ts";

/**
 * Everything a document needs to migrate itself to the collection's latest
 * schema on load: the latest schema + version plus the full ordered version
 * history (each with its optional bundled data-migration source).
 */
export interface CollectionContext {
  readonly collectionId: string;
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
      const versions = yield* control.listSchemaVersions(collectionId);
      return {
        collectionId,
        schemaJson: collection.schemaJson,
        schemaVersion: collection.schemaVersion,
        versions,
      };
    }),
});
