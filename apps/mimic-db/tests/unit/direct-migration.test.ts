import { Primitive, serializeSchema } from "@voidhash/mimic-core";
import {
  defineMigration,
  defineMigrationRegistry,
  type AnyDirectMigration,
} from "@voidhash/mimic-server/migrate";
import { makeDurableEntityAddress } from "@voidhash/platform/DurableEntity";
import { Cause, Effect } from "effect";
import { describe, expect, it } from "vitest";

import { makeDocumentEngine } from "../../src/core/document-engine.ts";
import { makeMemoryDurableEntityHost } from "../../src/core/local-entity-host.ts";
import { makeMemoryDocumentStore } from "../../src/core/memory-store.ts";
import { EmptyMigrationRegistry } from "../../src/core/migration-registry.ts";

const Original = Primitive.Struct({
  title: Primitive.String().required(),
});

const Current = Primitive.Struct({
  title: Primitive.String().required(),
  count: Primitive.Number().required(),
});

const registryWith = (migrate: () => AnyDirectMigration) =>
  defineMigrationRegistry([
    {
      database: "example",
      collection: "documents",
      baseline: Original,
      migrations: [migrate()],
    },
  ]);

const addCount = () =>
  defineMigration({
    version: 1,
    name: "add-count",
    from: Original,
    to: Current,
    migrate: ({ oldRoot, root }) => root.update({ title: oldRoot.title.get(), count: 7 }),
  });

const schema = {
  getCollectionContext: () =>
    Effect.succeed({
      collectionId: "collection-1",
      databaseName: "example",
      collectionName: "documents",
      schemaJson: serializeSchema(Current.schema),
      schemaVersion: 1,
      versions: [
        {
          collectionId: "collection-1",
          version: 1,
          schemaJson: serializeSchema(Original.schema),
          dataMigrationSource: null,
        },
      ],
    }),
};

describe("document direct migrations", () => {
  it("commits a pending migration once before returning the document", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const store = makeMemoryDocumentStore();
        let commits = 0;
        const trackedStore = {
          ...store,
          commitMigration: (...args: Parameters<typeof store.commitMigration>) => {
            commits += 1;
            return store.commitMigration(...args);
          },
        };
        const engine = makeDocumentEngine({
          store: trackedStore,
          migrations: registryWith(addCount),
          schema,
          snapshotEveryCommands: 100,
        });

        yield* engine.create("collection-1", Original.encode({ title: "Hello" }), 1, 0);
        const first = yield* engine.load();
        const second = yield* engine.load();

        expect(Current.decode(first.value)).toEqual({ title: "Hello", count: 7 });
        expect(Current.decode(second.value)).toEqual({ title: "Hello", count: 7 });
        expect(first.migrationVersion).toBe(1);
        expect(commits).toBe(1);
      }),
    ));

  it("leaves persistence unchanged when migration code fails", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const store = makeMemoryDocumentStore();
        const failing = registryWith(() =>
          defineMigration({
            version: 1,
            name: "fail",
            from: Original,
            to: Current,
            // `migrate` is a synchronous callback, so the simulated failure is
            // raised as a defect through `Effect.die` instead of a `throw`.
            migrate: () => Effect.runSync(Effect.die(new Error("boom"))),
          }),
        );
        const failingEngine = makeDocumentEngine({
          store,
          migrations: failing,
          schema,
          snapshotEveryCommands: 100,
        });
        yield* failingEngine.create("collection-1", Original.encode({ title: "Hello" }), 1, 0);

        const failure = yield* failingEngine.load().pipe(
          Effect.as("loaded"),
          Effect.catchCause((cause) => Effect.succeed(Cause.pretty(cause))),
        );
        expect(failure).toContain("boom");

        const fixedEngine = makeDocumentEngine({
          store,
          migrations: registryWith(addCount),
          schema,
          snapshotEveryCommands: 100,
        });
        const loaded = yield* fixedEngine.load();
        expect(Current.decode(loaded.value)).toEqual({ title: "Hello", count: 7 });
      }),
    ));

  it("serializes concurrent opens so a migration commits once", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const store = makeMemoryDocumentStore();
        let commits = 0;
        const engine = makeDocumentEngine({
          store: {
            ...store,
            commitMigration: (...args: Parameters<typeof store.commitMigration>) => {
              commits += 1;
              return store.commitMigration(...args);
            },
          },
          migrations: registryWith(addCount),
          schema,
          snapshotEveryCommands: 100,
        });
        yield* engine.create("collection-1", Original.encode({ title: "Hello" }), 1, 0);

        const entities = makeMemoryDurableEntityHost();
        const address = makeDurableEntityAddress("mimic-document", "doc-1");
        const [first, second] = yield* Effect.all(
          [entities.run(address, engine.load), entities.run(address, engine.load)],
          { concurrency: "unbounded" },
        );

        expect(Current.decode(first.value)).toEqual({ title: "Hello", count: 7 });
        expect(Current.decode(second.value)).toEqual({ title: "Hello", count: 7 });
        expect(commits).toBe(1);
      }),
    ));

  it("rejects legacy executable source without changing persistence", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const store = makeMemoryDocumentStore();
        const engine = makeDocumentEngine({
          store,
          migrations: EmptyMigrationRegistry,
          schema: {
            getCollectionContext: () =>
              Effect.succeed({
                collectionId: "collection-1",
                databaseName: "example",
                collectionName: "documents",
                schemaJson: serializeSchema(Current.schema),
                schemaVersion: 2,
                versions: [
                  {
                    collectionId: "collection-1",
                    version: 1,
                    schemaJson: serializeSchema(Original.schema),
                    dataMigrationSource: null,
                  },
                  {
                    collectionId: "collection-1",
                    version: 2,
                    schemaJson: serializeSchema(Current.schema),
                    dataMigrationSource: "return value",
                  },
                ],
              }),
          },
          snapshotEveryCommands: 100,
        });
        const original = Original.encode({ title: "Hello" });
        yield* engine.create("collection-1", original, 1, null);

        const failure = yield* engine.load().pipe(
          Effect.as("loaded"),
          Effect.catchCause((cause) => Effect.succeed(Cause.pretty(cause))),
        );
        expect(failure).toContain("executable source, which is no longer supported");

        const meta = yield* store.readMeta();
        const snapshot = yield* store.loadLatestSnapshot();
        expect(meta?.schemaVersion).toBe(1);
        expect(meta?.migrationVersion).toBeNull();
        expect(snapshot?.value).toEqual(original);
      }),
    ));

  it("rejects documents newer than the deployed migration registry", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const store = makeMemoryDocumentStore();
        const engine = makeDocumentEngine({
          store,
          migrations: registryWith(addCount),
          schema,
          snapshotEveryCommands: 100,
        });
        yield* engine.create("collection-1", Current.encode({ title: "Hello", count: 7 }), 1, 2);

        const failure = yield* engine.load().pipe(
          Effect.as("loaded"),
          Effect.catchCause((cause) => Effect.succeed(Cause.pretty(cause))),
        );
        expect(failure).toContain("newer than deployed version");
      }),
    ));
});
