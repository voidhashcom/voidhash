/**
 * Uniform gesture bookkeeping shared by every {@link PanelTransport} engine, so
 * the renderer and the draft plumbing behave identically whether a panel runs
 * in-process or (Phase 3) in a sandbox.
 *
 * It owns two mechanisms:
 *
 * 1. GESTURE-LOCAL ECHO — while a gesture is active on node `N`, the kit input
 *    for `N` holds its own internal value mid-drag. Incoming tree revisions must
 *    apply everywhere EXCEPT `N`'s value props, or an echoed authoritative value
 *    (arriving a frame late from the sandbox) would fight the input's local
 *    state and cause a visible snap-back. The renderer routes every node's props
 *    through {@link PanelGestureController.filterNodeProps}: for the gesture node
 *    it returns the props frozen at gesture start (value props stay put; the
 *    node's own handlers still fire), for every other node it returns props
 *    unchanged. The authoritative values re-apply automatically at gesture end
 *    (the freeze is dropped and the next render reads the fresh tree). For the
 *    in-process transport authority is synchronous so the frozen and incoming
 *    values already match — the mechanism is a no-op there, but uniform.
 *
 * 2. DRAFT PAIRING — a designer "draft" batches a drag's intermediate writes
 *    into ONE undo entry (see `use-designer-draft.ts`). A sandbox panel emits
 *    `live` set-prop intents during a drag and a `gesture-commit`/`gesture-
 *    discard` at the end; this controller maps that intent stream onto a host
 *    draft via {@link PanelGestureController.attachDraftPairing}: the first
 *    `live` opens the draft, `gesture-commit` commits it, and `gesture-discard`,
 *    session death, a selection change, or 10s of inactivity discards it. Built-
 *    in panels don't use this path (they run draft logic in-process), so nothing
 *    calls it in production yet — it is built + unit-tested here for Phase 3.
 */

/** The three callbacks that pair a sandbox gesture-intent stream to a host draft. */
export interface DraftPairing {
  /** Opens a host draft (first `live` intent of a gesture). */
  begin(): void;
  /** Commits the open draft into one undo entry (`gesture-commit`). */
  commit(): void;
  /** Discards the open draft (explicit discard, death, selection change, timeout). */
  discard(): void;
}

/** The reason a draft was auto-discarded, surfaced for diagnostics/tests. */
export type DraftDiscardReason =
  | "gesture-discard"
  | "session-death"
  | "selection-change"
  | "inactivity";

/** A minimal node shape the controller needs to freeze a gesture node's props. */
export interface GestureFilterableNode {
  readonly id: number;
  readonly props: { readonly [key: string]: unknown };
}

/** Options for {@link createPanelGestureController}. */
export interface PanelGestureControllerOptions {
  /**
   * Idle window (ms) after which an open draft is auto-discarded if no further
   * `live` intent arrives. Defaults to 10_000. Injectable for tests.
   */
  readonly inactivityMs?: number;
  /** Timer scheduler seam (defaults to `setTimeout`). Injectable for fake timers. */
  readonly setTimer?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  /** Timer clear seam (defaults to `clearTimeout`). */
  readonly clearTimer?: (handle: ReturnType<typeof setTimeout>) => void;
}

const DEFAULT_INACTIVITY_MS = 10_000;

/**
 * The controller handle. One per panel session; the transport owns its lifetime.
 */
export interface PanelGestureController {
  // ── Active-gesture tracking (renderer echo) ──────────────────────────────
  /** Marks a gesture active on `nodeId`, freezing its current props for echo. */
  beginGesture(nodeId: number, props: { readonly [key: string]: unknown }): void;
  /** Ends the active gesture (the freeze is dropped; authority re-applies). */
  endGesture(): void;
  /** True while a gesture is active on `nodeId`. */
  isGestureActive(nodeId: number): boolean;
  /** The node id of the active gesture, or `null`. */
  activeGestureNode(): number | null;
  /**
   * Returns the props the renderer should use for `node`: the frozen props for
   * the active gesture node (value props held mid-gesture), otherwise the node's
   * own props unchanged. Handlers are always taken from the LIVE node so a
   * mid-gesture handler swap is never stale.
   */
  filterNodeProps(node: GestureFilterableNode): { readonly [key: string]: unknown };

  // ── Draft pairing (sandbox intents → host draft) ──────────────────────────
  /** Installs the draft callbacks that a sandbox gesture stream drives. */
  attachDraftPairing(pairing: DraftPairing): void;
  /** Feeds a `live` set-prop intent: opens the draft (once) + resets the idle timer. */
  onLiveIntent(): void;
  /** Feeds a `gesture-commit` intent: commits the open draft. */
  onGestureCommit(): void;
  /** Feeds a `gesture-discard` intent: discards the open draft. */
  onGestureDiscard(): void;
  /** True while a paired draft is open. */
  isDraftOpen(): boolean;
  /** The reason the last draft was discarded (diagnostics/tests), or `null`. */
  lastDiscardReason(): DraftDiscardReason | null;

  // ── Lifecycle discard triggers ────────────────────────────────────────────
  /** The panel's selection changed: discards any open draft. */
  notifySelectionChange(): void;
  /** The session died (error/restart/dispose): discards any open draft + clears state. */
  notifySessionDeath(): void;
  /** Tears the controller down (clears timers + open state). */
  dispose(): void;
}

/**
 * Creates a {@link PanelGestureController}. Pure bookkeeping — it holds no React
 * state and no transport reference; the transport and renderer call into it.
 */
export const createPanelGestureController = (
  options: PanelGestureControllerOptions = {},
): PanelGestureController => {
  const inactivityMs = options.inactivityMs ?? DEFAULT_INACTIVITY_MS;
  const setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle));

  // Active-gesture echo state.
  let gestureNodeId: number | null = null;
  let frozenProps: { readonly [key: string]: unknown } | null = null;

  // Draft-pairing state.
  let pairing: DraftPairing | null = null;
  let draftOpen = false;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let lastDiscardReason: DraftDiscardReason | null = null;

  const clearIdleTimer = (): void => {
    if (idleTimer !== null) {
      clearTimer(idleTimer);
      idleTimer = null;
    }
  };

  const armIdleTimer = (): void => {
    clearIdleTimer();
    idleTimer = setTimer(() => {
      idleTimer = null;
      discardDraft("inactivity");
    }, inactivityMs);
  };

  const discardDraft = (reason: DraftDiscardReason): void => {
    clearIdleTimer();
    if (!draftOpen) return;
    draftOpen = false;
    lastDiscardReason = reason;
    pairing?.discard();
  };

  return {
    beginGesture(nodeId, props) {
      gestureNodeId = nodeId;
      frozenProps = props;
    },
    endGesture() {
      gestureNodeId = null;
      frozenProps = null;
    },
    isGestureActive(nodeId) {
      return gestureNodeId === nodeId;
    },
    activeGestureNode() {
      return gestureNodeId;
    },
    filterNodeProps(node) {
      if (gestureNodeId !== node.id || frozenProps === null) {
        return node.props;
      }
      // Freeze value props at gesture start, but always take handlers from the
      // live node (a re-render may have swapped a handler closure).
      const merged: Record<string, unknown> = { ...frozenProps };
      for (const [key, value] of Object.entries(node.props)) {
        if (typeof value === "function") {
          merged[key] = value;
        }
      }
      return merged;
    },

    attachDraftPairing(next) {
      pairing = next;
    },
    onLiveIntent() {
      if (pairing === null) return;
      if (!draftOpen) {
        draftOpen = true;
        pairing.begin();
      }
      armIdleTimer();
    },
    onGestureCommit() {
      clearIdleTimer();
      if (!draftOpen) return;
      draftOpen = false;
      pairing?.commit();
    },
    onGestureDiscard() {
      discardDraft("gesture-discard");
    },
    isDraftOpen() {
      return draftOpen;
    },
    lastDiscardReason() {
      return lastDiscardReason;
    },

    notifySelectionChange() {
      discardDraft("selection-change");
    },
    notifySessionDeath() {
      discardDraft("session-death");
      gestureNodeId = null;
      frozenProps = null;
    },
    dispose() {
      discardDraft("session-death");
      gestureNodeId = null;
      frozenProps = null;
      pairing = null;
    },
  };
};
