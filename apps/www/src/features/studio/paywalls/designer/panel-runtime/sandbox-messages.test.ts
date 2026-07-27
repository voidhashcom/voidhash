import { describe, expect, test } from "vite-plus/test";

import {
  decodeGuestMessage,
  decodeHostMessage,
  encodeGuestMessage,
  encodeHostMessage,
  PANEL_MESSAGE_BYTE_CAPS,
  PANEL_SANDBOX_PROTOCOL,
  type GuestMessage,
  type HostMessage,
} from "./sandbox-messages";

const SID = "panel-abc";

const HOST_MESSAGES: HostMessage[] = [
  {
    protocol: PANEL_SANDBOX_PROTOCOL,
    sessionId: SID,
    type: "panel/init",
    sandboxCode: "/* iife */",
    compiledCode: "module.exports = {};",
    inputs: { props: {}, selection: { count: 1 }, data: { products: [], variables: {} } },
  },
  {
    protocol: PANEL_SANDBOX_PROTOCOL,
    sessionId: SID,
    type: "panel/update",
    inputs: { props: { a: { kind: "string", value: "x" } } },
  },
  {
    protocol: PANEL_SANDBOX_PROTOCOL,
    sessionId: SID,
    type: "panel/event",
    nodeId: 3,
    name: "onChange",
    args: ["hello", 42, { nested: true }],
  },
  { protocol: PANEL_SANDBOX_PROTOCOL, sessionId: SID, type: "panel/ping", seq: 7 },
  { protocol: PANEL_SANDBOX_PROTOCOL, sessionId: SID, type: "panel/unmount" },
];

const GUEST_MESSAGES: GuestMessage[] = [
  { protocol: PANEL_SANDBOX_PROTOCOL, sessionId: SID, type: "panel/ready" },
  {
    protocol: PANEL_SANDBOX_PROTOCOL,
    sessionId: SID,
    type: "panel/tree",
    revision: 5,
    tree: { version: 1, root: { type: "panel", id: 0, props: {}, events: [], children: [] } },
  },
  {
    protocol: PANEL_SANDBOX_PROTOCOL,
    sessionId: SID,
    type: "panel/intent",
    intents: [{ type: "set-prop", name: "label", value: "hi", gesture: "commit" }],
  },
  { protocol: PANEL_SANDBOX_PROTOCOL, sessionId: SID, type: "panel/pong", seq: 7 },
  {
    protocol: PANEL_SANDBOX_PROTOCOL,
    sessionId: SID,
    type: "panel/error",
    phase: "render",
    message: "boom",
  },
];

describe("sandbox-messages — round trip", () => {
  test("every host→guest message round-trips through encode + decode", () => {
    for (const message of HOST_MESSAGES) {
      const wire = encodeHostMessage(message);
      const decoded = decodeHostMessage(wire);
      expect(decoded.ok).toBe(true);
      if (decoded.ok) {
        expect(decoded.message.type).toBe(message.type);
        expect(decoded.message).toEqual(message);
      }
    }
  });

  test("every guest→host message round-trips through encode + decode", () => {
    for (const message of GUEST_MESSAGES) {
      const wire = encodeGuestMessage(message);
      const decoded = decodeGuestMessage(wire);
      expect(decoded.ok).toBe(true);
      if (decoded.ok) {
        expect(decoded.message.type).toBe(message.type);
        expect(decoded.message).toEqual(message);
      }
    }
  });
});

describe("sandbox-messages — rejection", () => {
  test("a wrong protocol version is rejected", () => {
    const result = decodeGuestMessage({ protocol: 2, sessionId: SID, type: "panel/ready" });
    expect(result.ok).toBe(false);
  });

  test("a missing sessionId is rejected", () => {
    const result = decodeHostMessage({
      protocol: PANEL_SANDBOX_PROTOCOL,
      type: "panel/ping",
      seq: 1,
    });
    expect(result.ok).toBe(false);
  });

  test("an unknown message type is rejected", () => {
    const result = decodeGuestMessage({
      protocol: PANEL_SANDBOX_PROTOCOL,
      sessionId: SID,
      type: "panel/whoops",
    });
    expect(result.ok).toBe(false);
  });

  test("excess properties are rejected (strict decode)", () => {
    const result = decodeGuestMessage({
      protocol: PANEL_SANDBOX_PROTOCOL,
      sessionId: SID,
      type: "panel/pong",
      seq: 1,
      extra: "nope",
    });
    expect(result.ok).toBe(false);
  });

  test("a non-integer nodeId is rejected", () => {
    const result = decodeHostMessage({
      protocol: PANEL_SANDBOX_PROTOCOL,
      sessionId: SID,
      type: "panel/event",
      nodeId: 1.5,
      name: "x",
      args: [],
    });
    expect(result.ok).toBe(false);
  });

  test("an oversized tree message is rejected before decode", () => {
    const huge = "a".repeat(PANEL_MESSAGE_BYTE_CAPS.tree + 1000);
    const result = decodeGuestMessage({
      protocol: PANEL_SANDBOX_PROTOCOL,
      sessionId: SID,
      type: "panel/tree",
      revision: 1,
      tree: { blob: huge },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("exceeds");
  });

  test("an oversized intent message is rejected before decode", () => {
    const huge = "b".repeat(PANEL_MESSAGE_BYTE_CAPS.intent + 1000);
    const result = decodeGuestMessage({
      protocol: PANEL_SANDBOX_PROTOCOL,
      sessionId: SID,
      type: "panel/intent",
      intents: [{ blob: huge }],
    });
    expect(result.ok).toBe(false);
  });

  test("tree carries raw unknown tree (no value-level tree validation here)", () => {
    // The envelope decode passes even with a structurally-invalid tree — the
    // host re-validates with decodePanelTree. This locks that separation.
    const result = decodeGuestMessage({
      protocol: PANEL_SANDBOX_PROTOCOL,
      sessionId: SID,
      type: "panel/tree",
      revision: 1,
      tree: { garbage: true },
    });
    expect(result.ok).toBe(true);
  });

  test("null / non-object input is rejected", () => {
    expect(decodeGuestMessage(null).ok).toBe(false);
    expect(decodeGuestMessage("hi").ok).toBe(false);
    expect(decodeHostMessage(undefined).ok).toBe(false);
  });
});
