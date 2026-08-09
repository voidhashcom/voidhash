/**
 * The uniform transport contract the host uses to drive ONE panel session,
 * whatever engine backs it. A built-in panel runs the OSS reconciler in-process
 * (trusted, synchronous — {@link ./in-process-transport}); a code-component
 * panel will run it inside a sandboxed iframe (Phase 3 — a typed seam only for
 * now). Both expose exactly this surface, so the renderer
 * ({@link ./host-renderer}) and the gesture controller
 * ({@link ./gesture-controller}) never branch on the engine.
 *
 * The `subscribe`/`getSnapshot` pair is `useSyncExternalStore`-compatible: the
 * snapshot's object identity changes only on a REAL change (a new tree, a status
 * transition), so `PanelTreeView` re-renders precisely when the panel does.
 */
import type { PanelTree } from "./schema";

/** A fired panel event, addressed to a live node's current handler. */
export interface PanelDispatchEvent {
  /** The reconciler instance id of the node whose handler fires. */
  readonly nodeId: number;
  /** The event name (must be in the node type's wire allowlist). */
  readonly name: string;
  /** Positional arguments forwarded to the handler. */
  readonly args: ReadonlyArray<unknown>;
}

/**
 * The renderer-facing view of a transport at a point in time. Object identity is
 * stable between real changes so `useSyncExternalStore` never tears or loops.
 *
 * - `loading` — no tree has been emitted yet (initial mount, or a restart in
 *   flight).
 * - `ready` — a decoded, host-trusted {@link PanelTree} is available.
 *   `revision` increments on every distinct emission (used for gesture-echo
 *   bookkeeping and debugging).
 * - `error` — the session failed. `restartable` gates whether the error chrome
 *   offers a Restart button (an in-process built-in drift is restartable; a
 *   dead sandbox may not be).
 */
export type PanelSnapshot =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly tree: PanelTree; readonly revision: number }
  | { readonly status: "error"; readonly message: string; readonly restartable: boolean };

/** Which engine backs a transport (used only for diagnostics/typed seams). */
export type PanelTransportKind = "in-process" | "sandbox";

/**
 * The one handle the host drives a panel session through. Implementations own a
 * single session; call {@link dispose} to release it.
 */
export interface PanelTransport {
  /** The engine backing this transport. */
  readonly kind: PanelTransportKind;
  /** Pushes a fresh host input snapshot; the session re-renders and re-emits. */
  update(inputs: unknown): void;
  /** Dispatches a fired event to the live node's handler. */
  dispatch(event: PanelDispatchEvent): void;
  /**
   * Subscribes to snapshot changes. Returns an unsubscribe function.
   * `useSyncExternalStore`-compatible: `cb` is called after every real change.
   */
  subscribe(cb: () => void): () => void;
  /** The current snapshot (stable identity between real changes). */
  getSnapshot(): PanelSnapshot;
  /** Tears the session down and mounts a fresh one from the same source. */
  restart(): void;
  /** Unmounts the session and releases all resources. */
  dispose(): void;
}
