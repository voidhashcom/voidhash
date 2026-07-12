import type { PanelSessionInputs } from "@voidhash/paywalls/panel";
import { describe, expect, test } from "vite-plus/test";

import {
  createPanelSandboxDriver,
  type PanelSandboxSession,
  type PanelSandboxSessionFactory,
  type PanelSandboxSessionFactoryOptions,
  type RafScheduler,
} from "./panel-sandbox-driver";
import { PANEL_SANDBOX_PROTOCOL, type GuestMessage, type HostMessage } from "./sandbox-messages";

const SID = "sess-1";
const INPUTS: PanelSessionInputs = {
  props: {},
  selection: { count: 1 },
  data: { products: [], variables: {} },
};

const initMsg = (compiledCode = "code", sessionId = SID): HostMessage => ({
  protocol: PANEL_SANDBOX_PROTOCOL,
  sessionId,
  type: "panel/init",
  compiledCode,
  inputs: INPUTS,
});

/** A rAF that captures the callback so tests can flush frames deterministically. */
const makeRaf = (): RafScheduler & { flush: () => void; pending: () => number } => {
  const callbacks = new Map<number, () => void>();
  let next = 1;
  return {
    request(cb) {
      const id = next++;
      callbacks.set(id, cb);
      return id;
    },
    cancel(id) {
      callbacks.delete(id);
    },
    flush() {
      const snapshot = [...callbacks.values()];
      callbacks.clear();
      for (const cb of snapshot) cb();
    },
    pending() {
      return callbacks.size;
    },
  };
};

interface FakeSession extends PanelSandboxSession {
  updates: PanelSessionInputs[];
  events: Array<{ nodeId: number; name: string; args: ReadonlyArray<unknown> }>;
  disposed: boolean;
  emitTree: (revision: number, tree: unknown) => void;
  emitError: (message: string) => void;
  emitIntents: (intents: ReadonlyArray<unknown>) => void;
}

/**
 * Builds a driver with a fake session factory. `factory` decides what the mount
 * returns (a fake session, null for "no panel", or throws). Returns the driver,
 * the posted messages, the rAF, and a getter for the live fake session.
 */
const setup = (opts?: {
  sessionId?: string;
  factory?: PanelSandboxSessionFactory;
}) => {
  const posted: GuestMessage[] = [];
  const raf = makeRaf();
  let live: FakeSession | null = null;

  const defaultFactory: PanelSandboxSessionFactory = (
    o: PanelSandboxSessionFactoryOptions,
  ) => {
    const session: FakeSession = {
      updates: [],
      events: [],
      disposed: false,
      update(inputs) {
        this.updates.push(inputs);
      },
      dispatchEvent(nodeId, name, args) {
        this.events.push({ nodeId, name, args });
        return true;
      },
      dispose() {
        this.disposed = true;
      },
      emitTree: (revision, tree) => o.onTree(revision, tree),
      emitError: (message) => o.onError(message),
      emitIntents: (intents) => o.onIntents(intents),
    };
    live = session;
    return session;
  };

  const driver = createPanelSandboxDriver({
    sessionId: opts?.sessionId ?? SID,
    post: (m) => posted.push(m),
    createSession: opts?.factory ?? defaultFactory,
    raf,
  });

  return { driver, posted, raf, session: () => live };
};

describe("panel-sandbox-driver", () => {
  test("init mounts a session; update/event drive it", () => {
    const { driver, session } = setup();
    driver.handle(initMsg());
    expect(session()).not.toBeNull();

    driver.handle({
      protocol: PANEL_SANDBOX_PROTOCOL,
      sessionId: SID,
      type: "panel/update",
      inputs: INPUTS,
    });
    expect(session()?.updates.length).toBe(1);

    driver.handle({
      protocol: PANEL_SANDBOX_PROTOCOL,
      sessionId: SID,
      type: "panel/event",
      nodeId: 4,
      name: "onClick",
      args: [1, 2],
    });
    expect(session()?.events).toEqual([{ nodeId: 4, name: "onClick", args: [1, 2] }]);
  });

  test("tree emissions are rAF-coalesced, latest-revision-wins", () => {
    const { driver, posted, raf, session } = setup();
    driver.handle(initMsg());

    session()?.emitTree(1, { a: 1 });
    session()?.emitTree(2, { a: 2 });
    session()?.emitTree(3, { a: 3 });
    // Nothing posted until the frame flushes.
    expect(posted.filter((m) => m.type === "panel/tree")).toHaveLength(0);
    expect(raf.pending()).toBe(1);

    raf.flush();
    const trees = posted.filter((m) => m.type === "panel/tree");
    expect(trees).toHaveLength(1);
    expect(trees[0]).toMatchObject({ revision: 3, tree: { a: 3 } });
  });

  test("ping is answered immediately with a matching pong (no rAF)", () => {
    const { driver, posted } = setup();
    driver.handle(initMsg());
    driver.handle({
      protocol: PANEL_SANDBOX_PROTOCOL,
      sessionId: SID,
      type: "panel/ping",
      seq: 99,
    });
    expect(posted.find((m) => m.type === "panel/pong")).toMatchObject({ seq: 99 });
  });

  test("intents are forwarded as a panel/intent message", () => {
    const { driver, posted, session } = setup();
    driver.handle(initMsg());
    session()?.emitIntents([{ type: "reset-prop", name: "x" }]);
    const intent = posted.find((m) => m.type === "panel/intent");
    expect(intent).toMatchObject({ intents: [{ type: "reset-prop", name: "x" }] });
  });

  test("a render error is posted as panel/error{render}", () => {
    const { driver, posted, session } = setup();
    driver.handle(initMsg());
    session()?.emitError("effect blew up");
    expect(posted.find((m) => m.type === "panel/error")).toMatchObject({
      phase: "render",
      message: "effect blew up",
    });
  });

  test("no panel → panel/error{init}", () => {
    const { driver, posted } = setup({ factory: () => null });
    driver.handle(initMsg());
    expect(posted.find((m) => m.type === "panel/error")).toMatchObject({ phase: "init" });
  });

  test("a factory throw → panel/error{init}", () => {
    const { driver, posted } = setup({
      factory: () => {
        throw new Error("load failed");
      },
    });
    driver.handle(initMsg());
    expect(posted.find((m) => m.type === "panel/error")).toMatchObject({
      phase: "init",
      message: "load failed",
    });
  });

  test("messages with a mismatched sessionId are ignored", () => {
    const { driver, session } = setup();
    driver.handle(initMsg());
    driver.handle({
      protocol: PANEL_SANDBOX_PROTOCOL,
      sessionId: "other",
      type: "panel/update",
      inputs: INPUTS,
    });
    expect(session()?.updates.length).toBe(0);
  });

  test("unmount disposes the session", () => {
    const { driver, session } = setup();
    driver.handle(initMsg());
    const s = session();
    driver.handle({ protocol: PANEL_SANDBOX_PROTOCOL, sessionId: SID, type: "panel/unmount" });
    expect(s?.disposed).toBe(true);
  });

  test("dispose tears down the session and stops posting", () => {
    const { driver, posted, session } = setup();
    driver.handle(initMsg());
    const s = session();
    driver.dispose();
    expect(s?.disposed).toBe(true);
    const before = posted.length;
    // Post-dispose messages are ignored.
    driver.handle({ protocol: PANEL_SANDBOX_PROTOCOL, sessionId: SID, type: "panel/ping", seq: 1 });
    expect(posted.length).toBe(before);
  });
});
