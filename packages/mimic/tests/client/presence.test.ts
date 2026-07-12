import { describe, expect, it } from "vitest";

import { createClientDocument } from "../../src/client/ClientDocument.js";
import {
  FakeTransport,
  TestPresencePrimitive,
  TestPrimitive,
  makePresenceValue,
  makeValue,
} from "../helpers.js";

describe("presence", () => {
  it("tracks presence snapshots and updates", () => {
    const transport = new FakeTransport();
    const document = createClientDocument({
      primitive: TestPrimitive,
      transport,
      initialValue: makeValue("Base"),
      initialVersion: 1,
      presence: {
        primitive: TestPresencePrimitive,
        initial: { name: "self" },
      },
    });

    document.presence?.set({ name: "self" });
    expect(transport.presenceValues[0]).toEqual(makePresenceValue("self"));

    transport.emit({
      type: "presence_snapshot",
      selfId: "self-id",
      presences: {
        "self-id": { data: makePresenceValue("self") },
        other: { data: makePresenceValue("other"), userId: "user-1" },
      },
    });

    expect(document.presence?.selfId()).toBe("self-id");
    expect(document.presence?.self()).toEqual({ name: "self" });
    expect(document.presence?.others().get("other")).toEqual({
      data: { name: "other" },
      userId: "user-1",
    });

    transport.emit({
      type: "presence_update",
      id: "other",
      data: makePresenceValue("updated"),
      userId: "user-1",
    });

    expect(document.presence?.others().get("other")?.data).toEqual({
      name: "updated",
    });

    transport.emit({
      type: "presence_remove",
      id: "other",
    });

    expect(document.presence?.others().has("other")).toBe(false);
  });

  const createPresenceDocument = () => {
    const transport = new FakeTransport();
    const document = createClientDocument({
      primitive: TestPrimitive,
      transport,
      initialValue: makeValue("Base"),
      initialVersion: 1,
      presence: {
        primitive: TestPresencePrimitive,
      },
    });
    return { transport, document };
  };

  it("reflects local set() in self() synchronously, before any server echo", () => {
    const { transport, document } = createPresenceDocument();
    transport.emit({
      type: "presence_snapshot",
      selfId: "self-id",
      presences: {},
    });

    let changes = 0;
    document.presence?.subscribe({ onPresenceChange: () => changes++ });

    document.presence?.set({ name: "first" });
    document.presence?.set({ name: "second" });

    expect(document.presence?.self()).toEqual({ name: "second" });
    expect(document.presence?.all().get("self-id")?.data).toEqual({ name: "second" });
    expect(changes).toBe(2);
  });

  it("treats a lagging server echo of a local set as a no-op", () => {
    const { transport, document } = createPresenceDocument();
    transport.emit({
      type: "presence_snapshot",
      selfId: "self-id",
      presences: {},
    });

    document.presence?.set({ name: "first" });
    document.presence?.set({ name: "second" });

    transport.emit({
      type: "presence_update",
      id: "self-id",
      data: makePresenceValue("first"),
    });
    expect(document.presence?.self()).toEqual({ name: "second" });

    transport.emit({
      type: "presence_update",
      id: "self-id",
      data: makePresenceValue("second"),
    });
    expect(document.presence?.self()).toEqual({ name: "second" });
  });

  it("keeps reporting a buffered local set via self() before the connection id is known", () => {
    const { transport, document } = createPresenceDocument();

    document.presence?.set({ name: "offline" });
    expect(document.presence?.selfId()).toBeUndefined();
    expect(document.presence?.self()).toEqual({ name: "offline" });

    // The first snapshot of a fresh connection cannot contain self yet — the
    // local value must materialize under the new connection id regardless.
    transport.emit({
      type: "presence_snapshot",
      selfId: "self-id",
      presences: {
        other: { data: makePresenceValue("other") },
      },
    });

    expect(document.presence?.self()).toEqual({ name: "offline" });
    expect(document.presence?.all().get("self-id")?.data).toEqual({ name: "offline" });
    expect(document.presence?.others().has("self-id")).toBe(false);
  });

  it("clear() removes the local presence synchronously and survives stale remove echoes", () => {
    const { transport, document } = createPresenceDocument();
    transport.emit({
      type: "presence_snapshot",
      selfId: "self-id",
      presences: {},
    });

    document.presence?.set({ name: "visible" });
    document.presence?.clear();
    expect(document.presence?.self()).toBeUndefined();
    expect(document.presence?.all().has("self-id")).toBe(false);

    // Re-set locally; the late server echo of the earlier clear must not wipe it.
    document.presence?.set({ name: "again" });
    transport.emit({ type: "presence_remove", id: "self-id" });
    expect(document.presence?.self()).toEqual({ name: "again" });
    expect(document.presence?.all().get("self-id")?.data).toEqual({ name: "again" });
  });
});
