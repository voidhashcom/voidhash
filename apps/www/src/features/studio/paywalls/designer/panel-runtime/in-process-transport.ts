/**
 * The trusted, synchronous {@link PanelTransport} that backs built-in designer
 * panels. It wraps the OSS {@link createPanelSession} directly: the reconciler
 * runs IN THIS PROCESS, so a definition's event handlers call commander actions
 * synchronously and the OSS session guarantees each `setState` is flushed and
 * the resulting tree emitted BEFORE `dispatchEvent` returns — which is what
 * makes 60fps in-process drags possible without a round-trip.
 *
 * On every emission (dev only, `import.meta.env.DEV`) the tree is re-asserted
 * against the host schema gate ({@link decodePanelTreeDev}). A failed assert
 * means a built-in definition drifted from the wire contract — the host logs
 * loudly and surfaces a restartable error snapshot instead of rendering a shape
 * the kit adapters don't expect. In production the emitted tree is trusted as-is
 * (no per-frame decode cost).
 */
import {
  createPanelSession,
  type PanelSession,
  type PanelSessionInputs,
  type CreatePanelSessionOptions,
} from "@voidhash/paywalls/panel";
import { Effect } from "effect";

import { decodePanelTreeDev, type PanelTree } from "./schema";
import type { PanelDispatchEvent, PanelSnapshot, PanelTransport } from "./transport";

/** The panel definition function a built-in transport renders. */
export type PanelRender = CreatePanelSessionOptions["render"];

/** The provider-wrap seam a built-in host uses (store context + host services). */
export type PanelWrap = CreatePanelSessionOptions["wrap"];

/** The intent sink a built-in host reduces synchronously (unused for now). */
export type PanelIntentSink = CreatePanelSessionOptions["intentSink"];

/** Configuration for {@link createInProcessTransport}. */
export interface InProcessTransportOptions {
  /** The panel definition: `(ctx) => ReactNode`. */
  readonly render: PanelRender;
  /** The initial host input snapshot. */
  readonly initialInputs: PanelSessionInputs;
  /** Re-wraps providers inside the reconciler root (store context, host services). */
  readonly wrap?: PanelWrap;
  /** Where the definition's `ctx.props.*` writes go (built-ins reduce synchronously). */
  readonly intentSink?: PanelIntentSink;
  /** Reports a definition render/effect error to the host (before the error snapshot). */
  readonly onError?: (error: unknown) => void;
}

const isDev = import.meta.env.DEV;

const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Creates an in-process transport for a built-in panel definition. Owns exactly
 * one OSS session at a time; {@link PanelTransport.restart} tears the current
 * session down and mounts a fresh one from the same options (definition + wrap +
 * the LATEST inputs pushed via `update`).
 */
export const createInProcessTransport = (
  options: InProcessTransportOptions,
): PanelTransport => {
  const listeners = new Set<() => void>();
  let snapshot: PanelSnapshot = { status: "loading" };
  let session: PanelSession | null = null;
  let inputs: PanelSessionInputs = options.initialInputs;
  let disposed = false;

  const notify = (): void => {
    for (const listener of listeners) listener();
  };

  const setSnapshot = (next: PanelSnapshot): void => {
    snapshot = next;
    notify();
  };

  /**
   * Handles one emitted tree: in dev, assert it against the host gate and fail
   * loudly on drift; otherwise publish it as the ready snapshot. Each accepted
   * emission is a new object, so `useSyncExternalStore` re-renders exactly once.
   */
  const acceptTree = (tree: PanelTree, revision: number): void => {
    if (disposed) return;
    if (isDev) {
      const decoded = decodePanelTreeDev(tree);
      if (!decoded.ok) {
        // A built-in definition drifted from the wire format. This is a
        // developer error, not a runtime one — surface it loudly.
        // eslint-disable-next-line no-console
        console.error(
          `[panel-runtime] built-in panel emitted an invalid tree (revision ${revision}): ${decoded.error}`,
        );
        setSnapshot({
          status: "error",
          message: `Panel definition drifted from the wire format: ${decoded.error}`,
          restartable: true,
        });
        return;
      }
      setSnapshot({ status: "ready", tree: decoded.tree, revision });
      return;
    }
    setSnapshot({ status: "ready", tree, revision });
  };

  const start = (): void => {
    const created = Effect.runSync(
      Effect.try({
        try: () =>
          createPanelSession({
            render: options.render,
            initialInputs: inputs,
            intentSink: options.intentSink,
            wrap: options.wrap,
            callbacks: {
              onTree: acceptTree,
              onError: (error) => {
                options.onError?.(error);
              },
            },
          }),
        catch: (error) => error,
      }).pipe(
        Effect.catch((error) =>
          Effect.sync((): PanelSession | null => {
            options.onError?.(error);
            setSnapshot({
              status: "error",
              message: `Panel failed to start: ${errorText(error)}`,
              restartable: true,
            });
            return null;
          }),
        ),
      ),
    );
    if (created === null) {
      return;
    }
    session = created;
    // The session emits the first tree synchronously during construction, so
    // `getTree()` is already valid; publish it (dev-asserted) as the ready snapshot.
    acceptTree(session.getTree(), 0);
  };

  const stop = (): void => {
    session?.dispose();
    session = null;
  };

  start();

  return {
    kind: "in-process",
    update(next: unknown) {
      if (disposed || session === null) return;
      inputs = next as PanelSessionInputs;
      session.update(inputs);
    },
    dispatch(event: PanelDispatchEvent) {
      if (disposed || session === null) return;
      session.dispatchEvent(event.nodeId, event.name, event.args);
    },
    subscribe(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    getSnapshot() {
      return snapshot;
    },
    restart() {
      if (disposed) return;
      stop();
      setSnapshot({ status: "loading" });
      start();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      listeners.clear();
    },
  };
};
