import { describe, expect, it } from "vitest";

import { makeSessionRegistry, type SessionRegistryTimers } from "../../src/ws/session-registry.ts";

interface FakeSocket {
  readonly id: string;
  authenticated: boolean;
  closed: boolean;
}

const makeSocket = (id: string, authenticated = false): FakeSocket => ({
  id,
  authenticated,
  closed: false,
});

/** Manual clock + timer queue so deadlines are driven deterministically. */
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
  const setNow = (value: number) => {
    currentNow = value;
  };
  return { timers, advance, setNow };
};

const makeRegistry = (timers: SessionRegistryTimers) =>
  makeSessionRegistry<FakeSocket>({
    authDeadlineMs: 10_000,
    isAuthenticated: (socket) => socket.authenticated,
    close: (socket) => {
      socket.closed = true;
    },
    timers,
  });

describe("session registry", () => {
  it("keeps pending sockets out of the authenticated set until promoted", () => {
    const { timers } = makeManualTimers();
    const registry = makeRegistry(timers);
    const socket = makeSocket("a");

    registry.trackPending("a", socket);
    expect(registry.authenticated()).toEqual([]);

    socket.authenticated = true;
    registry.promote("a", socket);
    expect(registry.authenticated()).toEqual([socket]);
  });

  it("closes sockets that do not authenticate within the deadline", () => {
    const { timers, advance } = makeManualTimers();
    const registry = makeRegistry(timers);
    const socket = makeSocket("a");

    registry.trackPending("a", socket);
    advance(9_999);
    expect(socket.closed).toBe(false);
    advance(1);
    expect(socket.closed).toBe(true);
    expect(registry.authenticated()).toEqual([]);
  });

  it("cancels the deadline when the socket authenticates in time", () => {
    const { timers, advance } = makeManualTimers();
    const registry = makeRegistry(timers);
    const socket = makeSocket("a");

    registry.trackPending("a", socket);
    advance(5_000);
    socket.authenticated = true;
    registry.promote("a", socket);
    advance(60_000);
    expect(socket.closed).toBe(false);
    expect(registry.authenticated()).toEqual([socket]);
  });

  it("cancels the deadline when the socket closes first", () => {
    const { timers, advance } = makeManualTimers();
    const registry = makeRegistry(timers);
    const socket = makeSocket("a");

    registry.trackPending("a", socket);
    registry.remove("a");
    advance(60_000);
    expect(socket.closed).toBe(false);
  });

  it("restores authenticated sockets straight into the broadcast set", () => {
    const { timers } = makeManualTimers();
    const registry = makeRegistry(timers);
    const socket = makeSocket("a", true);

    registry.restore("a", socket, true, 0);
    expect(registry.authenticated()).toEqual([socket]);
  });

  it("restores a pending socket with the remainder of its deadline", () => {
    const { timers, advance, setNow } = makeManualTimers();
    const registry = makeRegistry(timers);
    const socket = makeSocket("a");

    setNow(4_000);
    registry.restore("a", socket, false, 0);
    advance(5_999);
    expect(socket.closed).toBe(false);
    advance(1);
    expect(socket.closed).toBe(true);
  });

  it("closes a restored pending socket whose deadline already passed", () => {
    const { timers, setNow } = makeManualTimers();
    const registry = makeRegistry(timers);
    const socket = makeSocket("a");

    setNow(60_000);
    registry.restore("a", socket, false, 0);
    expect(socket.closed).toBe(true);
    expect(registry.authenticated()).toEqual([]);
  });

  it("grants the full deadline to restored attachments without a connect time", () => {
    const { timers, advance } = makeManualTimers();
    const registry = makeRegistry(timers);
    const socket = makeSocket("a");

    registry.restore("a", socket, false, undefined);
    advance(9_999);
    expect(socket.closed).toBe(false);
    advance(1);
    expect(socket.closed).toBe(true);
  });

  it("filters de-authenticated sockets out of broadcasts (belt and braces)", () => {
    const { timers } = makeManualTimers();
    const registry = makeRegistry(timers);
    const socket = makeSocket("a", true);

    registry.promote("a", socket);
    expect(registry.authenticated()).toEqual([socket]);

    socket.authenticated = false;
    expect(registry.authenticated()).toEqual([]);
  });
});
