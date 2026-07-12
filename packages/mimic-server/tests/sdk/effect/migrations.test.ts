import { Effect, Layer } from "effect";
import { RpcTest } from "effect/unstable/rpc";
import {
  AuthMiddleware,
  CurrentUser,
  MimicRpcGroup,
  type MigrationChange,
} from "@voidhash/mimic-server/rpc";
import { describe, expect, it } from "vitest";

interface ApplyCall {
  readonly databaseId: string;
  readonly version: number;
  readonly name: string;
  readonly checksum: string;
  readonly changes: ReadonlyArray<MigrationChange>;
}

interface ListCall {
  readonly databaseId: string;
}

const makeTestEnv = () => {
  const applyCalls: ApplyCall[] = [];
  const listCalls: ListCall[] = [];
  const cannedMigrations: ReadonlyArray<{
    readonly version: number;
    readonly name: string;
    readonly checksum: string;
  }> = [
    { version: 1, name: "init", checksum: "abc" },
    { version: 2, name: "add-slug", checksum: "def" },
  ];

  // The full group requires every procedure to be implemented; we only
  // care about the migration ones for these tests, so the rest are stubs
  // that fail with a tagged error.
  const HandlersLive = MimicRpcGroup.toLayer(
    Effect.succeed({
      ListDatabaseMigrations: ({ databaseId }) =>
        Effect.sync(() => {
          listCalls.push({ databaseId });
          return cannedMigrations;
        }),
      ApplyDatabaseMigration: ({ databaseId, version, name, checksum, changes }) =>
        Effect.sync(() => {
          applyCalls.push({ databaseId, version, name, checksum, changes });
        }),
      // Stub everything else.
      CreateDatabase: () => Effect.die("unused in this test"),
      ListDatabases: () => Effect.die("unused in this test"),
      DeleteDatabase: () => Effect.die("unused in this test"),
      CreateCollection: () => Effect.die("unused in this test"),
      ListCollections: () => Effect.die("unused in this test"),
      UpdateCollectionSchema: () => Effect.die("unused in this test"),
      DeleteCollection: () => Effect.die("unused in this test"),
      CreateDocument: () => Effect.die("unused in this test"),
      GetDocument: () => Effect.die("unused in this test"),
      ListDocuments: () => Effect.die("unused in this test"),
      SubmitTransaction: () => Effect.die("unused in this test"),
      DeleteDocument: () => Effect.die("unused in this test"),
      CreateUser: () => Effect.die("unused in this test"),
      ListUsers: () => Effect.die("unused in this test"),
      DeleteUser: () => Effect.die("unused in this test"),
      GrantPermission: () => Effect.die("unused in this test"),
      RevokePermission: () => Effect.die("unused in this test"),
      ListGrants: () => Effect.die("unused in this test"),
      SetupDocumentAuthentication: () => Effect.die("unused in this test"),
    }),
  );

  const StubAuthLive = Layer.effect(AuthMiddleware)(
    Effect.succeed((effect, _options) =>
      Effect.provideService(effect, CurrentUser, {
        userId: "test-user",
        username: "test",
        isSuperuser: true,
      }),
    ),
  );

  return {
    applyCalls,
    listCalls,
    cannedMigrations,
    layer: Layer.mergeAll(HandlersLive, StubAuthLive),
  };
};

describe("MimicRpcGroup migrations RPCs", () => {
  it("returns the canned migration list and records the requested databaseId", async () => {
    const env = makeTestEnv();
    const program = Effect.gen(function* () {
      const client = yield* RpcTest.makeClient(MimicRpcGroup);
      return yield* client.ListDatabaseMigrations({ databaseId: "db-1" });
    });

    const response = await Effect.runPromise(
      Effect.scoped(program).pipe(Effect.provide(env.layer)),
    );

    expect(response).toEqual(env.cannedMigrations);
    expect(env.listCalls).toEqual([{ databaseId: "db-1" }]);
  });

  it("encodes a typed migration change payload across the wire", async () => {
    const env = makeTestEnv();
    const change: MigrationChange = {
      type: "update",
      collection: "todos",
      schema: {
        kind: "object",
        fields: {
          title: { kind: "string", required: true },
          slug: { kind: "string", required: true },
        },
      },
      oldSchema: {
        kind: "object",
        fields: { title: { kind: "string", required: true } },
      },
      dataMigrationSource: "globalThis.__MIMIC_RUN_MIGRATION__ = () => ({ value: undefined });",
    };

    const program = Effect.gen(function* () {
      const client = yield* RpcTest.makeClient(MimicRpcGroup);
      yield* client.ApplyDatabaseMigration({
        databaseId: "db-1",
        version: 2,
        name: "add-slug",
        checksum: "checksum-2",
        changes: [change],
      });
    });

    await Effect.runPromise(Effect.scoped(program).pipe(Effect.provide(env.layer)));

    expect(env.applyCalls).toHaveLength(1);
    const call = env.applyCalls[0]!;
    expect(call.databaseId).toBe("db-1");
    expect(call.version).toBe(2);
    expect(call.name).toBe("add-slug");
    expect(call.checksum).toBe("checksum-2");
    expect(call.changes).toEqual([change]);
  });
});
