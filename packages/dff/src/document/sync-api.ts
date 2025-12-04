/**
 * Synchronous API for DesignDocument operations.
 * These functions are designed for use in voidsync actions where
 * Effect.gen patterns aren't available.
 */

import { Schema } from 'effect';
import type * as Y from 'yjs';
import {
  type NodeData,
  NodeSchema,
  type RootNodeData,
  RootNodeSchema
} from '../schema';

// ============================================================================
// Read Operations (Synchronous)
// ============================================================================

/**
 * Get a node by ID with schema validation.
 * Returns undefined if not found or invalid.
 */
export function getNodeSync(
  nodesMap: Y.Map<unknown>,
  nodeId: string
): NodeData | undefined {
  const rawValue = nodesMap.get(nodeId);
  if (rawValue === undefined) {
    return;
  }

  const result = Schema.decodeUnknownSync(NodeSchema)(rawValue);
  return result;
}

/**
 * Get all nodes with schema validation.
 * Invalid nodes are skipped.
 */
export function getAllNodesSync(
  nodesMap: Y.Map<unknown>
): Record<string, NodeData> {
  const result: Record<string, NodeData> = {};
  for (const [id, rawValue] of nodesMap.entries()) {
    try {
      const node = Schema.decodeUnknownSync(NodeSchema)(rawValue);
      result[id] = node;
    } catch {
      // Skip invalid nodes
    }
  }
  return result;
}

// ============================================================================
// Write Operations (Synchronous)
// ============================================================================

/**
 * Encode and set a node in the Y.Map.
 * Uses the appropriate schema based on node type.
 */
export function setNodeSync(nodesMap: Y.Map<unknown>, node: NodeData): void {
  const encoded = Schema.encodeSync(NodeSchema)(node);
  nodesMap.set(node.id, encoded);
}

/**
 * Set a root node
 */
export function setRootNodeSync(
  nodesMap: Y.Map<unknown>,
  rootId = 'root'
): RootNodeData {
  const rootNode: RootNodeData = { type: 'root', id: rootId };
  const encoded = Schema.encodeSync(RootNodeSchema)(rootNode);
  nodesMap.set(rootId, encoded);
  return rootNode;
}

// ============================================================================
// Update Operations (Synchronous) - Atomic property updates
// ============================================================================

/**
 * Update any non-root node's parent reference (for moving nodes).
 */
export function updateNodeParentSync(
  nodesMap: Y.Map<unknown>,
  nodeId: string,
  newParent: { id: string; index: string }
): NodeData | undefined {
  const existing = getNodeSync(nodesMap, nodeId);
  if (!existing || existing.type === 'root') {
    return;
  }

  const updatedNode = {
    ...existing,
    parent: newParent
  };

  setNodeSync(nodesMap, updatedNode);
  return updatedNode;
}
