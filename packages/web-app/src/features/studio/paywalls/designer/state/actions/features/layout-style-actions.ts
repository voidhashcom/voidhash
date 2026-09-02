import {
  isStatefulNodeType,
  type AlignItems,
  type FlexDirection,
  type JustifyContent,
} from "@voidhash/mimic-schema";
import { collapseContainerStretch, expandContainerStretch } from "@voidhash/paywall-style-engine";
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

interface StretchChildTarget {
  nodeId: string;
  nodeType: StyleTarget["nodeType"];
  style: Record<string, unknown>;
}

/**
 * A container's children as engine virtual-stretch views, or `null` when any
 * child carries no style of its own (component/code-component children make
 * the container ineligible for stretch collapsing).
 */
function stretchChildViews(parent: SnapshotNode): StretchChildTarget[] | null {
  const views: StretchChildTarget[] = [];
  for (const child of parent.children ?? []) {
    if (!isStatefulNodeType(child.type)) return null;
    views.push({
      nodeId: child.id,
      nodeType: child.type as StyleTarget["nodeType"],
      style: { ...(child.data["style"] as Record<string, unknown>) },
    });
  }
  return views;
}

function mergeUndo(
  previousStyles: Map<string, StyleUpdateUndoTarget>,
  undo: Map<string, StyleUpdateUndoTarget>,
): void {
  for (const [nodeId, entry] of undo) {
    if (!previousStyles.has(nodeId)) previousStyles.set(nodeId, entry);
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
  { previousStyles: Map<string, StyleUpdateUndoTarget>; touched: StyleTarget[] }
>(
  (ctx, params) => {
    const state = ctx.getState();
    const { mimic } = state;

    // Sizing repair is derived PER NODE from that node's own current style and
    // parent direction — a multi-selection can span row and column parents, so
    // a single shared patch would write the wrong `flex`/`alignSelf` pairing
    // on every node but the one it was derived from.
    const needsSizingRepair = hasSizingUpdates(params.style) && params.nodes.length > 0;
    const root: SnapshotNode | null =
      needsSizingRepair || params.style.alignSelf === "stretch" ? selectDocumentRoot(state) : null;
    const previousStyles = new Map<string, StyleUpdateUndoTarget>();
    const touched: StyleTarget[] = [...params.nodes];

    for (const target of params.nodes) {
      let styleToApply = params.style;

      // Virtual stretch, collapse direction: a per-child Fill (alignSelf:
      // "stretch") that makes EVERY child of the container explicitly stretch
      // canonicalizes to the CSS identity — parent alignItems: "stretch" with
      // the redundant child markers cleared. Planned BEFORE the write from the
      // committed snapshot, so the child never round-trips through "stretch".
      // Skipped while a state override is being edited (parent/sibling
      // coupling across state layers is undefined).
      if (
        root &&
        styleToApply.alignSelf === "stretch" &&
        getSelectedStateIdForNode(state.stateOverrideSelection, target.nodeId) === null
      ) {
        const parent = findParentNode<SnapshotNode>(root, target.nodeId);
        if (parent && isFlexParent(parent) && isStateCapableNode(parent)) {
          const children = stretchChildViews(parent);
          const plan = children
            ? collapseContainerStretch(
                { ...(parent.data["style"] as Record<string, unknown>) },
                children,
                new Map([[target.nodeId, { alignSelf: "stretch" }]]),
              )
            : null;
          if (plan && children) {
            styleToApply = { ...styleToApply, alignSelf: "auto" };
            if (Object.keys(plan.parentPatch).length > 0) {
              const parentTarget: StyleTarget = {
                nodeId: parent.id,
                nodeType: parent.type as StyleTarget["nodeType"],
              };
              touched.push(parentTarget);
              mergeUndo(
                previousStyles,
                applyStyleUpdate(
                  mimic,
                  [parentTarget],
                  plan.parentPatch,
                  state.stateOverrideSelection,
                  ctx.transaction,
                ),
              );
            }
            for (const child of children) {
              const childPatch = plan.childPatches.get(child.nodeId);
              if (!childPatch || child.nodeId === target.nodeId) continue;
              const childTarget: StyleTarget = { nodeId: child.nodeId, nodeType: child.nodeType };
              touched.push(childTarget);
              mergeUndo(
                previousStyles,
                applyStyleUpdate(
                  mimic,
                  [childTarget],
                  childPatch,
                  state.stateOverrideSelection,
                  ctx.transaction,
                ),
              );
            }
          }
        }
      }

      if (root && needsSizingRepair) {
        const node = findNodeById<SnapshotNode>(root, target.nodeId);
        if (node && isStateCapableNode(node)) {
          const selectedStateId = getSelectedStateIdForNode(
            state.stateOverrideSelection,
            target.nodeId,
          );
          const currentStyle = resolveEffectiveStyle(node, selectedStateId);
          const parentDirection = getParentFlexDirection(root, target.nodeId);

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

          // Merge ONLY the keys the repair actually produced. The repair input
          // materializes all four sizing keys (absent ones as `undefined`), and
          // an `undefined` that leaks into the patch reads as "delete this
          // field" downstream — deleting e.g. width re-materializes its schema
          // default and silently flips the OTHER axis out of Fixed.
          const merged: Record<string, unknown> = { ...params.style };
          for (const [key, value] of Object.entries(normalizedUpdates)) {
            if (value !== undefined) merged[key] = value;
          }
          styleToApply = merged as Partial<LayoutStyle>;
        }
      }

      const nodeUndo = applyStyleUpdate<LayoutStyle>(
        mimic,
        [target],
        styleToApply,
        state.stateOverrideSelection,
        ctx.transaction,
      );
      mergeUndo(previousStyles, nodeUndo);
    }

    return { previousStyles, touched };
  },
  (ctx, params, result) => {
    undoStyleUpdate(ctx.getState().mimic, result.touched, result.previousStyles, ctx.transaction);
  },
);

/**
 * Sets a container's alignment through the engine's virtual-stretch EXPAND
 * transform: leaving `alignItems: "stretch"` first marks every
 * container-driven filling child with an explicit `alignSelf: "stretch"`, so
 * the layout does not move and each child's Fill stays individually
 * revocable. One undo entry covers the parent and every touched child. State
 * override edits write the plain alignment to the override layer only.
 */
export const updateContainerAlignment = commander.undoableAction<
  { nodes: StyleTarget[]; alignItems: AlignItems; justifyContent: JustifyContent },
  { previousStyles: Map<string, StyleUpdateUndoTarget>; touched: StyleTarget[] }
>(
  (ctx, params) => {
    const state = ctx.getState();
    const { mimic } = state;
    const root: SnapshotNode = selectDocumentRoot(state);
    const previousStyles = new Map<string, StyleUpdateUndoTarget>();
    const touched: StyleTarget[] = [];

    for (const target of params.nodes) {
      const node = findNodeById<SnapshotNode>(root, target.nodeId);
      const stateId = getSelectedStateIdForNode(state.stateOverrideSelection, target.nodeId);
      let parentPatch: Record<string, unknown> = {
        alignItems: params.alignItems,
        justifyContent: params.justifyContent,
      };
      let childPatches: ReadonlyMap<string, Record<string, unknown>> = new Map();
      let children: StretchChildTarget[] = [];

      if (node && isStateCapableNode(node) && stateId === null) {
        children = stretchChildViews(node) ?? [];
        const plan = expandContainerStretch(
          { ...(node.data["style"] as Record<string, unknown>) },
          children,
          params.alignItems,
        );
        parentPatch = { ...plan.parentPatch, justifyContent: params.justifyContent };
        childPatches = plan.childPatches;
      }

      touched.push(target);
      mergeUndo(
        previousStyles,
        applyStyleUpdate(
          mimic,
          [target],
          parentPatch,
          state.stateOverrideSelection,
          ctx.transaction,
        ),
      );

      for (const child of children) {
        const childPatch = childPatches.get(child.nodeId);
        if (!childPatch) continue;
        const childTarget: StyleTarget = { nodeId: child.nodeId, nodeType: child.nodeType };
        touched.push(childTarget);
        mergeUndo(
          previousStyles,
          applyStyleUpdate(
            mimic,
            [childTarget],
            childPatch,
            state.stateOverrideSelection,
            ctx.transaction,
          ),
        );
      }
    }

    return { previousStyles, touched };
  },
  (ctx, params, result) => {
    undoStyleUpdate(ctx.getState().mimic, result.touched, result.previousStyles, ctx.transaction);
  },
);
