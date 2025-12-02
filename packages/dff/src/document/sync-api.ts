/**
 * Synchronous API for DesignDocument operations.
 * These functions are designed for use in voidsync actions where
 * Effect.gen patterns aren't available.
 */

import { Schema } from 'effect';
import type * as Y from 'yjs';
import {
  type ColumnNodeData,
  ColumnNodeSchema,
  type NodeData,
  NodeSchema,
  type RootNodeData,
  RootNodeSchema,
  type RowNodeData,
  RowNodeSchema,
  type ScreenNodeData,
  ScreenNodeSchema,
  type TextNodeData,
  TextNodeSchema
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

/**
 * Set a screen node
 */
export function setScreenNodeSync(
  nodesMap: Y.Map<unknown>,
  node: ScreenNodeData
): void {
  const encoded = Schema.encodeSync(ScreenNodeSchema)(node);
  nodesMap.set(node.id, encoded);
}

/**
 * Set a text node
 */
export function setTextNodeSync(
  nodesMap: Y.Map<unknown>,
  node: TextNodeData
): void {
  const encoded = Schema.encodeSync(TextNodeSchema)(node);
  nodesMap.set(node.id, encoded);
}

/**
 * Set a column node
 */
export function setColumnNodeSync(
  nodesMap: Y.Map<unknown>,
  node: ColumnNodeData
): void {
  const encoded = Schema.encodeSync(ColumnNodeSchema)(node);
  nodesMap.set(node.id, encoded);
}

/**
 * Set a row node
 */
export function setRowNodeSync(
  nodesMap: Y.Map<unknown>,
  node: RowNodeData
): void {
  const encoded = Schema.encodeSync(RowNodeSchema)(node);
  nodesMap.set(node.id, encoded);
}

/**
 * Delete a node by ID
 */
export function deleteNodeSync(
  nodesMap: Y.Map<unknown>,
  nodeId: string
): boolean {
  if (!nodesMap.has(nodeId)) {
    return false;
  }
  nodesMap.delete(nodeId);
  return true;
}

// ============================================================================
// Update Operations (Synchronous) - Atomic property updates
// ============================================================================

/**
 * Update a screen node's properties.
 * Only modified properties are written.
 */
export function updateScreenNodeSync(
  nodesMap: Y.Map<unknown>,
  nodeId: string,
  updates: Partial<Omit<ScreenNodeData, 'id' | 'type'>>
): ScreenNodeData | undefined {
  const existing = getNodeSync(nodesMap, nodeId);
  if (!existing || existing.type !== 'screen') {
    return;
  }

  const updatedNode: ScreenNodeData = {
    ...existing,
    ...updates,
    id: existing.id,
    type: 'screen'
  };

  setScreenNodeSync(nodesMap, updatedNode);
  return updatedNode;
}

/**
 * Update a text node's properties.
 * Only modified properties are written.
 */
export function updateTextNodeSync(
  nodesMap: Y.Map<unknown>,
  nodeId: string,
  updates: Partial<Omit<TextNodeData, 'id' | 'type'>>
): TextNodeData | undefined {
  const existing = getNodeSync(nodesMap, nodeId);
  if (!existing || existing.type !== 'text') {
    return;
  }

  const updatedNode: TextNodeData = {
    ...existing,
    ...updates,
    id: existing.id,
    type: 'text'
  };

  setTextNodeSync(nodesMap, updatedNode);
  return updatedNode;
}

/**
 * Update a column node's properties.
 * Only modified properties are written.
 */
export function updateColumnNodeSync(
  nodesMap: Y.Map<unknown>,
  nodeId: string,
  updates: Partial<Omit<ColumnNodeData, 'id' | 'type'>>
): ColumnNodeData | undefined {
  const existing = getNodeSync(nodesMap, nodeId);
  if (!existing || existing.type !== 'column') {
    return;
  }

  const updatedNode: ColumnNodeData = {
    ...existing,
    ...updates,
    id: existing.id,
    type: 'column'
  };

  setColumnNodeSync(nodesMap, updatedNode);
  return updatedNode;
}

/**
 * Update a row node's properties.
 * Only modified properties are written.
 */
export function updateRowNodeSync(
  nodesMap: Y.Map<unknown>,
  nodeId: string,
  updates: Partial<Omit<RowNodeData, 'id' | 'type'>>
): RowNodeData | undefined {
  const existing = getNodeSync(nodesMap, nodeId);
  if (!existing || existing.type !== 'row') {
    return;
  }

  const updatedNode: RowNodeData = {
    ...existing,
    ...updates,
    id: existing.id,
    type: 'row'
  };

  setRowNodeSync(nodesMap, updatedNode);
  return updatedNode;
}

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
