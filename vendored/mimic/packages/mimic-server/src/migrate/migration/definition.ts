import * as Arr from "effect/Array";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as P from "effect/Predicate";
import * as HashMap from "effect/HashMap";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { Primitive, serializeSchema } from "@voidhash/mimic-core";

/** JSON codec used to derive a stable structural key from a serialized schema. */
const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

/**
 * Rejects an invalid registry definition. Registry construction is a
 * synchronous, build-time invariant, so a violation is raised as a defect.
 */
class InvalidMigrationRegistryError extends Schema.TaggedErrorClass<InvalidMigrationRegistryError>()(
  "InvalidMigrationRegistryError",
  { message: Schema.String },
) {}

const dieWith = (message: string): never => {
  throw new InvalidMigrationRegistryError({ message });
};

export interface DirectMigrationContext<TTo extends Primitive.AnyPrimitive> {
  readonly root: Primitive.InferProxy<TTo>;
}

export interface DirectMigrationContextWithOld<
  TFrom extends Primitive.AnyPrimitive,
  TTo extends Primitive.AnyPrimitive,
> extends DirectMigrationContext<TTo> {
  readonly oldRoot: Primitive.InferProxy<TFrom>;
}

export interface DirectMigration<
  TFrom extends Primitive.AnyPrimitive = Primitive.AnyPrimitive,
  TTo extends Primitive.AnyPrimitive = Primitive.AnyPrimitive,
> {
  readonly version: number;
  readonly name: string;
  readonly from: TFrom;
  readonly to: TTo;
  readonly migrate?: (context: DirectMigrationContextWithOld<TFrom, TTo>) => void;
}

export type AnyDirectMigration = DirectMigration<any, any>;

export interface MigrationCollectionDefinition {
  readonly database: string;
  readonly databaseDescription?: string;
  readonly collection: string;
  readonly baseline: Primitive.AnyPrimitive;
  readonly migrations: readonly AnyDirectMigration[];
}

export interface MigrationRegistry {
  readonly collections: readonly MigrationCollectionDefinition[];
  readonly find: (
    database: string,
    collection: string,
  ) => Option.Option<MigrationCollectionDefinition>;
}

/** Defines one synchronous, directly invoked document migration. */
export const defineMigration = <
  TFrom extends Primitive.AnyPrimitive,
  TTo extends Primitive.AnyPrimitive,
>(
  migration: DirectMigration<TFrom, TTo>,
): DirectMigration<TFrom, TTo> => migration;

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!P.isObject(value) || value === null) return value;
  return R.fromEntries(
    Arr.map(
      Arr.sort(
        R.toEntries(value),
        Order.mapInput<string, [string, unknown]>(Order.String, ([key]) => key),
      ),
      ([key, entry]) => [key, canonicalize(entry)],
    ),
  );
};

const schemaKey = (primitive: Primitive.AnyPrimitive): string =>
  encodeJson(canonicalize(serializeSchema(primitive.schema)));

/**
 * Defines and validates the complete deployed migration registry.
 *
 * Migration versions are collection-local and must be contiguous from one.
 */
export const defineMigrationRegistry = (
  collections: readonly MigrationCollectionDefinition[],
): MigrationRegistry => {
  let byAddress = HashMap.empty<string, MigrationCollectionDefinition>();

  collections.forEach((definition) => {
    const address = `${definition.database}\u0000${definition.collection}`;
    if (HashMap.has(byAddress, address)) {
      dieWith(`Duplicate migration collection ${definition.database}/${definition.collection}`);
    }

    let previous = definition.baseline;
    definition.migrations.forEach((migration, index) => {
      const expectedVersion = index + 1;
      if (!Number.isSafeInteger(migration.version) || migration.version !== expectedVersion) {
        dieWith(
          `Expected migration version ${expectedVersion} for ${definition.database}/${definition.collection}, received ${migration.version}`,
        );
      }
      if (schemaKey(previous) !== schemaKey(migration.from)) {
        dieWith(
          `Migration ${migration.version} (${migration.name}) does not start from the previous schema`,
        );
      }
      previous = migration.to;
    });

    byAddress = HashMap.set(byAddress, address, definition);
  });

  return {
    collections: [...collections],
    find: (database, collection) => HashMap.get(byAddress, `${database}\u0000${collection}`),
  };
};

/** Returns the target primitive for a registry-owned collection. */
export const latestMigrationPrimitive = (
  definition: MigrationCollectionDefinition,
): Primitive.AnyPrimitive =>
  Arr.last(definition.migrations).pipe(
    Option.map((migration) => migration.to),
    Option.getOrElse(() => definition.baseline),
  );
