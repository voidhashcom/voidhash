// oxlint-disable-next-line effect/noNodeBuiltinImport -- the test stands up a real `node:http` server to receive live requests; an `HttpServer` layer would not exercise the same wire path.
import { createServer, type Server } from "node:http";

import { constant } from "@voidhash/lib/lang";
import { objectValue } from "@voidhash/mimic-core";
import type { HostService } from "@voidhash/mimic-db/app/hostService";
import { makeDurableEntityAddress } from "@voidhash/platform/DurableEntity";
import { makeMemoryDurableEntityHost } from "@voidhash/platform-node/MemoryDurableEntity";
import { Data, Effect, Option, Schema } from "effect";
import { describe, expect, it } from "vitest";
import WebSocket from "ws";

import { installMimicNodeWebSocketServer } from "../src/mimic/MimicNodeWebSocket.ts";

const collectionId = "collection-1";
const documentId = "document-1";

class TestServerAddressError extends Data.TaggedError("TestServerAddressError")<{
  readonly message: string;
}> {}

const notImplemented = (name: string) => () =>
  Effect.die(new Error(`HostService.${name} is not reachable from the document socket protocol`));

/**
 * The slice of the host the document socket protocol touches while a client
 * authenticates. Everything else dies on purpose: reaching for it in this test
 * would mean the socket path grew a dependency it should not have.
 */
const stubHost: HostService = {
  authenticateBasic: notImplemented("authenticateBasic"),
  authenticateDocumentToken: () =>
    Effect.succeed({ tokenId: "token-1", permission: constant("write") }),
  createDatabase: notImplemented("createDatabase"),
  listDatabases: notImplemented("listDatabases"),
  deleteDatabase: notImplemented("deleteDatabase"),
  createCollection: notImplemented("createCollection"),
  listCollections: notImplemented("listCollections"),
  deleteCollection: notImplemented("deleteCollection"),
  createUser: notImplemented("createUser"),
  listUsers: notImplemented("listUsers"),
  deleteUser: notImplemented("deleteUser"),
  grantPermission: notImplemented("grantPermission"),
  revokePermission: notImplemented("revokePermission"),
  listGrants: notImplemented("listGrants"),
  createDocumentAuthToken: notImplemented("createDocumentAuthToken"),
  createDocument: notImplemented("createDocument"),
  getDocument: () =>
    Effect.succeed({
      collectionId,
      id: documentId,
      value: objectValue(),
      version: 1,
    }),
  listDocuments: notImplemented("listDocuments"),
  deleteDocument: notImplemented("deleteDocument"),
  submitTransaction: notImplemented("submitTransaction"),
  attachConnection: notImplemented("attachConnection"),
  heartbeatConnection: notImplemented("heartbeatConnection"),
  getConnectionDocument: notImplemented("getConnectionDocument"),
  submitConnectionTransaction: notImplemented("submitConnectionTransaction"),
  detachConnection: notImplemented("detachConnection"),
  getPresenceSnapshot: () => Effect.succeed({ presences: {} }),
  setPresence: () => Effect.void,
  removePresence: () => Effect.void,
  ensureDatabasePermission: notImplemented("ensureDatabasePermission"),
  databaseIdForCollection: notImplemented("databaseIdForCollection"),
};

const AuthMessage = Schema.Struct({
  type: Schema.Literal("auth"),
  token: Schema.String,
});
const encodeAuthMessage = Schema.encodeSync(Schema.fromJsonString(AuthMessage));

const ServerMessage = Schema.Struct({ type: Schema.optional(Schema.String) });
const decodeServerMessage = Schema.decodeUnknownOption(Schema.fromJsonString(ServerMessage));

const utf8 = new TextDecoder();

/**
 * `ws` hands frame payloads over as a Buffer, an ArrayBuffer, or (when
 * `fragments` are kept) an array of Buffers; decode each shape explicitly
 * rather than relying on default stringification.
 */
const rawDataToString = (data: WebSocket.RawData): string => {
  if (Array.isArray(data)) {
    return data.map((chunk) => utf8.decode(chunk)).join("");
  }
  return utf8.decode(data);
};

const SessionAttachmentShape = Schema.Struct({
  authenticated: Schema.Boolean,
  permission: Schema.optional(Schema.Literals(["read", "write"])),
});
const decodeSessionAttachment = Schema.decodeUnknownSync(SessionAttachmentShape);

/** Binds the server to an ephemeral loopback port and returns it. */
const listen = (server: Server) =>
  Effect.gen(function* () {
    yield* Effect.callback<void, Error>((resume) => {
      const onError = (error: Error) => resume(Effect.fail(error));
      server.once("error", onError);
      server.listen(0, "127.0.0.1", () => {
        server.off("error", onError);
        resume(Effect.void);
      });
    });
    const address = server.address();
    if (address === null || typeof address === "string") {
      return yield* new TestServerAddressError({
        message: "Test server did not expose a TCP address",
      });
    }
    return address.port;
  });

describe("mimic Node WebSocket sessions", () => {
  it("keeps the entity session attachment in step with authentication", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const entities = makeMemoryDurableEntityHost();
        const server = createServer();
        const close = installMimicNodeWebSocketServer(server, stubHost, entities, {
          control: { listDueAlarms: () => Effect.succeed([]) },
          debounceMs: 15_000,
          pollIntervalMs: 60_000,
          publish: () => Effect.void,
        });
        yield* Effect.addFinalizer(() =>
          Effect.callback<void>((resume) => {
            close();
            server.close(() => resume(Effect.void));
          }),
        );
        const port = yield* listen(server);

        const socket = new WebSocket(
          `ws://127.0.0.1:${port}/ws/v1/databases/database-1/collections/${collectionId}/documents/${documentId}`,
        );
        yield* Effect.addFinalizer(() => Effect.sync(() => socket.close()));
        yield* Effect.callback<void, Error>((resume) => {
          socket.once("error", (error) => resume(Effect.fail(error)));
          socket.once("open", () =>
            socket.send(encodeAuthMessage({ type: "auth", token: "token-1" })),
          );
          socket.on("message", (data) => {
            const message = decodeServerMessage(rawDataToString(data));
            if (Option.isSome(message) && message.value.type === "snapshot") {
              resume(Effect.void);
            }
          });
        }).pipe(
          Effect.timeoutOrElse({
            duration: "5 seconds",
            orElse: () => Effect.die(new Error("timed out waiting for a snapshot")),
          }),
        );

        const address = makeDurableEntityAddress("mimic-document", `${collectionId}:${documentId}`);
        const attachments = yield* entities.run(address, (entity) =>
          entity.sessions.list.pipe(
            Effect.flatMap((sessions) =>
              Effect.forEach(sessions, (session) => session.getAttachment),
            ),
          ),
        );

        // Host-side broadcasts filter on this exact flag, so a stale attachment
        // here means every authenticated browser socket is silently skipped.
        expect(attachments).toHaveLength(1);
        const attachment = decodeSessionAttachment(attachments[0]);
        expect(attachment.authenticated).toBe(true);
        expect(attachment.permission).toBe("write");
      }).pipe(Effect.scoped),
    ));
});
