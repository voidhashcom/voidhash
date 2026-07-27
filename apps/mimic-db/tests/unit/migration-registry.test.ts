import { Primitive, serializeSchema } from "@voidhash/mimic-core";
import { defineMigration, defineMigrationRegistry } from "@voidhash/mimic-server/migrate";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { makeControlEngine } from "../../src/core/control-engine.ts";
import { makeMemoryControlStore } from "../../src/core/memory-store.ts";
import { ensureMigrationRegistry } from "../../src/core/migration-registry.ts";

const Baseline = Primitive.Struct({ title: Primitive.String().required() });
const Current = Primitive.Struct({
  title: Primitive.String().required(),
  count: Primitive.Number().default(0),
});

const registry = defineMigrationRegistry([
  {
    database: "example",
    collection: "documents",
    baseline: Baseline,
    migrations: [
      defineMigration({
        version: 1,
        name: "add-count",
        from: Baseline,
        to: Current,
      }),
    ],
  },
]);

describe("migration registry provisioning", () => {
  it("creates registry resources directly at the latest deployed version", async () => {
    const store = makeMemoryControlStore();
    await Effect.runPromise(ensureMigrationRegistry(store, registry));

    const database = await Effect.runPromise(store.findDatabaseByName("example"));
    const collection = await Effect.runPromise(
      store.findCollectionByName(database!.id, "documents"),
    );

    expect(collection?.schemaJson).toEqual(serializeSchema(Current.schema));
    expect(collection?.schemaVersion).toBe(1);
    expect(collection?.migrationVersion).toBe(1);
  });

  it("captures a final source-free baseline for an existing collection", async () => {
    const store = makeMemoryControlStore();
    await Effect.runPromise(
      Effect.gen(function* () {
        yield* store.createDatabase({ id: "db", name: "example", description: "" });
        yield* store.createCollection({
          id: "collection",
          databaseId: "db",
          name: "documents",
          schemaJson: { kind: "object", fields: {} },
          schemaVersion: 4,
          migrationVersion: null,
        });
        yield* store.addSchemaVersion({
          collectionId: "collection",
          version: 4,
          schemaJson: { kind: "object", fields: {} },
          dataMigrationSource: null,
        });
        yield* ensureMigrationRegistry(store, registry);
      }),
    );

    const collection = await Effect.runPromise(store.findCollectionById("collection"));
    const baseline = await Effect.runPromise(store.findSchemaVersion("collection", 5));
    expect(collection?.schemaVersion).toBe(5);
    expect(collection?.migrationVersion).toBe(1);
    expect(baseline?.schemaJson).toEqual(serializeSchema(Baseline.schema));
    expect(baseline?.dataMigrationSource).toBeNull();
  });

  it("prevents public deletion of registry-owned resources", async () => {
    const store = makeMemoryControlStore();
    await Effect.runPromise(ensureMigrationRegistry(store, registry));
    const database = await Effect.runPromise(store.findDatabaseByName("example"));
    const collection = await Effect.runPromise(
      store.findCollectionByName(database!.id, "documents"),
    );
    const control = makeControlEngine(store, registry);

    const databaseResult = await Effect.runPromise(
      Effect.result(control.deleteDatabase(database!.id)),
    );
    const collectionResult = await Effect.runPromise(
      Effect.result(control.deleteCollection(collection!.id)),
    );

    expect(databaseResult._tag).toBe("Failure");
    expect(collectionResult._tag).toBe("Failure");
  });

  it("refuses to bootstrap with an older deployed registry", async () => {
    const store = makeMemoryControlStore();
    await Effect.runPromise(
      Effect.gen(function* () {
        yield* store.createDatabase({ id: "db", name: "example", description: "" });
        yield* store.createCollection({
          id: "collection",
          databaseId: "db",
          name: "documents",
          schemaJson: serializeSchema(Current.schema),
          schemaVersion: 1,
          migrationVersion: 2,
        });
      }),
    );

    await expect(Effect.runPromise(ensureMigrationRegistry(store, registry))).rejects.toThrow(
      "newer than deployed version",
    );
  });
});
