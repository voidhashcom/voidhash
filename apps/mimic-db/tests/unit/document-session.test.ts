import { objectValue, stringValue } from "@voidhash/mimic-core";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { PresenceEntry } from "../../src/app/hostService.ts";
import {
  AUTH_DEADLINE_MS,
  handleDocumentSocketClose,
  handleDocumentSocketMessage,
  isolateSessionHook,
  type DocumentSessionContext,
  type SessionAttachment,
} from "../../src/ws/document-session.ts";
import type { ServerMessage } from "../../src/ws/protocol.ts";
import { makeSessionRegistry, type SessionRegistryTimers } from "../../src/ws/session-registry.ts";

interface FakeSocket {
  attachment: SessionAttachment | null;
  readonly sent: ServerMessage[];
  closed: { code: number; reason: string } | null;
}

const docValue = objectValue({ title: stringValue("Hello") });

const makeManualTimers = () => {
  let currentNow = 0;
  const scheduled: Array<{ at: number; fn: () => void; cancelled: boolean }> = [];
  const timers: SessionRegistryTimers = {
    now: () => currentNow,
    schedule: (fn, ms) => {
      const entry = { at: currentNow + ms, fn, cancelled: false };
      scheduled.push(entry);
      return () => {
        entry.cancelled = true;
      };
    },
  };
  const advance = (ms: number) => {
    currentNow += ms;
    for (const entry of scheduled) {
      if (!entry.cancelled && entry.at <= currentNow) {
        entry.cancelled = true;
        entry.fn();
      }
    }
  };
  return { timers, advance };
};

const makeHarness = (options?: {
  readonly loadDocument?: DocumentSessionContext<FakeSocket>["loadDocument"];
}) => {
  const { timers, advance } = makeManualTimers();
  const acceptedSeqs: number[] = [];
  let lastAuthenticatedCloses = 0;
  const registry = makeSessionRegistry<FakeSocket>({
    authDeadlineMs: AUTH_DEADLINE_MS,
    isAuthenticated: (socket) => socket.attachment?.authenticated === true,
    close: (socket) => {
      socket.closed = { code: 1008, reason: "Authentication deadline exceeded" };
    },
    timers,
  });
  const presence = new Map<string, PresenceEntry>();
  const ctx: DocumentSessionContext<FakeSocket> = {
    registry,
    presence: {
      snapshot: () => Effect.sync(() => Object.fromEntries(presence)),
      set: (connectionId, entry) => Effect.sync(() => void presence.set(connectionId, entry)),
      remove: (connectionId) => Effect.sync(() => presence.delete(connectionId)),
      prune: () => Effect.void,
    },
    getAttachment: (socket) => socket.attachment,
    setAttachment: (socket, attachment) => {
      socket.attachment = attachment;
    },
    send: (socket, message) =>
      Effect.sync(() => {
        socket.sent.push(message);
      }),
    close: (socket, code, reason) =>
      Effect.sync(() => {
        socket.closed = { code, reason };
      }),
    authenticate: (token) =>
      token === "good-token"
        ? Effect.succeed({ tokenId: "tok-1", permission: "write" as const })
        : Effect.fail(new Error("invalid token")),
    loadDocument: options?.loadDocument ?? (() => Effect.succeed({ value: docValue, version: 1 })),
    submitTransaction: (envelope) =>
      Effect.succeed({ accepted: true, version: 2, transactionId: envelope.id }),
    onAccepted: (seq) =>
      Effect.sync(() => {
        acceptedSeqs.push(seq);
      }),
    onLastAuthenticatedClose: () =>
      Effect.sync(() => {
        lastAuthenticatedCloses += 1;
      }),
  };

  /** Simulates the DO `fetch` upgrade path for a fresh socket. */
  const connectSocket = (connectionId: string): FakeSocket => {
    const socket: FakeSocket = {
      attachment: {
        connectionId,
        collectionId: "col-1",
        documentId: "doc-1",
        origin: null,
        connectedAt: timers.now(),
        authenticated: false,
      },
      sent: [],
      closed: null,
    };
    registry.trackPending(connectionId, socket);
    return socket;
  };

  const message = (socket: FakeSocket, frame: unknown): Promise<void> =>
    Effect.runPromise(handleDocumentSocketMessage(ctx, socket, JSON.stringify(frame)));

  const authenticateSocket = async (connectionId: string): Promise<FakeSocket> => {
    const socket = connectSocket(connectionId);
    await message(socket, { type: "auth", token: "good-token" });
    socket.sent.length = 0;
    return socket;
  };

  return {
    ctx,
    registry,
    presence,
    advance,
    connectSocket,
    message,
    authenticateSocket,
    acceptedSeqs,
    lastAuthenticatedCloses: () => lastAuthenticatedCloses,
  };
};

describe("document session protocol", () => {
  it("answers a successful auth with auth_result, snapshot, and presence snapshot", async () => {
    const harness = makeHarness();
    const socket = harness.connectSocket("conn-1");

    await harness.message(socket, { type: "auth", token: "good-token" });

    expect(socket.sent).toEqual([
      { type: "auth_result", success: true, tokenId: "tok-1", permission: "write" },
      { type: "snapshot", value: docValue, version: 1 },
      { type: "presence_snapshot", selfId: "conn-1", presences: {} },
    ]);
    expect(socket.attachment?.authenticated).toBe(true);
    expect(harness.registry.authenticated()).toEqual([socket]);
  });

  it("rejects an invalid token without granting the session", async () => {
    const harness = makeHarness();
    const socket = harness.connectSocket("conn-1");

    await harness.message(socket, { type: "auth", token: "wrong" });

    expect(socket.sent).toEqual([
      { type: "auth_result", success: false, error: "Invalid document token" },
    ]);
    expect(socket.attachment?.authenticated).toBe(false);
    expect(harness.registry.authenticated()).toEqual([]);
  });

  it("never broadcasts to sockets that have not authenticated", async () => {
    const harness = makeHarness();
    const writer = await harness.authenticateSocket("writer");
    const peer = await harness.authenticateSocket("peer");
    const lurker = harness.connectSocket("lurker");

    await harness.message(writer, {
      type: "submit",
      transaction: { id: "tx-1", baseVersion: 1, commands: [] },
    });
    await harness.message(writer, {
      type: "presence_set",
      data: objectValue({ name: stringValue("w") }),
    });

    expect(lurker.sent).toEqual([]);
    expect(peer.sent.map((m) => m.type)).toEqual(["transaction", "presence_update"]);
    expect(writer.sent.map((m) => m.type)).toEqual(["transaction", "presence_update"]);
  });

  it("sends an error frame and closes the socket when the snapshot load fails after auth", async () => {
    const harness = makeHarness({
      loadDocument: () => Effect.fail({ message: "database unreachable" }),
    });
    const socket = harness.connectSocket("conn-1");

    await harness.message(socket, { type: "auth", token: "good-token" });

    expect(socket.sent).toEqual([
      {
        type: "error",
        transactionId: undefined,
        reason: "Failed to load document: database unreachable",
      },
    ]);
    expect(socket.closed).toEqual({ code: 1011, reason: "Document load failed" });
    expect(harness.registry.authenticated()).toEqual([]);
  });

  it("broadcasts presence_remove to peers when a socket with presence closes", async () => {
    const harness = makeHarness();
    const leaver = await harness.authenticateSocket("leaver");
    const peer = await harness.authenticateSocket("peer");

    await harness.message(leaver, {
      type: "presence_set",
      data: objectValue({ name: stringValue("l") }),
    });
    peer.sent.length = 0;

    await Effect.runPromise(handleDocumentSocketClose(harness.ctx, leaver));

    expect(peer.sent).toEqual([{ type: "presence_remove", id: "leaver" }]);
    expect(harness.presence.has("leaver")).toBe(false);
    expect(harness.registry.authenticated()).toEqual([peer]);

    // Closing a socket without presence broadcasts nothing.
    peer.sent.length = 0;
    const quiet = await harness.authenticateSocket("quiet");
    await Effect.runPromise(handleDocumentSocketClose(harness.ctx, quiet));
    expect(peer.sent).toEqual([]);
  });

  it("closes sockets that never authenticate once the deadline passes", async () => {
    const harness = makeHarness();
    const socket = harness.connectSocket("conn-1");

    harness.advance(AUTH_DEADLINE_MS - 1);
    expect(socket.closed).toBeNull();
    harness.advance(1);
    expect(socket.closed).toEqual({ code: 1008, reason: "Authentication deadline exceeded" });
  });

  it("keeps authenticated sockets alive past the auth deadline", async () => {
    const harness = makeHarness();
    const socket = await harness.authenticateSocket("conn-1");

    harness.advance(AUTH_DEADLINE_MS * 10);
    expect(socket.closed).toBeNull();
    expect(harness.registry.authenticated()).toEqual([socket]);
  });

  it("reports the accepted sequence to the idle-notify host on submit", async () => {
    const harness = makeHarness();
    const writer = await harness.authenticateSocket("writer");

    await harness.message(writer, {
      type: "submit",
      transaction: { id: "tx-1", baseVersion: 1, commands: [] },
    });

    // The stub submit returns version 2, so the current sequence is 1.
    expect(harness.acceptedSeqs).toEqual([1]);
  });

  it("signals the idle-notify host only when the last authenticated socket closes", async () => {
    const harness = makeHarness();
    const first = await harness.authenticateSocket("first");
    const second = await harness.authenticateSocket("second");

    await Effect.runPromise(handleDocumentSocketClose(harness.ctx, first));
    expect(harness.lastAuthenticatedCloses()).toBe(0);

    await Effect.runPromise(handleDocumentSocketClose(harness.ctx, second));
    expect(harness.lastAuthenticatedCloses()).toBe(1);
  });

  it("completes close cleanup even when an isolated onLastAuthenticatedClose hook dies", async () => {
    const harness = makeHarness();
    // The DO wires the storage-backed hook through `isolateSessionHook`; model a
    // hook whose underlying storage effect DIES (a defect, not a typed failure).
    const dyingCtx: DocumentSessionContext<FakeSocket> = {
      ...harness.ctx,
      onLastAuthenticatedClose: () =>
        isolateSessionHook(
          Effect.die(new Error("storage unavailable")),
          "onLastAuthenticatedClose",
        ),
    };
    const leaver = await harness.authenticateSocket("leaver");
    await Effect.runPromise(
      handleDocumentSocketMessage(
        harness.ctx,
        leaver,
        JSON.stringify({ type: "presence_set", data: objectValue({ name: stringValue("l") }) }),
      ),
    );

    // Must resolve (not reject) — the die is swallowed by the isolation wrapper —
    // and the registry/presence cleanup still runs.
    await Effect.runPromise(handleDocumentSocketClose(dyingCtx, leaver));

    expect(harness.presence.has("leaver")).toBe(false);
    expect(harness.registry.authenticated()).toEqual([]);
  });
});

describe("isolateSessionHook", () => {
  it("swallows a die and returns void so the caller proceeds", async () => {
    let ran = false;
    const result = await Effect.runPromise(
      isolateSessionHook(Effect.die(new Error("boom")), "recordDirty").pipe(
        Effect.tap(() =>
          Effect.sync(() => {
            ran = true;
          }),
        ),
      ),
    );
    expect(ran).toBe(true);
    expect(result).toBeUndefined();
  });

  it("passes a succeeding hook through untouched", async () => {
    const result = await Effect.runPromise(isolateSessionHook(Effect.succeed(42), "recordDirty"));
    expect(result).toBe(42);
  });
});
