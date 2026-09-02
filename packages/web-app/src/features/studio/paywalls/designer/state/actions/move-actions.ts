/**
 * Move (canvas drag-to-move) commands using zustand-commander.
 *
 * These manage dragging absolutely positioned view AND text nodes on the
 * canvas, and mirror the resize command lifecycle:
 *   - `startMove` captures the pressed nodes' base `left`/`top` (for delta
 *     math) plus their original values (for undo).
 *   - `updateMove` writes live `left`/`top` for every tracked node during the
 *     drag. It runs while a mimic draft is active, so those writes stage in the
 *     draft (live preview) and record no undo entries.
 *   - `endMove` is undoable: the caller commits the draft FIRST (final
 *     positions land in the committed document), then dispatches `endMove`,
 *     which re-asserts the final positions draft-free so exactly one undo entry
 *     — reverting to the captured originals — lands on the stack. This matches
 *     `endResize`, which likewise commits then writes draft-free. The forward
 *     write and the revert both target the layer captured at `startMove` (a
 *     selected state's `overrides.style` when one is active, else the base
 *     style), so a move under a state override never corrupts the base style.
 *   - `cancelMove` resets transient state; the draft's `discard()` reverts the
 *     staged writes.
 */

import type { StatefulEditableNodeType } from "@voidhash/mimic-schema";
import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";

import { commander } from "../designer-commander";
import type { MoveState, Point } from "../designer-store-state";
import type { StyleTarget } from "./features/style-action-helpers";
import { normalizeStyleForWrite } from "./features/style-action-helpers";
import { updateLayoutStyle } from "./features/layout-style-actions";
import { selectDocumentRoot } from "../utils/document-root";
import { getOffsetWithinParent } from "../utils/bounding-box";
import { findStatefulNode, type DesignerDocumentRoot } from "../utils/node-proxies";
import {
  getSelectedStateIdForNode,
  getStateById,
  isStateCapableNode,
  mapStyleOverridesForSnapshot,
  resolveEffectiveStyle,
  stateStyleOverridesToRecord,
} from "../utils/state-overrides";
import { findNodeById, findParentNode } from "../utils/tree";

// =============================================================================
// Helpers
// =============================================================================

/** A stored offset value: numeric, or `"auto"` when the field is unset. */
type Offset = number | "auto";

/** Reads a numeric style value, else `null` (e.g. `"auto"` or absent). */
function numberOrNull(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

/** Reads a style value as the stored offset shape (`"auto"` when not numeric). */
function offsetFromStyleValue(value: unknown): Offset {
  return typeof value === "number" ? value : "auto";
}

/**
 * Bivariant structural view of a stateful node's per-state overrides proxy, so
 * the generic string-keyed override writes typecheck against the schema-typed
 * proxy (mirrors the equivalent seam in `resize-actions`).
 */
interface StateOverridesProxy {
  overrides: {
    style: {
      set(value: Record<string, unknown>): void;
      update(value: Record<string, unknown>): void;
    };
  };
}

/**
 * The draggable node types (view + scrollView + text): all carry
 * `position`/`left`/`top` and identical style/state data.
 */
type DraggableNodeType = Extract<StatefulEditableNodeType, "view" | "scrollView" | "text">;

/**
 * Bivariant structural view of a draggable node's `left`/`top` style proxy plus
 * its per-state overrides accessor, so the generic offset writes typecheck
 * against the view-, scrollView- and text-typed proxies at once.
 */
interface DraggableNodeProxy {
  data: {
    style: {
      left: { get(): unknown; set(value: Offset): void };
      top: { get(): unknown; set(value: Offset): void };
    };
    states: {
      findById(id: string): { value: StateOverridesProxy } | undefined;
    };
  };
}

/** Whether a snapshot node is a draggable (view, scrollView or text) node. */
function isDraggableNode(node: SnapshotNode | null | undefined): node is SnapshotNode & {
  type: DraggableNodeType;
} {
  return node?.type === "view" || node?.type === "scrollView" || node?.type === "text";
}

/**
 * Resolves a draggable node's typed proxy directly from a transaction root,
 * inferring its type ("view" or "text") from the tree so callers inside a
 * transaction need not carry it. Returns `undefined` for absent/non-draggable
 * nodes. Generic over view + text via `findStatefulNode`.
 */
function resolveDraggableProxy(
  root: DesignerDocumentRoot,
  nodeId: string,
): DraggableNodeProxy | undefined {
  const found = root.findByIdAcrossTree(nodeId);
  if (
    found === undefined ||
    (found.type !== "view" && found.type !== "scrollView" && found.type !== "text")
  ) {
    return undefined;
  }
  return findStatefulNode(root, nodeId, found.type) as DraggableNodeProxy | undefined;
}

/**
 * Seed the base `left`/`top` for a node about to be dragged: prefer the numeric
 * style values; when either is `"auto"`/absent, fall back to the node's measured
 * offset within its parent so the drag starts where the node sits on the canvas;
 * otherwise `0`.
 */
function seedBaseOffset(
  root: SnapshotNode,
  nodeId: string,
  effectiveStyle: Record<string, unknown>,
  boundingBoxes: Record<string, { x: number; y: number; width: number; height: number }>,
): { left: number; top: number } {
  const styleLeft = numberOrNull(effectiveStyle["left"]);
  const styleTop = numberOrNull(effectiveStyle["top"]);
  if (styleLeft !== null && styleTop !== null) {
    return { left: styleLeft, top: styleTop };
  }

  const parent = findParentNode<SnapshotNode>(root, nodeId);
  const fallback = parent ? getOffsetWithinParent(nodeId, parent.id, boundingBoxes) : null;

  return {
    left: styleLeft ?? fallback?.left ?? 0,
    top: styleTop ?? fallback?.top ?? 0,
  };
}

/** Canvas delta of the pointer from the move's start, in canvas units. */
function canvasDelta(move: MoveState, screenPoint: Point, scale: number): { x: number; y: number } {
  if (!move.startScreenPoint) {
    return { x: 0, y: 0 };
  }
  return {
    x: (screenPoint.x - move.startScreenPoint.x) / scale,
    y: (screenPoint.y - move.startScreenPoint.y) / scale,
  };
}

// =============================================================================
// Move Commands
// =============================================================================

/**
 * Start a move operation for the given nodes.
 * Only absolutely positioned view/text nodes are tracked; each records its base
 * `left`/`top` (numeric style value, else the measured parent offset, else `0`)
 * for delta math and its original style values for undo.
 */
export const startMove = commander.action<{
  nodeIds: string[];
  screenPoint: Point;
}>((ctx, params) => {
  const state = ctx.getState();
  const { canvas } = state;
  const root = selectDocumentRoot(state);

  const nodes: MoveState["nodes"] = {};

  for (const nodeId of params.nodeIds) {
    const snapshotNode = findNodeById<SnapshotNode>(root, nodeId);
    if (!isDraggableNode(snapshotNode)) {
      continue;
    }

    const selectedStateId = getSelectedStateIdForNode(state.stateOverrideSelection, nodeId);
    const effectiveStyle = resolveEffectiveStyle(snapshotNode, selectedStateId);
    if (effectiveStyle["position"] !== "absolute") {
      continue;
    }

    // Capture the drag's target layer: when a state override is selected, the
    // drag writes into (and undo restores) that state's `overrides.style`;
    // otherwise it writes the base style. Record the full override record so
    // undo can restore the override layer faithfully.
    const selectedState = isStateCapableNode(snapshotNode)
      ? getStateById(snapshotNode, selectedStateId)
      : null;
    const usesStateLayer = !!(selectedStateId && selectedState);

    const base = seedBaseOffset(root, nodeId, effectiveStyle, canvas.boundingBoxes);
    nodes[nodeId] = {
      baseLeft: base.left,
      baseTop: base.top,
      originalLeft: offsetFromStyleValue(effectiveStyle["left"]),
      originalTop: offsetFromStyleValue(effectiveStyle["top"]),
      stateId: usesStateLayer ? selectedStateId : null,
      originalStateOverrideStyle: usesStateLayer
        ? mapStyleOverridesForSnapshot(stateStyleOverridesToRecord(selectedState))
        : {},
    };
  }

  if (Object.keys(nodes).length === 0) {
    return;
  }

  ctx.setState({
    highlightedNodeId: null,
    move: {
      isActive: true,
      startScreenPoint: params.screenPoint,
      nodes,
    },
  });
});

/**
 * Update a move during pointer drag.
 * Converts the screen delta to a canvas delta (dividing by zoom scale) and
 * writes each tracked node's rounded `left`/`top` via `updateLayoutStyle`. Runs
 * while a draft is active, so writes stage in the draft (live preview, batched
 * until commit, no undo entries).
 */
export const updateMove = commander.action<{ screenPoint: Point }>((ctx, params) => {
  const state = ctx.getState();
  const { canvas, move } = state;

  if (!move.isActive || !move.startScreenPoint) {
    return;
  }

  const root = selectDocumentRoot(state);
  const delta = canvasDelta(move, params.screenPoint, canvas.scale);

  for (const [nodeId, entry] of Object.entries(move.nodes)) {
    // Re-resolve the node type each update so the layout write targets the
    // correct schema layer ("view" vs "text"); a tracked node is always
    // draggable (start-time gate), so a missing/relocated node is skipped.
    const snapshotNode = findNodeById<SnapshotNode>(root, nodeId);
    if (!isDraggableNode(snapshotNode)) {
      continue;
    }
    const target: StyleTarget = { nodeId, nodeType: snapshotNode.type };
    ctx.dispatch(updateLayoutStyle)({
      nodes: [target],
      style: {
        left: Math.round(entry.baseLeft + delta.x),
        top: Math.round(entry.baseTop + delta.y),
      },
    });
  }
});

/** The per-node revert record `endMove` carries: the layer it wrote to. */
type MoveUndoTarget =
  | { kind: "base"; left: Offset; top: Offset }
  | { kind: "state"; stateId: string; styleOverrides: Record<string, unknown> };

/**
 * End a move and commit exactly one undo entry.
 *
 * The caller commits the active draft BEFORE dispatching this, so the committed
 * document already holds the dragged positions; this re-asserts the final
 * `left`/`top` draft-free (mirroring how `endResize` re-writes its
 * normalization) purely to record a single undoable step. Each node writes to
 * the layer captured at `startMove` — a selected state's `overrides.style` when
 * one is active, else the base style — so a move under a state override never
 * corrupts the base style. The revert restores each node's captured original
 * on that same layer (base `left`/`top`, or the whole override record).
 */
export const endMove = commander.undoableAction<
  { screenPoint: Point },
  {
    finalOffsets: Record<string, { left: number; top: number }>;
    originals: Record<string, MoveUndoTarget>;
  }
>(
  (ctx, params) => {
    const state = ctx.getState();
    const { canvas, mimic, move } = state;

    if (!move.isActive) {
      ctx.setState({ move: { isActive: false, startScreenPoint: null, nodes: {} } });
      return { finalOffsets: {}, originals: {} };
    }

    const delta = canvasDelta(move, params.screenPoint, canvas.scale);
    const finalOffsets: Record<string, { left: number; top: number }> = {};
    const originals: Record<string, MoveUndoTarget> = {};

    for (const [nodeId, entry] of Object.entries(move.nodes)) {
      finalOffsets[nodeId] = {
        left: Math.round(entry.baseLeft + delta.x),
        top: Math.round(entry.baseTop + delta.y),
      };
      originals[nodeId] =
        entry.stateId !== null
          ? {
              kind: "state",
              stateId: entry.stateId,
              styleOverrides: entry.originalStateOverrideStyle,
            }
          : { kind: "base", left: entry.originalLeft, top: entry.originalTop };
    }

    mimic.document.transaction((root) => {
      for (const [nodeId, offset] of Object.entries(finalOffsets)) {
        const original = originals[nodeId];
        const proxy = resolveDraggableProxy(root, nodeId);
        if (!proxy) {
          continue;
        }
        if (original?.kind === "state") {
          const stateProxy = proxy.data.states.findById(original.stateId)?.value;
          if (!stateProxy) {
            continue;
          }
          // Mirror the override layer's base-comparison (as `updateMove` /
          // `endResize` do): a final offset equal to the base style clears the
          // key rather than pinning a redundant override; otherwise upsert it.
          const baseLeft = proxy.data.style.left.get();
          const baseTop = proxy.data.style.top.get();
          stateProxy.overrides.style.update({
            left: offset.left === baseLeft ? undefined : offset.left,
            top: offset.top === baseTop ? undefined : offset.top,
          });
          continue;
        }
        proxy.data.style.left.set(offset.left);
        proxy.data.style.top.set(offset.top);
      }
    });

    ctx.setState({ move: { isActive: false, startScreenPoint: null, nodes: {} } });

    return { finalOffsets, originals };
  },
  (ctx, _params, result) => {
    const { mimic } = ctx.getState();
    mimic.document.transaction((root) => {
      for (const [nodeId, original] of Object.entries(result.originals)) {
        const proxy = resolveDraggableProxy(root, nodeId);
        if (!proxy) {
          continue;
        }
        if (original.kind === "state") {
          const stateProxy = proxy.data.states.findById(original.stateId)?.value;
          if (!stateProxy) {
            continue;
          }
          stateProxy.overrides.style.set(normalizeStyleForWrite(original.styleOverrides));
          continue;
        }
        proxy.data.style.left.set(original.left);
        proxy.data.style.top.set(original.top);
      }
    });
  },
);

/**
 * Cancel a move without committing.
 * Resets transient state; the draft's `discard()` reverts the staged writes.
 */
export const cancelMove = commander.action((ctx) => {
  if (!ctx.getState().move.isActive) {
    return;
  }
  ctx.setState({ move: { isActive: false, startScreenPoint: null, nodes: {} } });
});
