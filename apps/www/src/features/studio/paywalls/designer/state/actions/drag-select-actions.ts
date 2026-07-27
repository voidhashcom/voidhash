/**
 * Drag selection commands using zustand-commander.
 *
 * These commands manage the drag-to-select (marquee selection) feature.
 */

import { commander } from "../designer-commander";
import { selectDocumentRoot } from "../utils/document-root";
import type { DesignerStoreState } from "../designer-store-state";
import { buildDepthMap } from "../utils/selection-level";
import { clearSelection, selectNode } from "./selection-actions";

// =============================================================================
// Constants
// =============================================================================

// Node types that use intersection-based selection (any overlap selects)
const INTERSECTION_SELECT_TYPES = new Set(["view", "scrollView", "text"]);
// Node types that use containment-based selection (must be fully inside)
const CONTAINMENT_SELECT_TYPES = new Set(["screen"]);
// Node types that should never be selected via drag
const NON_SELECTABLE_TYPES = new Set(["root"]);
// Depth at which drag-select operates (direct children of screen)
const DRAG_SELECT_DEPTH = 2;

// =============================================================================
// Types
// =============================================================================

interface Point {
  x: number;
  y: number;
}

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SnapshotNode {
  id: string;
  type: string;
  children?: readonly SnapshotNode[];
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if two rectangles intersect (any overlap).
 */
function rectanglesIntersect(rect1: BoundingBox, rect2: BoundingBox): boolean {
  return !(
    rect1.x + rect1.width < rect2.x ||
    rect2.x + rect2.width < rect1.x ||
    rect1.y + rect1.height < rect2.y ||
    rect2.y + rect2.height < rect1.y
  );
}

/**
 * Check if container fully contains the other rectangle.
 */
function rectangleContains(container: BoundingBox, contained: BoundingBox): boolean {
  return (
    contained.x >= container.x &&
    contained.y >= container.y &&
    contained.x + contained.width <= container.x + container.width &&
    contained.y + contained.height <= container.y + container.height
  );
}

/**
 * Normalize selection rectangle (handle negative dimensions from dragging in any direction).
 */
function normalizeRect(start: Point, end: Point): BoundingBox {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  return { height, width, x, y };
}

/**
 * Extract node types from snapshot tree.
 */
function getNodeTypesFromSnapshot(snapshot: SnapshotNode | null): Record<string, string> {
  if (!snapshot) {
    return {};
  }

  const types: Record<string, string> = {};

  const traverse = (node: SnapshotNode) => {
    types[node.id] = node.type;
    if (node.children) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  };

  traverse(snapshot);
  return types;
}

/**
 * Build parent map from snapshot tree (nodeId -> parentId).
 */
function buildParentMap(snapshot: SnapshotNode | null): Record<string, string> {
  if (!snapshot) {
    return {};
  }

  const parentMap: Record<string, string> = {};

  const traverse = (node: SnapshotNode, parentId: string | null) => {
    if (parentId) {
      parentMap[node.id] = parentId;
    }
    if (node.children) {
      for (const child of node.children) {
        traverse(child, node.id);
      }
    }
  };

  traverse(snapshot, null);
  return parentMap;
}

/**
 * Filter to only top-level nodes (exclude nodes whose ancestors are also in the list).
 * This ensures we don't select both a parent and its children.
 */
function filterToTopLevelNodes(nodeIds: string[], parentMap: Record<string, string>): string[] {
  const nodeIdSet = new Set(nodeIds);
  const result: string[] = [];

  for (const nodeId of nodeIds) {
    let isChildOfSelected = false;
    let currentId = parentMap[nodeId];

    // Walk up the tree to check if any ancestor is also selected
    while (currentId) {
      if (nodeIdSet.has(currentId)) {
        isChildOfSelected = true;
        break;
      }
      currentId = parentMap[currentId];
    }

    // Only include if no ancestor is in the selection
    if (!isChildOfSelected) {
      result.push(nodeId);
    }
  }

  return result;
}

/**
 * Calculate which nodes should be selected based on the selection rectangle.
 * Returns only top-level nodes (filters out children of selected parents).
 * Drag-select only operates at depth 2 (direct children of screen) for
 * intersection-based selection (flex/text nodes).
 */
function calculateSelectedNodes(
  selectionRect: BoundingBox,
  boundingBoxes: Record<string, BoundingBox>,
  snapshot: SnapshotNode | null,
): string[] {
  const nodeTypes = getNodeTypesFromSnapshot(snapshot);
  const parentMap = buildParentMap(snapshot);
  const depthMap = buildDepthMap(snapshot);

  // Find all nodes that match selection criteria
  const matchingNodes: string[] = [];

  for (const [nodeId, boundingBox] of Object.entries(boundingBoxes)) {
    const nodeType = nodeTypes[nodeId];
    const nodeDepth = depthMap[nodeId];

    // Skip non-selectable nodes
    if (!nodeType || NON_SELECTABLE_TYPES.has(nodeType)) {
      continue;
    }

    let shouldSelect = false;

    if (INTERSECTION_SELECT_TYPES.has(nodeType)) {
      // For flex/text nodes, only select at depth 2 (direct children of screen)
      if (nodeDepth !== DRAG_SELECT_DEPTH) {
        continue;
      }
      // Intersection mode: any overlap selects
      shouldSelect = rectanglesIntersect(selectionRect, boundingBox);
    } else if (CONTAINMENT_SELECT_TYPES.has(nodeType)) {
      // Containment mode: must be fully contained (screens)
      shouldSelect = rectangleContains(selectionRect, boundingBox);
    }

    if (shouldSelect) {
      matchingNodes.push(nodeId);
    }
  }

  // Filter to only top-level nodes
  return filterToTopLevelNodes(matchingNodes, parentMap);
}

// =============================================================================
// Drag Selection Commands
// =============================================================================

/**
 * Start drag selection.
 */
export const startDragSelect = commander.action<{
  point: Point;
  shiftKey: boolean;
}>((ctx, params) => {
  // If shift is not held, clear the existing selection
  if (!params.shiftKey) {
    ctx.dispatch(clearSelection)({});
  }

  ctx.setState({
    dragSelect: {
      currentPoint: params.point,
      isActive: true,
      previewSelectedNodeIds: [],
      startPoint: params.point,
    },
  });
});

/**
 * Update drag selection during mouse move.
 * Calculates preview of which nodes would be selected.
 */
export const updateDragSelect = commander.action<{ point: Point }>((ctx, params) => {
  const state = ctx.getState();
  const { canvas, dragSelect } = state;

  if (!dragSelect.isActive || !dragSelect.startPoint) {
    return;
  }

  // Calculate selection rectangle
  const selectionRect = normalizeRect(dragSelect.startPoint, params.point);

  // Calculate which nodes would be selected
  const root: SnapshotNode = selectDocumentRoot(state);
  const previewSelectedNodeIds = calculateSelectedNodes(selectionRect, canvas.boundingBoxes, root);

  ctx.setState({
    dragSelect: {
      ...dragSelect,
      currentPoint: params.point,
      previewSelectedNodeIds,
    },
  });
});

/**
 * End drag selection and apply the selection.
 */
export const endDragSelect = commander.action((ctx) => {
  const state = ctx.getState();
  const { dragSelect } = state;

  if (!dragSelect.isActive) {
    ctx.setState({
      dragSelect: {
        currentPoint: null,
        isActive: false,
        previewSelectedNodeIds: [],
        startPoint: null,
      },
    });
    return;
  }

  // Apply selection from preview
  for (const nodeId of dragSelect.previewSelectedNodeIds) {
    ctx.dispatch(selectNode)({ id: nodeId, many: true });
  }

  // Reset drag select state
  ctx.setState({
    dragSelect: {
      currentPoint: null,
      isActive: false,
      previewSelectedNodeIds: [],
      startPoint: null,
    },
  });
});

/**
 * Cancel drag selection without applying.
 */
export const cancelDragSelect = commander.action((ctx) => {
  ctx.setState({
    dragSelect: {
      currentPoint: null,
      isActive: false,
      previewSelectedNodeIds: [],
      startPoint: null,
    },
  });
});
