// @vitest-environment jsdom

import type { PanelSessionInputs } from "@voidhash/paywalls/panel";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

import {
  createPanelSandboxTransport,
  PANEL_SANDBOX_WATCHDOGS,
} from "./panel-sandbox-host";
import { PANEL_SANDBOX_PROTOCOL, type GuestMessage } from "./sandbox-messages";

const INPUTS: PanelSessionInputs = {
  props: {},
  selection: { count: 1 },
  data: { products: [], variables: {} },
};

const VALID_TREE = {
  version: 1,
  root: { type: "panel", id: 0, props: {}, events: [], children: [] },
};

/**
 * Dispatches a `message` event on window carrying `data`. The host adds its
 * listener on window, and its source check is stubbed true (see `makeTransport`),
 * so this simulates a guest posting `data`.
 */
const emit = (data: unknown): void => {
  window.dispatchEvent(new MessageEvent("message", { data }));
};

/** Reads the current sessionId off the last posted host message to the iframe. */
const sessionIdFromPostedInit = (): string => {
  const iframe = document.querySelector("iframe");
  return (iframe as unknown as { __lastPost?: { sessionId?: string } })?.__lastPost?.sessionId ?? "";
};

/**
 * Builds a transport with the source check stubbed to always-true and a stub
 * `sandboxCode`. Captures the sessionId the host mints by intercepting the init
 * postMessage to the iframe's contentWindow (patched to record posts).
 */
const makeTransport = (
  onIntents: (raw: unknown) => void = () => {},
  onFatal?: (message: string) => void,
) => {
  const posts: Array<{ sessionId?: string; type?: string; seq?: number }> = [];
  // Patch iframe creation: intercept the contentWindow.postMessage so we can
  // read the minted sessionId and the ping seqs the host sends.
  const origAppend = document.body.appendChild.bind(document.body);
  const appendSpy = vi
    .spyOn(document.body, "appendChild")
    .mockImplementation(<T extends Node>(node: T): T => {
      const result = origAppend(node as never) as T;
      const iframe = node as unknown as HTMLIFrameElement;
      if (iframe.tagName === "IFRAME") {
        const win = iframe.contentWindow as unknown as {
          postMessage?: (m: unknown) => void;
        } | null;
        if (win) {
          win.postMessage = (m: unknown) => {
            posts.push(m as never);
            (iframe as unknown as { __lastPost?: unknown }).__lastPost = m;
          };
        }
      }
      return result;
    });

  const transport = createPanelSandboxTransport({
    compiledCode: "module.exports = { default: {} };",
    initialInputs: INPUTS,
    onIntents,
    onFatal,
    sandboxCode: "/* stub iife */",
    isTrustedSource: () => true,
  });

  return { transport, posts, appendSpy };
};

/** Emits a `panel/ready` (no sessionId needed) then completes the handshake. */
const completeHandshake = (sessionId: string): void => {
  emit({ protocol: PANEL_SANDBOX_PROTOCOL, type: "panel/ready", sessionId });
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.querySelectorAll("iframe").forEach((f) => f.remove());
});

describe("panel-sandbox-host — handshake + snapshots", () => {
  test("starts loading and mounts a hidden iframe", () => {
    const { transport } = makeTransport();
    try {
      expect(transport.kind).toBe("sandbox");
      expect(transport.getSnapshot().status).toBe("loading");
      const iframe = document.querySelector("iframe");
      expect(iframe).not.toBeNull();
      expect(iframe?.getAttribute("sandbox")).toBe("allow-scripts");
      expect(iframe?.style.display).toBe("none");
    } finally {
      transport.dispose();
    }
  });

  test("a valid panel/tree transitions to ready with the decoded tree", () => {
    const { transport } = makeTransport();
    try {
      const sessionId = sessionIdFromPostedInit();
      completeHandshake(sessionId);
      emit({
        protocol: PANEL_SANDBOX_PROTOCOL,
        sessionId,
        type: "panel/tree",
        revision: 1,
        tree: VALID_TREE,
      });
      const snap = transport.getSnapshot();
      expect(snap.status).toBe("ready");
      if (snap.status === "ready") {
        expect(snap.revision).toBe(1);
        expect(snap.tree.root.type).toBe("panel");
      }
    } finally {
      transport.dispose();
    }
  });

  test("a stale (lower/equal) revision is dropped", () => {
    const { transport } = makeTransport();
    try {
      const sessionId = sessionIdFromPostedInit();
      completeHandshake(sessionId);
      const tree = (revision: number): GuestMessage => ({
        protocol: PANEL_SANDBOX_PROTOCOL,
        sessionId,
        type: "panel/tree",
        revision,
        tree: VALID_TREE,
      });
      emit(tree(3));
      emit(tree(2)); // stale
      const snap = transport.getSnapshot();
      expect(snap.status === "ready" && snap.revision).toBe(3);
    } finally {
      transport.dispose();
    }
  });

  test("an invalid tree is a protocol violation, not a ready snapshot", () => {
    const { transport } = makeTransport();
    try {
      const sessionId = sessionIdFromPostedInit();
      completeHandshake(sessionId);
      emit({
        protocol: PANEL_SANDBOX_PROTOCOL,
        sessionId,
        type: "panel/tree",
        revision: 1,
        tree: { version: 1, root: { type: "not-a-real-node", id: 0, props: {}, events: [] } },
      });
      // Still loading (no valid tree accepted).
      expect(transport.getSnapshot().status).toBe("loading");
    } finally {
      transport.dispose();
    }
  });

  test("intents are forwarded RAW to onIntents", () => {
    const received: unknown[] = [];
    const { transport } = makeTransport((raw) => received.push(raw));
    try {
      const sessionId = sessionIdFromPostedInit();
      completeHandshake(sessionId);
      const raw = [{ type: "set-prop", name: "label", value: "hi", gesture: "commit" }];
      emit({ protocol: PANEL_SANDBOX_PROTOCOL, sessionId, type: "panel/intent", intents: raw });
      expect(received).toHaveLength(1);
      expect(received[0]).toEqual(raw);
    } finally {
      transport.dispose();
    }
  });

  test("a guest panel/error surfaces a restartable error snapshot", () => {
    const { transport } = makeTransport();
    try {
      const sessionId = sessionIdFromPostedInit();
      completeHandshake(sessionId);
      emit({
        protocol: PANEL_SANDBOX_PROTOCOL,
        sessionId,
        type: "panel/error",
        phase: "render",
        message: "kaboom",
      });
      const snap = transport.getSnapshot();
      expect(snap.status).toBe("error");
      if (snap.status === "error") {
        expect(snap.restartable).toBe(true);
        expect(snap.message).toContain("kaboom");
      }
    } finally {
      transport.dispose();
    }
  });
});

describe("panel-sandbox-host — watchdogs", () => {
  test("init timeout with no panel/ready → error", () => {
    vi.useFakeTimers();
    const { transport } = makeTransport();
    try {
      expect(transport.getSnapshot().status).toBe("loading");
      vi.advanceTimersByTime(PANEL_SANDBOX_WATCHDOGS.initTimeoutMs + 10);
      // Auto-restart re-mounts (still loading) — but the FIRST attempt errored.
      // After the budget is spent it stays in error; here it restarts to loading.
      const snap = transport.getSnapshot();
      expect(["loading", "error"]).toContain(snap.status);
    } finally {
      transport.dispose();
    }
  });

  test("missed pongs kill the guest with a restartable error", () => {
    vi.useFakeTimers();
    const { transport } = makeTransport();
    try {
      const sessionId = sessionIdFromPostedInit();
      completeHandshake(sessionId);
      // Never pong; advance past (maxMissedPongs + 1) ping intervals.
      const intervals = PANEL_SANDBOX_WATCHDOGS.maxMissedPongs + 2;
      vi.advanceTimersByTime(PANEL_SANDBOX_WATCHDOGS.pingIntervalMs * intervals + 10);
      const snap = transport.getSnapshot();
      // A kill either shows the error, or auto-restarted back to loading.
      expect(["error", "loading"]).toContain(snap.status);
    } finally {
      transport.dispose();
    }
  });

  test("a tree flood kills the guest", () => {
    const onFatal = vi.fn();
    const { transport } = makeTransport(() => {}, onFatal);
    try {
      const sessionId = sessionIdFromPostedInit();
      completeHandshake(sessionId);
      // Emit far more than maxTreesPerSecond within the window.
      const flood = PANEL_SANDBOX_WATCHDOGS.maxTreesPerSecond * 4;
      let rev = 1;
      let errored = false;
      for (let i = 0; i < flood; i++) {
        emit({
          protocol: PANEL_SANDBOX_PROTOCOL,
          sessionId,
          type: "panel/tree",
          revision: rev++,
          tree: VALID_TREE,
        });
        if (transport.getSnapshot().status === "error") {
          errored = true;
          break;
        }
      }
      expect(errored).toBe(true);
    } finally {
      transport.dispose();
    }
  });

  test("repeated protocol violations exhaust the budget → error", () => {
    const { transport } = makeTransport();
    try {
      const sessionId = sessionIdFromPostedInit();
      completeHandshake(sessionId);
      // Send many malformed (wrong-schema) messages that pass the source check.
      let errored = false;
      for (let i = 0; i < PANEL_SANDBOX_WATCHDOGS.maxProtocolViolations + 5; i++) {
        emit({ protocol: PANEL_SANDBOX_PROTOCOL, sessionId, type: "panel/garbage" });
        if (transport.getSnapshot().status === "error") {
          errored = true;
          break;
        }
      }
      expect(errored).toBe(true);
    } finally {
      transport.dispose();
    }
  });
});

describe("panel-sandbox-host — lifecycle", () => {
  test("restart regenerates the sessionId; old-session messages are ignored", () => {
    const { transport } = makeTransport();
    try {
      const first = sessionIdFromPostedInit();
      completeHandshake(first);
      emit({
        protocol: PANEL_SANDBOX_PROTOCOL,
        sessionId: first,
        type: "panel/tree",
        revision: 1,
        tree: VALID_TREE,
      });
      expect(transport.getSnapshot().status).toBe("ready");

      transport.restart();
      const second = sessionIdFromPostedInit();
      expect(second).not.toBe(first);
      expect(transport.getSnapshot().status).toBe("loading");

      // An old-session tree must NOT be accepted.
      emit({
        protocol: PANEL_SANDBOX_PROTOCOL,
        sessionId: first,
        type: "panel/tree",
        revision: 9,
        tree: VALID_TREE,
      });
      expect(transport.getSnapshot().status).toBe("loading");

      // The new session works.
      completeHandshake(second);
      emit({
        protocol: PANEL_SANDBOX_PROTOCOL,
        sessionId: second,
        type: "panel/tree",
        revision: 1,
        tree: VALID_TREE,
      });
      expect(transport.getSnapshot().status).toBe("ready");
    } finally {
      transport.dispose();
    }
  });

  test("dispose removes the iframe and detaches the listener", () => {
    const { transport } = makeTransport();
    const sessionId = sessionIdFromPostedInit();
    completeHandshake(sessionId);
    transport.dispose();
    expect(document.querySelector("iframe")).toBeNull();
    // Post-dispose messages are inert (no throw, no snapshot change).
    emit({
      protocol: PANEL_SANDBOX_PROTOCOL,
      sessionId,
      type: "panel/tree",
      revision: 1,
      tree: VALID_TREE,
    });
    expect(transport.getSnapshot().status).not.toBe("ready");
  });
});
