import type { FlexDirection } from "@voidhash/mimic-schema";
import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";

import { commander } from "../../designer-commander";
import { selectDocumentRoot } from "../../utils/document-root";
import { getFlexDirection, isFlexParent } from "../../utils/node-type-helpers";
import { normalizeFlexSizing } from "../../utils/normalize-flex-sizing";
import {
  getSelectedStateIdForNode,
  isStateCapableNode,
  resolveEffectiveStyle,
} from "../../utils/state-overrides";
import { findNodeById, findParentNode } from "../../utils/tree";
import type { StyleTarget } from "./style-action-helpers";
import {
  applyStyleUpdate,
  type StyleUpdateUndoTarget,
  undoStyleUpdate,
} from "./style-action-helpers";

interface LayoutStyle {
  gap: number;
  justifyContent: string;
  alignItems: string;
  flexDirection: FlexDirection;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  width: unknown;
  height: unknown;
  flex: unknown;
  flexGrow: unknown;
  flexShrink: unknown;
  flexBasis: unknown;
  alignSelf: unknown;
  position: "relative" | "absolute";
  left: number | "auto";
  top: number | "auto";
  right: number | "auto";
  bottom: number | "auto";
}

/**
 * Get parent flex direction for a node.
 */
function getParentFlexDirection(root: SnapshotNode, nodeId: string): FlexDirection | null {
  const parent = findParentNode<SnapshotNode>(root, nodeId);
  if (!parent) return null;

  return isFlexParent(parent) ? getFlexDirection(parent) : null;
}

/**
 * Check if style updates contain sizing-related properties that need normalization.
 */
function hasSizingUpdates(style: Partial<LayoutStyle>): boolean {
  return (
    style.width !== undefined ||
    style.height !== undefined ||
    style.flex !== undefined ||
    style.alignSelf !== undefined
  );
}

function sizeValue(value: unknown): number | "auto" | undefined {
  return typeof value === "number" || value === "auto" ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function alignSelfValue(
  value: unknown,
): "auto" | "flex-start" | "center" | "flex-end" | "stretch" | "baseline" | undefined {
  switch (value) {
    case "auto":
    case "flex-start":
    case "center":
    case "flex-end":
    case "stretch":
    case "baseline":
      return value;
    default:
      return undefined;
  }
}

/** One node's distinct layout-style patch for {@link applyPerNodeLayoutStyle}. */
export interface PerNodeLayoutStyle {
  target: StyleTarget;
  style: Partial<LayoutStyle>;
}

/**
 * Applies a DISTINCT layout-style patch to each node in a SINGLE undoable
 * command — the commander records exactly one undo entry per dispatch (when no
 * draft is active), so a whole multi-node change (e.g. toggling absolute
 * positioning on a multi-selection, where each node keeps its own `left`/`top`)
 * undoes as one step. Each node's write is override-aware (routing to the
 * selected state's overrides when one is active), and the returned undo map is
 * the union of every node's captured previous target.
 */
export const applyPerNodeLayoutStyle = commander.undoableAction<
  { nodes: PerNodeLayoutStyle[] },
  { previousStyles: Map<string, StyleUpdateUndoTarget> }
>(
  (ctx, params) => {
    const { mimic } = ctx.getState();
    const stateOverrideSelection = ctx.getState().stateOverrideSelection;
    const previousStyles = new Map<string, StyleUpdateUndoTarget>();

    for (const { target, style } of params.nodes) {
      const nodeUndo = applyStyleUpdate<LayoutStyle>(
        mimic,
        [target],
        style,
        stateOverrideSelection,
        ctx.transaction,
      );
      const prev = nodeUndo.get(target.nodeId);
      if (prev) {
        previousStyles.set(target.nodeId, prev);
      }
    }

    return { previousStyles };
  },
  (ctx, params, result) => {
    undoStyleUpdate(
      ctx.getState().mimic,
      params.nodes.map((entry) => entry.target),
      result.previousStyles,
      ctx.transaction,
    );
  },
);

export const updateLayoutStyle = commander.undoableAction<
  { nodes: StyleTarget[]; style: Partial<LayoutStyle> },
  { previousStyles: Map<string, StyleUpdateUndoTarget> }
>(
  (ctx, params) => {
    const state = ctx.getState();
    const { mimic } = state;
    let styleToApply = params.style;

    // Normalize sizing properties if needed
    if (hasSizingUpdates(params.style) && params.nodes.length > 0) {
      const root: SnapshotNode = selectDocumentRoot(state);

      // Get the first node's current style and parent direction for normalization
      const firstTarget = params.nodes[0];
      if (firstTarget) {
        const firstNode = findNodeById<SnapshotNode>(root, firstTarget.nodeId);
        if (firstNode && isStateCapableNode(firstNode)) {
          const selectedStateId = getSelectedStateIdForNode(
            state.stateOverrideSelection,
            firstTarget.nodeId,
          );
          const currentStyle = resolveEffectiveStyle(firstNode, selectedStateId);
          const parentDirection = getParentFlexDirection(root, firstTarget.nodeId);

          // `null` width/height/flex updates are legacy "clear" inputs from
          // the panels; normalizeFlexSizing treats them as explicit values.
          const normalizedUpdates = normalizeFlexSizing(
            {
              width: params.style.width === null ? null : sizeValue(params.style.width),
              height: params.style.height === null ? null : sizeValue(params.style.height),
              flex: params.style.flex === null ? null : numberValue(params.style.flex),
              alignSelf: alignSelfValue(params.style.alignSelf),
            },
            {
              width: sizeValue(currentStyle["width"]) ?? null,
              height: sizeValue(currentStyle["height"]) ?? null,
              flex: numberValue(currentStyle["flex"]) ?? null,
              alignSelf: alignSelfValue(currentStyle["alignSelf"]),
            },
            parentDirection,
          );

          styleToApply = { ...params.style, ...normalizedUpdates };
        }
      }
    }

    return {
      previousStyles: applyStyleUpdate<LayoutStyle>(
        mimic,
        params.nodes,
        styleToApply,
        state.stateOverrideSelection,
        ctx.transaction,
      ),
    };
  },
  (ctx, params, result) => {
    undoStyleUpdate(ctx.getState().mimic, params.nodes, result.previousStyles, ctx.transaction);
  },
);
