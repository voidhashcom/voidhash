import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import type { HostService } from "@voidhash/mimic-db/app/hostService";
import type { SessionAttachment } from "@voidhash/mimic-db/ws/document-session";
import { makeDurableEntityAddress } from "@voidhash/platform/DurableEntity";
import { makeMemoryDurableEntityHost } from "@voidhash/platform-selfhost/MemoryDurableEntity";
import { Effect } from "effect";
import { afterEach, describe, expect, it } from "vitest";
import WebSocket from "ws";

import { installMimicNodeWebSocketServer } from "../src/mimic/MimicNodeWebSocket.ts";

const collectionId = "collection-1";
const documentId = "document-1";

/**
 * The slice of the host the document socket protocol touches while a client
 * authenticates. Everything else stays unimplemented on purpose: reaching for
 * it in this test would mean the socket path grew a dependency it should not
 * have.
 */
const stubHost = {
  authenticateDocumentToken: () =>
    Effect.succeed({ tokenId: "token-1", permission: "write" as const }),
  getDocument: () =>
    Effect.succeed({
      value: { kind: "object" as const, fields: {} },
      version: 1,
    }),
  getPresenceSnapshot: () => Effect.succeed({ presences: {} }),
  setPresence: () => Effect.void,
  removePresence: () => Effect.void,
} as unknown as HostService;

const cleanups: Array<() => Promise<void> | void> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

const listen = (server: Server): Promise<number> =>
  new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve((server.address() as AddressInfo).port);
    });
  });

describe("mimic Node WebSocket sessions", () => {
  it("keeps the entity session attachment in step with authentication", async () => {
    const entities = makeMemoryDurableEntityHost();
    const server = createServer();
    const close = installMimicNodeWebSocketServer(server, stubHost, entities, {
      control: { listDueAlarms: () => Effect.succeed([]) },
      debounceMs: 15_000,
      pollIntervalMs: 60_000,
      publish: () => Effect.void,
    });
    cleanups.push(() => {
      close();
      return new Promise<void>((resolve) => server.close(() => resolve()));
    });
    const port = await listen(server);

    const socket = new WebSocket(
      `ws://127.0.0.1:${port}/ws/v1/databases/database-1/collections/${collectionId}/documents/${documentId}`,
    );
    cleanups.push(() => void socket.close());
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("timed out waiting for a snapshot")), 5_000);
      socket.once("error", reject);
      socket.once("open", () =>
        socket.send(JSON.stringify({ type: "auth", token: "token-1" })),
      );
      socket.on("message", (data) => {
        const message = JSON.parse(data.toString()) as { readonly type?: string };
        if (message.type === "snapshot") {
          clearTimeout(timeout);
          resolve();
        }
      });
    });

    const address = makeDurableEntityAddress(
      "mimic-document",
      `${collectionId}:${documentId}`,
    );
    const attachments = await Effect.runPromise(
      entities.run(address, (entity) =>
        entity.sessions.list.pipe(
          Effect.flatMap((sessions) =>
            Effect.forEach(sessions, (session) => session.getAttachment),
          ),
        ),
      ),
    );

    // Host-side broadcasts filter on this exact flag, so a stale attachment
    // here means every authenticated browser socket is silently skipped.
    expect(attachments).toHaveLength(1);
    expect((attachments[0] as SessionAttachment).authenticated).toBe(true);
    expect((attachments[0] as SessionAttachment).permission).toBe("write");
  });
});
