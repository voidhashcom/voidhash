/**
 * The guest-side driver for a LIVE panel sandbox, extracted from the srcdoc as a
 * testable module. jsdom cannot execute an iframe's `srcdoc` scripts, so the
 * real isolation bootstrap ({@link ./panel-sandbox-document}) is a thin adapter:
 * it installs the require shim + rAF plumbing, then delegates every host message
 * to a {@link PanelSandboxDriver} built here. This module is verified directly
 * (init/update/event/ping/unmount handling, rAF tree coalescing, error phases)
 * with a fake session + fake `post`.
 *
 * The driver owns exactly one {@link PanelSession}. It never trusts the compiled
 * author module: a load failure, a definition without a `panel` function, or a
 * render/effect throw all become a `panel/error` posted back with the right
 * `phase`. The host re-validates every emitted tree.
 */
import type { PanelSession, PanelSessionInputs } from "@voidhash/paywalls/panel";

import { PANEL_SANDBOX_PROTOCOL, type GuestMessage, type HostMessage } from "./sandbox-messages";

/**
 * The minimal session surface the driver drives, structurally satisfied by the
 * OSS {@link PanelSession}. Kept local so the driver tests can supply a fake
 * without pulling the reconciler into jsdom.
 */
export interface PanelSandboxSession {
  update(inputs: PanelSessionInputs): void;
  dispatchEvent(nodeId: number, name: string, args: ReadonlyArray<unknown>): boolean;
  dispose(): void;
}

/** How the driver mounts a session from a compiled module + initial inputs. */
export interface PanelSandboxSessionFactoryOptions {
  /** The compiled author module (CJS source string). */
  readonly compiledCode: string;
  /** The initial host input snapshot. */
  readonly initialInputs: PanelSessionInputs;
  /** rAF-coalesced tree emission: the driver forwards this to `panel/tree`. */
  readonly onTree: (revision: number, tree: unknown) => void;
  /** A render/effect error: the driver forwards this as `panel/error{render}`. */
  readonly onError: (message: string) => void;
  /** Author `ctx.props.*` writes: the driver forwards these as `panel/intent`. */
  readonly onIntents: (intents: ReadonlyArray<unknown>) => void;
}

/**
 * Loads the compiled module, resolves its panel function, and mounts a session.
 * Returns `null` when the module has no `panel` (an author-error the driver
 * turns into `panel/error{init}`). Throws on a module load / evaluation failure
 * (also `panel/error{init}`). The real implementation lives in the srcdoc (it
 * needs the guest global + require shim); tests supply a fake.
 */
export type PanelSandboxSessionFactory = (
  options: PanelSandboxSessionFactoryOptions,
) => PanelSandboxSession | null;

/** Schedules a callback on the next animation frame; returns a cancel handle. */
export interface RafScheduler {
  request(callback: () => void): number;
  cancel(handle: number): void;
}

/** Everything the driver needs from its host environment (injected for tests). */
export interface PanelSandboxDriverDeps {
  /** The active `sessionId` — the driver ignores messages that don't match. */
  readonly sessionId: string;
  /** Posts a guest→host message (real impl: `parent.postMessage(m, "*")`). */
  readonly post: (message: GuestMessage) => void;
  /** Mounts a session from a compiled module. */
  readonly createSession: PanelSandboxSessionFactory;
  /** rAF used to coalesce tree emissions (real rAF in the live document). */
  readonly raf: RafScheduler;
}

/** The guest driver handle: feed it decoded host messages, dispose to tear down. */
export interface PanelSandboxDriver {
  /** Handles one already-decoded host message (wrong sessionId → ignored). */
  handle(message: HostMessage): void;
  /** Tears the session down and releases rAF; idempotent. */
  dispose(): void;
}

/**
 * Builds the guest driver. The driver posts a `panel/ready` only from the real
 * bootstrap (after the global is installed); mounting happens on the first
 * `panel/init`. All guest→host messages carry the driver's `sessionId`, so a
 * host that regenerated the id (restart) drops everything from the old driver.
 */
export const createPanelSandboxDriver = (deps: PanelSandboxDriverDeps): PanelSandboxDriver => {
  const { sessionId, post, createSession, raf } = deps;

  let session: PanelSandboxSession | null = null;
  let disposed = false;

  // rAF tree coalescing: the OSS session already microtask-coalesces its
  // emissions, but a burst of commits within one frame would still post one
  // `panel/tree` each. We hold only the LATEST (revision, tree) and post once
  // per frame — latest-revision-wins, so the host never renders a stale tree.
  let pendingTree: { revision: number; tree: unknown } | null = null;
  let rafHandle: number | null = null;

  const emit = (message: GuestMessage): void => {
    if (disposed) return;
    post(message);
  };

  const flushTree = (): void => {
    rafHandle = null;
    if (disposed || pendingTree === null) return;
    const { revision, tree } = pendingTree;
    pendingTree = null;
    emit({ protocol: PANEL_SANDBOX_PROTOCOL, sessionId, type: "panel/tree", revision, tree });
  };

  const scheduleTree = (revision: number, tree: unknown): void => {
    if (disposed) return;
    // Latest wins: a newer revision replaces an unflushed older one.
    if (pendingTree === null || revision >= pendingTree.revision) {
      pendingTree = { revision, tree };
    }
    if (rafHandle === null) {
      rafHandle = raf.request(flushTree);
    }
  };

  const cancelTree = (): void => {
    if (rafHandle !== null) {
      raf.cancel(rafHandle);
      rafHandle = null;
    }
    pendingTree = null;
  };

  const disposeSession = (): void => {
    cancelTree();
    if (session !== null) {
      try {
        session.dispose();
      } catch {
        // A dispose throw must not wedge the driver; the iframe is discarded.
      }
      session = null;
    }
  };

  const postError = (phase: "init" | "render" | "runtime", message: string): void => {
    emit({ protocol: PANEL_SANDBOX_PROTOCOL, sessionId, type: "panel/error", phase, message });
  };

  const errorText = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);

  const onInit = (compiledCode: string, inputs: unknown): void => {
    // A second init on a live driver replaces the session (a host restart uses a
    // fresh driver, but guard defensively so we never leak a session).
    disposeSession();
    let mounted: PanelSandboxSession | null;
    try {
      mounted = createSession({
        compiledCode,
        initialInputs: inputs as PanelSessionInputs,
        onTree: scheduleTree,
        onError: (message) => postError("render", message),
        onIntents: (intents) =>
          emit({ protocol: PANEL_SANDBOX_PROTOCOL, sessionId, type: "panel/intent", intents }),
      });
    } catch (error) {
      postError("init", errorText(error));
      return;
    }
    if (mounted === null) {
      postError("init", "This component does not declare a custom panel.");
      return;
    }
    session = mounted;
  };

  const onUpdate = (inputs: unknown): void => {
    if (session === null) return;
    try {
      session.update(inputs as PanelSessionInputs);
    } catch (error) {
      postError("runtime", errorText(error));
    }
  };

  const onEvent = (nodeId: number, name: string, args: ReadonlyArray<unknown>): void => {
    if (session === null) return;
    try {
      session.dispatchEvent(nodeId, name, args);
    } catch (error) {
      postError("runtime", errorText(error));
    }
  };

  const onPing = (seq: number): void => {
    // Answered immediately (no rAF) — a pong is the event-loop liveness probe;
    // deferring it would defeat the host's heartbeat watchdog.
    emit({ protocol: PANEL_SANDBOX_PROTOCOL, sessionId, type: "panel/pong", seq });
  };

  return {
    handle(message: HostMessage) {
      if (disposed || message.sessionId !== sessionId) return;
      switch (message.type) {
        case "panel/init":
          onInit(message.compiledCode, message.inputs);
          return;
        case "panel/update":
          onUpdate(message.inputs);
          return;
        case "panel/event":
          onEvent(message.nodeId, message.name, message.args);
          return;
        case "panel/ping":
          onPing(message.seq);
          return;
        case "panel/unmount":
          disposeSession();
          return;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      disposeSession();
    },
  };
};

/**
 * The real session factory used by the srcdoc: evaluates the compiled module
 * through the guest global's require shim, describes it, and (when it has a
 * panel) mounts a {@link PanelSession} wired to the driver's callbacks. Exposed
 * as a named factory so the bootstrap stays a thin adapter and the wiring is
 * inspectable. Runs ONLY inside the sandbox (needs the guest global).
 *
 * `guest` is the OSS sandbox IIFE global (`window.__VOIDHASH_PAYWALLS_SANDBOX__`).
 */
export interface PanelSandboxGuestGlobal {
  readonly modules: Readonly<Record<string, unknown>>;
  describeComponent(definition: unknown): { readonly hasPanel: boolean };
  createPanelSession(options: {
    render: unknown;
    initialInputs: PanelSessionInputs;
    intentSink?: (intents: ReadonlyArray<unknown>) => void;
    callbacks: {
      onTree: (tree: unknown, revision: number) => void;
      onError: (error: unknown) => void;
    };
  }): PanelSession;
}

/**
 * Loads a compiled CJS module through the guest global's require shim and
 * returns the exported component definition (default or named `definition`).
 * Throws when the module has no valid definition.
 */
export const loadCompiledDefinition = (
  guest: PanelSandboxGuestGlobal,
  compiledCode: string,
): { readonly panel?: unknown } => {
  const requireShim = (specifier: string): unknown => {
    const mod = guest.modules[specifier];
    if (mod === undefined) {
      throw new Error(`Cannot find module '${specifier}'`);
    }
    return mod;
  };
  const moduleObj: { exports: Record<string, unknown> } = { exports: {} };
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const factory = new Function("require", "module", "exports", compiledCode) as (
    require: (s: string) => unknown,
    module: { exports: Record<string, unknown> },
    exports: Record<string, unknown>,
  ) => void;
  factory(requireShim, moduleObj, moduleObj.exports);
  const definition = (moduleObj.exports.default ?? moduleObj.exports.definition) as
    | { readonly panel?: unknown }
    | undefined;
  if (!definition || typeof (definition as { render?: unknown }).render !== "function") {
    throw new Error("Component must export a default defineComponent({ ... })");
  }
  return definition;
};

/**
 * Builds the real {@link PanelSandboxSessionFactory} bound to a guest global.
 * Used by the srcdoc bootstrap. Returns `null` when the loaded definition has no
 * panel function (the driver turns that into `panel/error{init}`).
 */
export const makeGuestSessionFactory =
  (guest: PanelSandboxGuestGlobal): PanelSandboxSessionFactory =>
  (options) => {
    const definition = loadCompiledDefinition(guest, options.compiledCode);
    if (!guest.describeComponent(definition).hasPanel || typeof definition.panel !== "function") {
      return null;
    }
    const session = guest.createPanelSession({
      render: definition.panel,
      initialInputs: options.initialInputs,
      intentSink: options.onIntents,
      callbacks: {
        onTree: (tree, revision) => options.onTree(revision, tree),
        onError: (error) =>
          options.onError(error instanceof Error ? error.message : String(error)),
      },
    });
    return session;
  };
