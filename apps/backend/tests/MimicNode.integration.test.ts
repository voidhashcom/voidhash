import { createServer } from "node:http";

import { generateId } from "@voidhash/core/utils/generate-id";
import { causeMessage } from "@voidhash/lib/lang";
import { HostServiceTag } from "@voidhash/mimic-db/app/hostService";
import type { SchemaObject, Value } from "@voidhash/mimic-core";
import {
  DurableEntityAlarmControl,
  DurableEntityHost,
  makeDurableEntityAddress,
} from "@voidhash/platform/DurableEntity";
import { PgClusterDurableEntityLive } from "@voidhash/platform-selfhost/ClusterDurableEntity";
import type { PgPlatformConfig } from "@voidhash/platform-selfhost/Postgres";
import { Config, Data, Effect, Layer, ManagedRuntime, Redacted, Schema } from "effect";
import { describe, expect, it } from "vitest";
import WebSocket from "ws";

import { makeMimicNodeHostLive, type MimicNodeConfig } from "../src/mimic/MimicNode.ts";
import { installMimicNodeWebSocketServer } from "../src/mimic/MimicNodeWebSocket.ts";

class MimicNodeTestError extends Data.TaggedError("MimicNodeTestError")<{
  readonly message: string;
}> {}

const encodeJson = Schema.encodeSync(Schema.UnknownFromJsonString);
const decodeJson = Schema.decodeUnknownSync(Schema.UnknownFromJsonString);

const messageType = (message: unknown): string | undefined => {
  if (typeof message !== "object" || message === null) return undefined;
  if (!("type" in message)) return undefined;
  if (typeof message.type !== "string") return undefined;
  return message.type;
};

const readPgConfig = (prefix: string) =>
  Effect.gen(function* () {
    const config: PgPlatformConfig = {
      host: yield* Config.string(`${prefix}_PG_HOST`).pipe(Config.withDefault("127.0.0.1")),
      port: yield* Config.int(`${prefix}_PG_PORT`).pipe(Config.withDefault(5432)),
      database: yield* Config.string(`${prefix}_PG_DATABASE`).pipe(Config.withDefault("voidhash")),
      username: yield* Config.string(`${prefix}_PG_USERNAME`).pipe(Config.withDefault("voidhash")),
      password: yield* Config.redacted(`${prefix}_PG_PASSWORD`).pipe(
        Config.withDefault(Redacted.make("password")),
      ),
    };
    return config;
  });

const schema: SchemaObject = {
  kind: "object",
  fields: {
    title: { kind: "string", default: { kind: "string", value: "" } },
  },
};
const value: Value = {
  kind: "object",
  fields: { title: { kind: "string", value: "persistent" } },
};

// Every build owns its own single-node cluster, which is what makes the
// restart assertions meaningful: nothing process-local carries over.
//
// The entity host runs a single-node cluster, which claims every shard in the
// database it is built over. Pointing it at the platform test database keeps it
// from stealing messages addressed to the deployment this suite runs against;
// control and document state stay in the application database.
const hostLayer = () =>
  Layer.unwrap(
    Effect.gen(function* () {
      const database = yield* readPgConfig("SELFHOST");
      const platformConfig = yield* readPgConfig("PLATFORM_SELFHOST");
      const config: MimicNodeConfig = { database, documents: database };
      return makeMimicNodeHostLive(config, PgClusterDurableEntityLive(platformConfig));
    }),
  );

type MimicNodeHostServices = HostServiceTag | DurableEntityHost | DurableEntityAlarmControl;

const runHost = <A, E>(program: Effect.Effect<A, E, MimicNodeHostServices>) =>
  Effect.scoped(program.pipe(Effect.provide(hostLayer())));

describe("self-host mimic Node composition", () => {
  it("restores control and document state after the host layer restarts", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const suffix = generateId("test");
        const created = yield* runHost(
          Effect.gen(function* () {
            const host = yield* HostServiceTag;
            const database = yield* host.createDatabase(`restart-${suffix}`, "integration");
            const collection = yield* host.createCollection(database.id, "documents", schema);
            const document = yield* host.createDocument(collection.id, undefined, value);
            return { database, collection, document };
          }),
        );

        const restored = yield* runHost(
          Effect.gen(function* () {
            const host = yield* HostServiceTag;
            return yield* host.getDocument(created.collection.id, created.document.id);
          }),
        );

        expect(restored).toEqual(created.document);

        yield* runHost(
          Effect.gen(function* () {
            const host = yield* HostServiceTag;
            yield* host.deleteDocument(created.collection.id, created.document.id);
            yield* host.deleteCollection(created.collection.id);
            yield* host.deleteDatabase(created.database.id);
          }),
        );
      }),
    ));

  it("serves the document auth and snapshot protocol over a real Node WebSocket", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const runtime = ManagedRuntime.make(hostLayer());
        const host = yield* Effect.promise(() => runtime.runPromise(HostServiceTag));
        const entities = yield* Effect.promise(() => runtime.runPromise(DurableEntityHost));
        const entityControl = yield* Effect.promise(() =>
          runtime.runPromise(DurableEntityAlarmControl),
        );
        const server = createServer();
        const closeWebSockets = installMimicNodeWebSocketServer(server, host, entities, {
          control: entityControl,
          debounceMs: 15_000,
          pollIntervalMs: 60_000,
          publish: () => Effect.void,
        });
        yield* Effect.callback<void, MimicNodeTestError>((resume) => {
          server.once("error", (error) =>
            resume(Effect.fail(new MimicNodeTestError({ message: causeMessage(error) }))),
          );
          server.listen(0, "127.0.0.1", () => resume(Effect.void));
        });

        const suffix = generateId("test");
        const documentId = `ws-${suffix.slice(0, 20)}`;
        let databaseId: string | undefined;
        let collectionId: string | undefined;

        const cleanup = Effect.gen(function* () {
          if (databaseId && collectionId) {
            const cleanupDatabaseId = databaseId;
            const cleanupCollectionId = collectionId;
            yield* host.deleteDocument(cleanupCollectionId, documentId);
            yield* host.deleteCollection(cleanupCollectionId);
            yield* host.deleteDatabase(cleanupDatabaseId);
          }
          closeWebSockets();
          yield* Effect.callback<void>((resume) => {
            server.close(() => resume(Effect.void));
          });
          yield* Effect.promise(() => runtime.dispose());
        }).pipe(Effect.orDie);

        const body = Effect.gen(function* () {
          const created = yield* Effect.gen(function* () {
            const database = yield* host.createDatabase(`ws-${suffix}`, "integration");
            const collection = yield* host.createCollection(database.id, "documents", schema);
            const document = yield* host.createDocument(collection.id, documentId, value);
            const auth = yield* host.createDocumentAuthToken(
              collection.id,
              document.id,
              "write",
              [],
              60,
            );
            return { database, collection, document, auth };
          });
          databaseId = created.database.id;
          collectionId = created.collection.id;
          const address = server.address();
          if (address === null || typeof address === "string") {
            return yield* Effect.fail(
              new MimicNodeTestError({ message: "HTTP server did not expose a TCP port" }),
            );
          }
          const socket = new WebSocket(
            `ws://127.0.0.1:${address.port}/ws/v1/databases/${databaseId}/collections/${collectionId}/documents/${documentId}`,
          );
          const messages = yield* Effect.callback<ReadonlyArray<unknown>, MimicNodeTestError>(
            (resume) => {
              const received: unknown[] = [];
              socket.once("error", (error) =>
                resume(Effect.fail(new MimicNodeTestError({ message: causeMessage(error) }))),
              );
              socket.once("open", () =>
                socket.send(encodeJson({ type: "auth", token: created.auth.token })),
              );
              socket.on("message", (data) => {
                const message = decodeJson(data.toString());
                received.push(message);
                if (messageType(message) === "snapshot") resume(Effect.succeed(received));
              });
            },
          ).pipe(
            Effect.timeoutOrElse({
              duration: "5 seconds",
              orElse: () =>
                Effect.fail(
                  new MimicNodeTestError({ message: "timed out waiting for snapshot" }),
                ),
            }),
          );
          expect(messages).toContainEqual(
            expect.objectContaining({ type: "auth_result", success: true, permission: "write" }),
          );
          expect(messages).toContainEqual(
            expect.objectContaining({ type: "snapshot", value, version: 1 }),
          );
          const entityAddress = makeDurableEntityAddress(
            "mimic-document",
            `${collectionId}:${documentId}`,
          );
          const attached = yield* entities.run(entityAddress, (entity) => entity.sessions.list);
          expect(attached).toHaveLength(1);

          yield* Effect.callback<void>((resume) => {
            socket.once("close", () => resume(Effect.void));
            socket.close(1000, "done");
          });
          let remaining = attached;
          for (let attempt = 0; attempt < 20 && remaining.length > 0; attempt += 1) {
            yield* Effect.sleep("10 millis");
            remaining = yield* entities.run(entityAddress, (entity) => entity.sessions.list);
          }
          expect(remaining).toHaveLength(0);
        });

        yield* body.pipe(Effect.ensuring(cleanup));
      }),
    ));
});
