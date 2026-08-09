/**
 * Canvas commands using zustand-commander.
 *
 * These commands manage canvas interactions and UI state.
 */

import { canBeChildOf } from "@voidhash/mimic-schema";
import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";

import { commander } from "../designer-commander";
import { selectDocumentRoot } from "../utils/document-root";
import type { ComponentCatalogByContentHash } from "../designer-store-state";
import { nodePassesSlotGate } from "../utils/component-children";
import { selectedNodeIdsFromPresence } from "../utils/presence";
import { canHighlightNode, canSelectNode, getChildAtPosition, hasChildren } from "../utils/selection-level";
import { buildNodeIndex } from "../utils/tree";
import { createViewNode } from "./nodes/view-node-actions";
import { createScrollViewNode } from "./nodes/scrollview-node-actions";
import { createTextNode } from "./nodes/text-node-actions";
import { selectNode, unselectNode } from "./selection-actions";

/**
 * Validates a tool insert target: the child type must be allowed under the
 * clicked node (catalog rules) and component targets must pass the manifest
 * slot gate.
 */
function canInsertToolChild(
  parent: SnapshotNode,
  childType: "text" | "view" | "scrollView",
  byContentHash: ComponentCatalogByContentHash,
): boolean {
  return canBeChildOf(childType, parent.type) && nodePassesSlotGate(parent, byContentHash);
}

// =============================================================================
// Canvas State Commands
// =============================================================================

/**
 * Save the current canvas state (scale, position).
 */
export const saveCanvasState = commander.action<{
  scale: number;
  x: number;
  y: number;
}>((ctx, params) => {
  const state = ctx.getState();
  ctx.setState({
    canvas: { ...state.canvas, ...params },
  });
});

/**
 * Update a node's bounding box (used for rendering overlays).
 */
export const updateBoundingBox = commander.action<{
  id: string;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}>((ctx, params) => {
  const state = ctx.getState();
  const boundingBoxes = { ...state.canvas.boundingBoxes };
  boundingBoxes[params.id] = params.boundingBox;
  ctx.setState({
    canvas: { ...state.canvas, boundingBoxes },
  });
});

/**
 * Batch update multiple bounding boxes in a single store update.
 * Used by the BoundingBoxManager for efficient RAF-based measurement.
 */
export const updateBoundingBoxes = commander.action<{
  boxes: Array<{
    id: string;
    boundingBox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }>;
}>((ctx, params) => {
  const state = ctx.getState();
  const boundingBoxes = { ...state.canvas.boundingBoxes };
  for (const { id, boundingBox } of params.boxes) {
    boundingBoxes[id] = boundingBox;
  }
  ctx.setState({
    canvas: { ...state.canvas, boundingBoxes },
  });
});

// =============================================================================
// Node Hover Commands
// =============================================================================

/**
 * Handle mouse entering a node.
 * Uses level-based selection to determine if the node can be highlighted.
 * During text editing mode, only text nodes can be highlighted.
 */
export const nodeMouseEnter = commander.action<{ id: string }>((ctx, params) => {
  const state = ctx.getState();
  const { mimic, resize } = state;
  const root = selectDocumentRoot(state);

  if (resize.isActive) {
    return { shouldPropagate: true };
  }

  // During text editing mode, only highlight text nodes
  if (state.textEditingNodeId) {
    const hoveredNode = buildNodeIndex<SnapshotNode>(root).get(params.id);
    if (hoveredNode?.type !== "text") {
      return { shouldPropagate: true };
    }
    // Highlight this text node
    ctx.setState({
      highlightedNodeId: params.id,
    });
    return { shouldPropagate: true };
  }

  const selectedNodeIds = selectedNodeIdsFromPresence(mimic.presence?.self);

  // Check if this node can be highlighted at the current selection level
  if (!canHighlightNode(root, params.id, selectedNodeIds)) {
    return { shouldPropagate: true };
  }

  ctx.setState({
    highlightedNodeId: params.id,
  });
  return { shouldPropagate: true };
});

/**
 * Handle mouse moving over a node.
 * Uses level-based selection to determine if the node can be highlighted.
 * During text editing mode, only text nodes can be highlighted.
 */
export const nodeMouseOver = commander.action<{ id: string }>((ctx, params) => {
  const state = ctx.getState();
  const { mimic, resize } = state;
  const root = selectDocumentRoot(state);

  if (resize.isActive) {
    return { shouldPropagate: true };
  }

  // During text editing mode, only highlight text nodes
  if (state.textEditingNodeId) {
    const hoveredNode = buildNodeIndex<SnapshotNode>(root).get(params.id);
    if (hoveredNode?.type !== "text") {
      return { shouldPropagate: true };
    }
    // Always update highlight for text nodes (consistent with nodeMouseEnter)
    ctx.setState({
      highlightedNodeId: params.id,
    });
    return { shouldPropagate: true };
  }

  const selectedNodeIds = selectedNodeIdsFromPresence(mimic.presence?.self);

  // Check if this node can be highlighted at the current selection level
  if (!canHighlightNode(root, params.id, selectedNodeIds)) {
    return { shouldPropagate: true };
  }

  if (!state.highlightedNodeId) {
    ctx.setState({
      highlightedNodeId: params.id,
    });
  }
  return { shouldPropagate: true };
});

/**
 * Handle mouse leaving a node.
 * Clears the highlight if the node being left matches the highlighted node.
 */
export const nodeMouseLeave = commander.action<{ id: string }>((ctx, params) => {
  const state = ctx.getState();
  if (state.highlightedNodeId === params.id) {
    ctx.setState({ highlightedNodeId: null });
  }
});

/**
 * Clear the highlight (used when mouse leaves canvas area).
 */
export const clearHighlight = commander.action((ctx) => {
  ctx.setState({ highlightedNodeId: null });
});

/**
 * Directly set the highlighted node ID without level-based selection checks.
 * Used by the layers panel where all nodes should be highlightable.
 */
export const setHighlightedNode = commander.action<{ id: string | null }>((ctx, params) => {
  const state = ctx.getState();
  if (state.resize.isActive && params.id !== null) {
    return;
  }
  ctx.setState({
    highlightedNodeId: params.id,
  });
});

// =============================================================================
// Node Click Commands
// =============================================================================

/**
 * Handle clicking on a node.
 * Behavior depends on the current active tool.
 * Uses level-based selection to validate click targets.
 * During text editing mode, clicking on non-text nodes exits text editing.
 */
export const nodeClicked = commander.action<{ id: string; shiftKey: boolean }>((ctx, params) => {
  const state = ctx.getState();
  const { mimic } = state;
  const tool = state.tools.activeTool;

  const root = selectDocumentRoot(state);
  const nodes = buildNodeIndex<SnapshotNode>(root);

  const clickedNode = nodes.get(params.id);
  if (!clickedNode) {
    console.error(
      `[nodeClicked] Node "${params.id}" not found in snapshot. This indicates a state synchronization issue.`,
    );
    return;
  }

  // During text editing mode
  if (state.textEditingNodeId) {
    // Text node clicks are handled by text-node-renderer
    if (clickedNode.type === "text") {
      return;
    }
    // Clicking on non-text node exits text editing mode
    // but keeps the text node selected (don't select the clicked node)
    ctx.setState({ textEditingNodeId: null });
    return;
  }

  // Get current selection from presence
  const selectedNodeIds = selectedNodeIdsFromPresence(mimic.presence?.self);

  switch (tool) {
    case "cursor": {
      const isSelected = selectedNodeIds.includes(params.id);
      if (isSelected) {
        if (params.shiftKey) {
          ctx.dispatch(unselectNode)({ id: params.id });
          return;
        }
        // If the node is already selected, re-select. There may be multiple items selected.
        ctx.dispatch(selectNode)({ id: params.id, many: params.shiftKey });
        return;
      }

      // Check if this node can be selected at the current selection level
      if (!canSelectNode(root, params.id, selectedNodeIds)) {
        return;
      }

      // Select the node
      ctx.dispatch(selectNode)({ id: params.id, many: params.shiftKey });
      break;
    }

    case "text": {
      if (!canInsertToolChild(clickedNode, "text", state.componentCatalog.byContentHash)) {
        return;
      }
      ctx.dispatch(createTextNode)({ parentId: params.id });
      break;
    }

    case "columns": {
      if (!canInsertToolChild(clickedNode, "view", state.componentCatalog.byContentHash)) {
        return;
      }
      ctx.dispatch(createViewNode)({
        initialValues: {
          name: "Column",
          style: { flexDirection: "column" },
        },
        insertAffordance: true,
        parentId: params.id,
      });
      break;
    }

    case "rows": {
      if (!canInsertToolChild(clickedNode, "view", state.componentCatalog.byContentHash)) {
        return;
      }
      ctx.dispatch(createViewNode)({
        initialValues: { name: "Row", style: { flexDirection: "row" } },
        insertAffordance: true,
        parentId: params.id,
      });
      break;
    }

    case "scroll-view": {
      if (!canInsertToolChild(clickedNode, "scrollView", state.componentCatalog.byContentHash)) {
        return;
      }
      ctx.dispatch(createScrollViewNode)({
        initialValues: {
          // Vertical scroll => column main-axis flow for its children.
          style: { flexDirection: "column" },
        },
        insertAffordance: true,
        parentId: params.id,
      });
      break;
    }
  }
});

// =============================================================================
// Text Editing Commands
// =============================================================================

/**
 * Mark that text editing has started on a node.
 */
export const textEditingStarted = commander.action<{ id: string }>((ctx, params) => {
  ctx.setState({
    textEditingNodeId: params.id,
  });
});

/**
 * Mark that text editing has stopped.
 */
export const textEditingStopped = commander.action<{ id: string }>((ctx) => {
  ctx.setState({ textEditingNodeId: null });
});

// =============================================================================
// Double-Click Commands
// =============================================================================

/**
 * Handle double-clicking on a node.
 * For nodes with children: drill down to select the first child at the click position.
 * For text nodes: handled by text-node-renderer (enters text editing mode).
 */
export const nodeDoubleClicked = commander.action<{
  id: string;
  canvasX: number;
  canvasY: number;
}>((ctx, params) => {
  const state = ctx.getState();
  const { mimic, canvas } = state;

  // Don't drill down if in text editing mode
  if (state.textEditingNodeId) {
    return;
  }

  // Only drill down on cursor tool
  if (state.tools.activeTool !== "cursor") {
    return;
  }

  const root = selectDocumentRoot(state);
  const selectedNodeIds = selectedNodeIdsFromPresence(mimic.presence?.self);

  // Only drill down if the double-clicked node is selected
  if (!selectedNodeIds.includes(params.id)) {
    return;
  }

  // Check if the node has children
  if (!hasChildren(root, params.id)) {
    return;
  }

  // Find the child at the click position
  const childId = getChildAtPosition(root, params.id, canvas.boundingBoxes, {
    x: params.canvasX,
    y: params.canvasY,
  });

  if (childId) {
    // Select the child node (this will update the selection level)
    ctx.dispatch(selectNode)({ id: childId, many: false });
  }
});
