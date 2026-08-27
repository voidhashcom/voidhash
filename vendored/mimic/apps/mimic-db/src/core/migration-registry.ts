import { serializeSchema } from "@voidhash/mimic-core";
import {
  defineMigrationRegistry,
  latestMigrationPrimitive,
  type MigrationRegistry,
} from "@voidhash/mimic-server/migrate";
import { Context, Effect, Layer } from "effect";

import { randomId } from "./ids.ts";
import type { ControlStoreApi } from "./store.ts";

export class MigrationRegistryService extends Context.Service<
  MigrationRegistryService,
  MigrationRegistry
>()("@voidhash/mimic-db/MigrationRegistry") {}

export const EmptyMigrationRegistry = defineMigrationRegistry([]);

export const EmptyMigrationRegistryLive = Layer.succeed(
  MigrationRegistryService,
  EmptyMigrationRegistry,
);

/**
 * Structural, key-order-independent equality for the JSON shapes serialized
 * schemas are made of. Replaces a canonicalize-then-`JSON.stringify` compare.
 */
const schemasEqual = (left: unknown, right: unknown): boolean => {
  if (left === right) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    if (left.length !== right.length) return false;
    return left.every((entry, index) => schemasEqual(entry, right[index]));
  }
  if (typeof left !== "object" || typeof right !== "object") return false;
  if (left === null || right === null) return false;
  const leftEntries = Object.entries(left);
  const rightEntries = new Map(Object.entries(right));
  if (leftEntries.length !== rightEntries.size) return false;
  return leftEntries.every(([key, entry]) => {
    if (!rightEntries.has(key)) return false;
    return schemasEqual(entry, rightEntries.get(key));
  });
};

/** Ensures every registry-owned database and collection is present and current. */
export const ensureMigrationRegistry = (
  store: ControlStoreApi,
  registry: MigrationRegistry,
): Effect.Effect<void> =>
  Effect.gen(function* () {
    for (const definition of registry.collections) {
      let database = yield* store.findDatabaseByName(definition.database);
      if (!database) {
        database = {
          id: randomId(),
          name: definition.database,
          description: definition.databaseDescription ?? "",
        };
        yield* store.createDatabase(database);
      }

      const baselineSchema = serializeSchema(definition.baseline.schema);
      let collection = yield* store.findCollectionByName(database.id, definition.collection);
      if (!collection) {
        collection = {
          id: randomId(),
          databaseId: database.id,
          name: definition.collection,
          schemaJson: baselineSchema,
          schemaVersion: 1,
          migrationVersion: 0,
        };
        yield* store.createCollection(collection);
        yield* store.addSchemaVersion({
          collectionId: collection.id,
          version: 1,
          schemaJson: baselineSchema,
          dataMigrationSource: null,
        });
      } else if (collection.migrationVersion === null) {
        if (!schemasEqual(collection.schemaJson, baselineSchema)) {
          const baselineVersion = collection.schemaVersion + 1;
          yield* store.updateCollectionSchema(collection.id, baselineSchema, baselineVersion);
          yield* store.addSchemaVersion({
            collectionId: collection.id,
            version: baselineVersion,
            schemaJson: baselineSchema,
            dataMigrationSource: null,
          });
          collection = {
            ...collection,
            schemaJson: baselineSchema,
            schemaVersion: baselineVersion,
          };
        }
        yield* store.updateCollectionMigration(collection.id, baselineSchema, 0);
        collection = { ...collection, schemaJson: baselineSchema, migrationVersion: 0 };
      }

      const latest = latestMigrationPrimitive(definition);
      const latestSchema = serializeSchema(latest.schema);
      const latestVersion = definition.migrations.length;
      if (collection.migrationVersion !== null && collection.migrationVersion > latestVersion) {
        return yield* Effect.die(
          new Error(
            `Collection ${definition.database}/${definition.collection} has migration version ${collection.migrationVersion}, newer than deployed version ${latestVersion}`,
          ),
        );
      }
      if (
        collection.migrationVersion !== latestVersion ||
        !schemasEqual(collection.schemaJson, latestSchema)
      ) {
        yield* store.updateCollectionMigration(collection.id, latestSchema, latestVersion);
      }
    }
  });

export const isRegistryCollection = (
  registry: MigrationRegistry,
  database: string,
  collection: string,
): boolean => registry.find(database, collection) !== undefined;
