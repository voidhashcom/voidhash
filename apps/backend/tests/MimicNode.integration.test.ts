import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { HostServiceTag } from "@voidhash/mimic-db/app/hostService";
import type { SchemaObject, Value } from "@voidhash/mimic-core";
import {
  DurableEntityAlarmControl,
  DurableEntityHost,
  makeDurableEntityAddress,
} from "@voidhash/platform/DurableEntity";
import { PgClusterDurableEntityLive } from "@voidhash/platform-selfhost/ClusterDurableEntity";
import type { PgPlatformConfig } from "@voidhash/platform-selfhost/Postgres";
import { Effect, ManagedRuntime, Redacted } from "effect";
import { describe, expect, it } from "vitest";
import WebSocket from "ws";

import { makeMimicNodeHostLive, type MimicNodeConfig } from "../src/mimic/MimicNode.ts";
import { installMimicNodeWebSocketServer } from "../src/mimic/MimicNodeWebSocket.ts";

const config: MimicNodeConfig = {
  database: {
    host: process.env.SELFHOST_PG_HOST ?? "127.0.0.1",
    port: Number(process.env.SELFHOST_PG_PORT ?? "5432"),
    database: process.env.SELFHOST_PG_DATABASE ?? "voidhash",
    username: process.env.SELFHOST_PG_USERNAME ?? "voidhash",
    password: Redacted.make(process.env.SELFHOST_PG_PASSWORD ?? "password"),
  },
  documents: {
    host: process.env.SELFHOST_PG_HOST ?? "127.0.0.1",
    port: Number(process.env.SELFHOST_PG_PORT ?? "5432"),
    database: process.env.SELFHOST_PG_DATABASE ?? "voidhash",
    username: process.env.SELFHOST_PG_USERNAME ?? "voidhash",
    password: Redacted.make(process.env.SELFHOST_PG_PASSWORD ?? "password"),
  },
};

// The entity host runs a single-node cluster, which claims every shard in the
// database it is built over. Pointing it at the platform test database keeps it
// from stealing messages addressed to the deployment this suite runs against;
// control and document state stay in the application database above.
const platformConfig: PgPlatformConfig = {
  host: process.env.PLATFORM_SELFHOST_PG_HOST ?? "127.0.0.1",
  port: Number(process.env.PLATFORM_SELFHOST_PG_PORT ?? "5432"),
  database: process.env.PLATFORM_SELFHOST_PG_DATABASE ?? "voidhash",
  username: process.env.PLATFORM_SELFHOST_PG_USERNAME ?? "voidhash",
  password: Redacted.make(process.env.PLATFORM_SELFHOST_PG_PASSWORD ?? "password"),
};

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
const hostLayer = () =>
  makeMimicNodeHostLive(config, PgClusterDurableEntityLive(platformConfig));

const runHost = <A, E>(program: Effect.Effect<A, E, any>): Promise<A> =>
  Effect.runPromise(
    Effect.scoped(program.pipe(Effect.provide(hostLayer()))) as Effect.Effect<A, E>,
  );

const runStandalone = <A, E>(program: Effect.Effect<A, E, any>): Promise<A> =>
  Effect.runPromise(program as Effect.Effect<A, E>);

describe("self-host mimic Node composition", () => {
  it("restores control and document state after the host layer restarts", async () => {
    const suffix = crypto.randomUUID();
    const created = await runHost(
      Effect.gen(function* () {
        const host = yield* HostServiceTag;
        const database = yield* host.createDatabase(`restart-${suffix}`, "integration");
        const collection = yield* host.createCollection(database.id, "documents", schema);
        const document = yield* host.createDocument(collection.id, undefined, value);
        return { database, collection, document };
      }),
    );

    const restored = await runHost(
      Effect.gen(function* () {
        const host = yield* HostServiceTag;
        return yield* host.getDocument(created.collection.id, created.document.id);
      }),
    );

    expect(restored).toEqual(created.document);

    await runHost(
      Effect.gen(function* () {
        const host = yield* HostServiceTag;
        yield* host.deleteDocument(created.collection.id, created.document.id);
        yield* host.deleteCollection(created.collection.id);
        yield* host.deleteDatabase(created.database.id);
      }),
    );
  });

  it("serves the document auth and snapshot protocol over a real Node WebSocket", async () => {
    const runtime = ManagedRuntime.make(hostLayer());
    const host = await runtime.runPromise(HostServiceTag);
    const entities = await runtime.runPromise(DurableEntityHost);
    const entityControl = await runtime.runPromise(DurableEntityAlarmControl);
    const server = createServer();
    const closeWebSockets = installMimicNodeWebSocketServer(server, host, entities, {
      control: entityControl,
      debounceMs: 15_000,
      pollIntervalMs: 60_000,
      publish: () => Effect.void,
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });

    const suffix = crypto.randomUUID();
    const documentId = `ws-${suffix.slice(0, 20)}`;
    let databaseId: string | undefined;
    let collectionId: string | undefined;
    try {
      const created = await runStandalone(
        Effect.gen(function* () {
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
        }),
      );
      databaseId = created.database.id;
      collectionId = created.collection.id;
      const address = server.address() as AddressInfo;
      const socket = new WebSocket(
        `ws://127.0.0.1:${address.port}/ws/v1/databases/${databaseId}/collections/${collectionId}/documents/${documentId}`,
      );
      const messages = await new Promise<unknown[]>((resolve, reject) => {
        const received: unknown[] = [];
        const timeout = setTimeout(() => reject(new Error("timed out waiting for snapshot")), 5_000);
        socket.once("error", reject);
        socket.once("open", () =>
          socket.send(JSON.stringify({ type: "auth", token: created.auth.token })),
        );
        socket.on("message", (data) => {
          const message = JSON.parse(data.toString()) as { readonly type?: string };
          received.push(message);
          if (message.type === "snapshot") {
            clearTimeout(timeout);
            resolve(received);
          }
        });
      });
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
      const attached = await Effect.runPromise(
        entities.run(entityAddress, (entity) => entity.sessions.list),
      );
      expect(attached).toHaveLength(1);

      const closed = new Promise<void>((resolve) => socket.once("close", () => resolve()));
      socket.close(1000, "done");
      await closed;
      let remaining = attached;
      for (let attempt = 0; attempt < 20 && remaining.length > 0; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        remaining = await Effect.runPromise(
          entities.run(entityAddress, (entity) => entity.sessions.list),
        );
      }
      expect(remaining).toHaveLength(0);
    } finally {
      if (databaseId && collectionId) {
        const cleanupDatabaseId = databaseId;
        const cleanupCollectionId = collectionId;
        await runStandalone(
          Effect.gen(function* () {
            yield* host.deleteDocument(cleanupCollectionId, documentId);
            yield* host.deleteCollection(cleanupCollectionId);
            yield* host.deleteDatabase(cleanupDatabaseId);
          }),
        );
      }
      closeWebSockets();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await runtime.dispose();
    }
  });
});
