// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { objectValue, booleanValue, stringValue } from "@voidhash/mimic-core";

import { NotConnectedError } from "../../src/client/errors.js";
import { WebSocketTransport } from "../../src/client/WebSocketTransport.js";

class FakeWebSocket {
  static readonly OPEN = 1;
  static instances: FakeWebSocket[] = [];

  readonly listeners = new Map<string, Array<(event: any) => void>>();
  readonly sent: string[] = [];
  readyState = 0;

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, handler: (event: any) => void): void {
    const handlers = this.listeners.get(type) ?? [];
    handlers.push(handler);
    this.listeners.set(type, handlers);
  }

  send(message: string): void {
    this.sent.push(message);
  }

  close(): void {
    this.readyState = 3;
    this.emit("close", {});
  }

  emit(type: string, event: any): void {
    for (const handler of this.listeners.get(type) ?? []) {
      handler(event);
    }
  }
}

describe("WebSocketTransport", () => {
  it("authenticates, sends requests, and tracks connection state", async () => {
    const transport = new WebSocketTransport({
      url: "ws://example.test/socket",
      token: "token-1",
      WebSocket: FakeWebSocket as unknown as typeof WebSocket,
      reconnect: false,
    });

    const connectPromise = transport.connect();
    const socket = FakeWebSocket.instances[0]!;
    socket.readyState = FakeWebSocket.OPEN;
    socket.emit("open", {});
    await Promise.resolve();
    expect(socket.sent[0]).toBe(JSON.stringify({ type: "auth", token: "token-1" }));

    socket.emit("message", {
      data: JSON.stringify({
        type: "auth_result",
        success: true,
        tokenId: "token-id",
        permission: "write",
      }),
    });

    await connectPromise;
    expect(transport.isConnected()).toBe(true);

    transport.requestSnapshot();
    const presenceValue = objectValue({ ok: booleanValue(true) });
    transport.setPresence(presenceValue);

    expect(socket.sent).toContain(JSON.stringify({ type: "request_snapshot" }));
    expect(socket.sent).toContain(JSON.stringify({ type: "presence_set", data: presenceValue }));
  });

  const AUTH_SUCCESS = JSON.stringify({
    type: "auth_result",
    success: true,
    tokenId: "token-id",
    permission: "write",
  });

  const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  const authenticate = async (socket: FakeWebSocket): Promise<void> => {
    socket.readyState = FakeWebSocket.OPEN;
    socket.emit("open", {});
    await flushMicrotasks();
    socket.emit("message", { data: AUTH_SUCCESS });
    await flushMicrotasks();
  };

  it("buffers presence set in the open-but-unauthenticated window and replays after auth", async () => {
    const baseline = FakeWebSocket.instances.length;
    const transport = new WebSocketTransport({
      url: "ws://example.test/socket",
      token: "token-1",
      WebSocket: FakeWebSocket as unknown as typeof WebSocket,
      reconnect: false,
    });

    const presenceValue = objectValue({ name: stringValue("pre-auth") });
    const connectPromise = transport.connect();
    const socket = FakeWebSocket.instances[baseline]!;
    socket.readyState = FakeWebSocket.OPEN;
    socket.emit("open", {});
    await flushMicrotasks();

    expect(() => transport.setPresence(presenceValue)).not.toThrow();
    expect(socket.sent).not.toContain(
      JSON.stringify({ type: "presence_set", data: presenceValue }),
    );

    socket.emit("message", { data: AUTH_SUCCESS });
    await connectPromise;
    expect(socket.sent).toContain(JSON.stringify({ type: "presence_set", data: presenceValue }));
  });

  it("buffers presence set while fully disconnected and replays it after connect", async () => {
    const baseline = FakeWebSocket.instances.length;
    const transport = new WebSocketTransport({
      url: "ws://example.test/socket",
      token: "token-1",
      WebSocket: FakeWebSocket as unknown as typeof WebSocket,
      reconnect: false,
    });

    const presenceValue = objectValue({ name: stringValue("offline") });
    expect(() => transport.setPresence(presenceValue)).not.toThrow();

    const connectPromise = transport.connect();
    await authenticate(FakeWebSocket.instances[baseline]!);
    await connectPromise;

    expect(FakeWebSocket.instances[baseline]!.sent).toContain(
      JSON.stringify({ type: "presence_set", data: presenceValue }),
    );
  });

  it("replays a presence set buffered during a reconnect gap after re-auth", async () => {
    const baseline = FakeWebSocket.instances.length;
    const transport = new WebSocketTransport({
      url: "ws://example.test/socket",
      token: "token-1",
      WebSocket: FakeWebSocket as unknown as typeof WebSocket,
      reconnectDelayMs: 1,
    });

    const connectPromise = transport.connect();
    const socket = FakeWebSocket.instances[baseline]!;
    await authenticate(socket);
    await connectPromise;

    socket.close();
    expect(transport.isConnected()).toBe(false);

    const presenceValue = objectValue({ name: stringValue("during-gap") });
    expect(() => transport.setPresence(presenceValue)).not.toThrow();

    await new Promise<void>((resolve) => setTimeout(resolve, 5));
    const reconnected = FakeWebSocket.instances[baseline + 1]!;
    expect(reconnected).not.toBe(socket);
    await authenticate(reconnected);

    expect(transport.isConnected()).toBe(true);
    expect(reconnected.sent).toContain(
      JSON.stringify({ type: "presence_set", data: presenceValue }),
    );
    transport.disconnect();
  });

  it("replays a presence clear buffered while disconnected after the next auth", async () => {
    const baseline = FakeWebSocket.instances.length;
    const transport = new WebSocketTransport({
      url: "ws://example.test/socket",
      token: "token-1",
      WebSocket: FakeWebSocket as unknown as typeof WebSocket,
      reconnect: false,
    });

    const presenceValue = objectValue({ name: stringValue("to-clear") });
    expect(() => transport.setPresence(presenceValue)).not.toThrow();
    expect(() => transport.clearPresence()).not.toThrow();

    const connectPromise = transport.connect();
    const socket = FakeWebSocket.instances[baseline]!;
    await authenticate(socket);
    await connectPromise;

    expect(socket.sent).toContain(JSON.stringify({ type: "presence_clear" }));
    expect(socket.sent).not.toContain(
      JSON.stringify({ type: "presence_set", data: presenceValue }),
    );
  });

  it("notifies onAuthFailure when the initial connect is rejected", async () => {
    const baseline = FakeWebSocket.instances.length;
    const failures: Error[] = [];
    const transport = new WebSocketTransport({
      url: "ws://example.test/socket",
      token: "token-1",
      WebSocket: FakeWebSocket as unknown as typeof WebSocket,
      reconnect: false,
      onAuthFailure: (error) => failures.push(error),
    });

    const connectPromise = transport.connect();
    const socket = FakeWebSocket.instances[baseline]!;
    socket.readyState = FakeWebSocket.OPEN;
    socket.emit("open", {});
    await flushMicrotasks();
    socket.emit("message", {
      data: JSON.stringify({ type: "auth_result", success: false, error: "bad token" }),
    });

    await expect(connectPromise).rejects.toThrow("WebSocket authentication failed: bad token");
    expect(failures).toHaveLength(1);
    expect(failures[0]!.message).toContain("bad token");
  });

  it("notifies onAuthFailure on a reconnect-cycle auth failure and stays terminal", async () => {
    const baseline = FakeWebSocket.instances.length;
    const failures: Error[] = [];
    const transport = new WebSocketTransport({
      url: "ws://example.test/socket",
      token: "token-1",
      WebSocket: FakeWebSocket as unknown as typeof WebSocket,
      reconnectDelayMs: 1,
      onAuthFailure: (error) => failures.push(error),
    });

    const connectPromise = transport.connect();
    const socket = FakeWebSocket.instances[baseline]!;
    await authenticate(socket);
    await connectPromise;
    expect(transport.isConnected()).toBe(true);

    // Drop the connection; the transport schedules a reconnect.
    socket.close();
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
    const reconnected = FakeWebSocket.instances[baseline + 1]!;
    expect(reconnected).not.toBe(socket);

    reconnected.readyState = FakeWebSocket.OPEN;
    reconnected.emit("open", {});
    await flushMicrotasks();
    reconnected.emit("message", {
      data: JSON.stringify({ type: "auth_result", success: false, error: "token expired" }),
    });
    await flushMicrotasks();

    expect(failures).toHaveLength(1);
    expect(failures[0]!.message).toContain("token expired");
    expect(transport.isConnected()).toBe(false);

    // Terminal: auth failure stops the reconnect loop.
    const socketCount = FakeWebSocket.instances.length;
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    expect(FakeWebSocket.instances.length).toBe(socketCount);
  });

  it("keeps throwing NotConnectedError for non-presence sends while disconnected", () => {
    const transport = new WebSocketTransport({
      url: "ws://example.test/socket",
      token: "token-1",
      WebSocket: FakeWebSocket as unknown as typeof WebSocket,
      reconnect: false,
    });

    expect(() => transport.requestSnapshot()).toThrow(NotConnectedError);
    expect(() => transport.submit({ id: "tx-1", baseVersion: 0, commands: [] })).toThrow(
      NotConnectedError,
    );
  });
});
