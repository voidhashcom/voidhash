import * as R from "effect/Record";
import * as P from "effect/Predicate";
import { serializeSchema } from "@voidhash/mimic-core";
import {
  defineMigrationRegistry,
  latestMigrationPrimitive,
  type MigrationRegistry,
} from "@voidhash/mimic-server/migrate";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

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
  if (!P.isObject(left) || !P.isObject(right)) return false;
  if (left === null || right === null) return false;
  const leftEntries = R.toEntries(left);
  const rightEntries = HashMap.fromIterable(R.toEntries(right));
  if (leftEntries.length !== HashMap.size(rightEntries)) return false;
  return leftEntries.every(([key, entry]) => {
    const rightEntry = HashMap.get(rightEntries, key);
    return Option.isSome(rightEntry) && schemasEqual(entry, rightEntry.value);
  });
};

class MigrationRegistryVersionError extends Schema.TaggedErrorClass<MigrationRegistryVersionError>()(
  "MigrationRegistryVersionError",
  { message: Schema.String },
) {}

/** Ensures every registry-owned database and collection is present and current. */
export const ensureMigrationRegistry = (
  store: ControlStoreApi,
  registry: MigrationRegistry,
): Effect.Effect<void> =>
  Effect.gen(function* () {
    yield* Effect.forEach(
      registry.collections,
      (definition) =>
        Effect.gen(function* () {
          let database = Option.getOrUndefined(
            yield* store.findDatabaseByName(definition.database),
          );
          if (!database) {
            database = {
              id: randomId(),
              name: definition.database,
              description: definition.databaseDescription ?? "",
            };
            yield* store.createDatabase(database);
          }

          const baselineSchema = serializeSchema(definition.baseline.schema);
          let collection = Option.getOrUndefined(
            yield* store.findCollectionByName(database.id, definition.collection),
          );
          if (!collection) {
            collection = {
              id: randomId(),
              databaseId: database.id,
              name: definition.collection,
              schemaJson: baselineSchema,
              schemaVersion: 1,
              migrationVersion: Option.some(0),
            };
            yield* store.createCollection(collection);
            yield* store.addSchemaVersion({
              collectionId: collection.id,
              version: 1,
              schemaJson: baselineSchema,
              dataMigrationSource: Option.none(),
            });
          } else if (Option.isNone(collection.migrationVersion)) {
            if (!schemasEqual(collection.schemaJson, baselineSchema)) {
              const baselineVersion = collection.schemaVersion + 1;
              yield* store.updateCollectionSchema(collection.id, baselineSchema, baselineVersion);
              yield* store.addSchemaVersion({
                collectionId: collection.id,
                version: baselineVersion,
                schemaJson: baselineSchema,
                dataMigrationSource: Option.none(),
              });
              collection = {
                ...collection,
                schemaJson: baselineSchema,
                schemaVersion: baselineVersion,
              };
            }
            yield* store.updateCollectionMigration(collection.id, baselineSchema, 0);
            collection = {
              ...collection,
              schemaJson: baselineSchema,
              migrationVersion: Option.some(0),
            };
          }

          const latest = latestMigrationPrimitive(definition);
          const latestSchema = serializeSchema(latest.schema);
          const latestVersion = definition.migrations.length;
          if (
            Option.isSome(collection.migrationVersion) &&
            collection.migrationVersion.value > latestVersion
          ) {
            return yield* Effect.die(
              new MigrationRegistryVersionError({
                message: `Collection ${definition.database}/${definition.collection} has migration version ${collection.migrationVersion.value}, newer than deployed version ${latestVersion}`,
              }),
            );
          }
          if (
            !Option.contains(collection.migrationVersion, latestVersion) ||
            !schemasEqual(collection.schemaJson, latestSchema)
          ) {
            yield* store.updateCollectionMigration(collection.id, latestSchema, latestVersion);
          }
        }),
      { concurrency: 1, discard: true },
    );
  });

export const isRegistryCollection = (
  registry: MigrationRegistry,
  database: string,
  collection: string,
): boolean => Option.isSome(registry.find(database, collection));
