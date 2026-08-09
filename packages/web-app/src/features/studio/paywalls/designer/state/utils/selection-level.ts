/**
 * Selection level utilities for level-based selection.
 *
 * The selection level is derived from selected nodes (not stored in state).
 * - No selection → level = 1 (screen level)
 * - Node(s) selected → level = depth of first selected node
 *
 * Node hierarchy:
 * - Root (depth 0) - never selectable
 * - Screen (depth 1)
 * - Flex (depth 2+)
 * - Text (leaf) or Flex (recursive)
 */

// =============================================================================
// Types (exported for use in other files)
// =============================================================================

export interface SnapshotNode {
  id: string;
  type: string;
  children?: readonly SnapshotNode[];
}

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

// =============================================================================
// Tree Traversal Helpers
// =============================================================================

/**
 * Find a node by ID in the snapshot tree.
 */
function findNodeById(snapshot: SnapshotNode | null, nodeId: string): SnapshotNode | null {
  if (!snapshot) {
    return null;
  }

  const traverse = (node: SnapshotNode): SnapshotNode | null => {
    if (node.id === nodeId) {
      return node;
    }
    if (node.children) {
      for (const child of node.children) {
        const found = traverse(child);
        if (found) {
          return found;
        }
      }
    }
    return null;
  };

  return traverse(snapshot);
}

/**
 * Build a depth map from the snapshot tree (nodeId -> depth).
 * Root is depth 0, screens are depth 1, etc.
 */
export function buildDepthMap(snapshot: SnapshotNode | null): Record<string, number> {
  if (!snapshot) {
    return {};
  }

  const depthMap: Record<string, number> = {};

  const traverse = (node: SnapshotNode, depth: number) => {
    depthMap[node.id] = depth;
    if (node.children) {
      for (const child of node.children) {
        traverse(child, depth + 1);
      }
    }
  };

  traverse(snapshot, 0);
  return depthMap;
}

/**
 * Build a parent map from the snapshot tree (nodeId -> parentId).
 */
export function buildParentMap(snapshot: SnapshotNode | null): Record<string, string> {
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

// =============================================================================
// Selection Level Utilities
// =============================================================================

/**
 * Check if a node can be interacted with (highlighted or selected) at the current level.
 * This is the core logic shared by canHighlightNode and canSelectNode.
 *
 * Rules:
 * - Root nodes (depth 0) cannot be interacted with
 * - Nodes at depth > selection level cannot be interacted with
 */
function canInteractWithNode(
  depthMap: Record<string, number>,
  nodeId: string,
  selectedNodeIds: readonly string[],
): boolean {
  const nodeDepth = depthMap[nodeId];

  // Cannot interact with root or invalid nodes
  if (nodeDepth === undefined || nodeDepth === 0) {
    return false;
  }

  // Compute selection level inline to avoid rebuilding depth map
  let selectionLevel = 1;
  const firstSelectedNodeId = selectedNodeIds[0];
  if (firstSelectedNodeId !== undefined) {
    selectionLevel = depthMap[firstSelectedNodeId] ?? 1;
  }

  // Node must be at depth ≤ selection level
  return nodeDepth <= selectionLevel;
}

/**
 * Check if node can be highlighted at current level.
 */
export function canHighlightNode(
  snapshot: SnapshotNode | null,
  nodeId: string,
  selectedNodeIds: readonly string[],
): boolean {
  const depthMap = buildDepthMap(snapshot);
  return canInteractWithNode(depthMap, nodeId, selectedNodeIds);
}

/**
 * Check if node can be selected at current level.
 */
export function canSelectNode(
  snapshot: SnapshotNode | null,
  nodeId: string,
  selectedNodeIds: readonly string[],
): boolean {
  const depthMap = buildDepthMap(snapshot);
  return canInteractWithNode(depthMap, nodeId, selectedNodeIds);
}

// =============================================================================
// Node Query Utilities
// =============================================================================

/**
 * Find child at click position for drill-down navigation.
 * Returns the ID of the deepest child at the click position, or null if none found.
 */
export function getChildAtPosition(
  snapshot: SnapshotNode | null,
  parentId: string,
  boundingBoxes: Record<string, BoundingBox>,
  clickPoint: Point,
): string | null {
  const parentNode = findNodeById(snapshot, parentId);
  if (!parentNode?.children || parentNode.children.length === 0) {
    return null;
  }

  // Find the first child whose bounding box contains the click point
  // Iterate in reverse order to get the topmost (last rendered) child first
  for (let i = parentNode.children.length - 1; i >= 0; i--) {
    const child = parentNode.children[i];
    if (!child) {
      continue;
    }
    const boundingBox = boundingBoxes[child.id];

    if (boundingBox && isPointInBoundingBox(clickPoint, boundingBox)) {
      return child.id;
    }
  }

  // If no child contains the point, return the first child as fallback
  const firstChild = parentNode.children[0];
  return firstChild?.id ?? null;
}

/**
 * Check if a point is inside a bounding box.
 */
function isPointInBoundingBox(point: Point, box: BoundingBox): boolean {
  return (
    point.x >= box.x &&
    point.x <= box.x + box.width &&
    point.y >= box.y &&
    point.y <= box.y + box.height
  );
}

/**
 * Get node type from snapshot.
 */
export function getNodeType(snapshot: SnapshotNode | null, nodeId: string): string | null {
  const node = findNodeById(snapshot, nodeId);
  return node?.type ?? null;
}

/**
 * Check if a node has children.
 */
export function hasChildren(snapshot: SnapshotNode | null, nodeId: string): boolean {
  const node = findNodeById(snapshot, nodeId);
  return (node?.children?.length ?? 0) > 0;
}

/**
 * Get direct children IDs of a node.
 */
export function getChildrenIds(snapshot: SnapshotNode | null, nodeId: string): string[] {
  const node = findNodeById(snapshot, nodeId);
  if (!node?.children) {
    return [];
  }
  return node.children.map((child) => child.id);
}
