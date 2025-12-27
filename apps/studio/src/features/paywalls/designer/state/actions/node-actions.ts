/**
 * Node commands using zustand-commander.
 *
 * These commands manage node deletion, copy, cut, and paste operations.
 * Uses undoable actions for undo/redo support on delete operations.
 */

import { Schema } from 'effect';
import { commander } from '../designer-commander';
import { clearSelection, selectNode } from './selection-actions';

// =============================================================================
// Helper Types
// =============================================================================

interface NodeSnapshot {
  id: string;
  type: string;
  parentId?: string | null;
  children?: NodeSnapshot[];
  [key: string]: unknown;
}

interface SerializedNode {
  id: string;
  type: string;
  data: Record<string, unknown>;
  children: SerializedNode[];
}

interface ClipboardData {
  __voidhash: true;
  nodes: SerializedNode[];
  originalParentId: string | null;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Container node types that can accept children.
 */
const CONTAINER_TYPES = new Set(['root', 'screen', 'flex']);

/**
 * Checks if a node type is a container that can accept children.
 */
function isContainerType(nodeType: string): boolean {
  return CONTAINER_TYPES.has(nodeType);
}

/**
 * Find a node in the snapshot tree.
 */
function findNodeInSnapshot(
  snapshot: NodeSnapshot | null,
  nodeId: string
): NodeSnapshot | null {
  if (!snapshot) {
    return null;
  }

  if (snapshot.id === nodeId) {
    return snapshot;
  }

  if (snapshot.children && Array.isArray(snapshot.children)) {
    for (const child of snapshot.children) {
      const found = findNodeInSnapshot(child, nodeId);
      if (found) {
        return found;
      }
    }
  }

  return null;
}

/**
 * Get nodes as a flat map from snapshot.
 */
function getNodesFromSnapshot(
  snapshot: NodeSnapshot | null
): Record<string, NodeSnapshot> {
  if (!snapshot) {
    return {};
  }

  const nodes: Record<string, NodeSnapshot> = {};

  const traverse = (node: NodeSnapshot): void => {
    nodes[node.id] = node;
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  };

  traverse(snapshot);
  return nodes;
}

/**
 * Serialize a node and its children for clipboard.
 */
function serializeNode(node: NodeSnapshot): SerializedNode {
  const { id, type, children, parentId: _parentId, ...data } = node;
  // parentId is destructured and ignored to avoid issues
  return {
    id,
    type,
    data,
    children: (children ?? []).map(serializeNode)
  };
}

/**
 * Parse clipboard data from text.
 */
function parseClipboardData(text: string): ClipboardData | null {
  try {
    const parsed = JSON.parse(text);
    if (parsed.__voidhash && Array.isArray(parsed.nodes)) {
      return parsed as ClipboardData;
    }
  } catch {
    // Not valid JSON
  }
  return null;
}

/**
 * Generate a new unique ID.
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// =============================================================================
// Node Commands
// =============================================================================

/**
 * Delete selected nodes and all their descendants.
 * Undoable: restores the deleted nodes on undo.
 */
export const deleteNodes = commander.undoableAction(
  Schema.Struct({}),
  (ctx) => {
    const state = ctx.getState();
    const { mimic } = state;

    const selectedNodeIds = mimic.presence?.self?.selectedNodeIds ?? [];
    if (selectedNodeIds.length === 0) {
      return {
        deletedNodes: [] as Array<{
          serialized: SerializedNode;
          parentId: string | null;
          index: number;
        }>
      };
    }

    const snapshot = mimic.snapshot as NodeSnapshot | null;
    const deletedNodes: Array<{
      serialized: SerializedNode;
      parentId: string | null;
      index: number;
    }> = [];

    // Capture state before deletion
    for (const selectedId of selectedNodeIds) {
      const node = findNodeInSnapshot(snapshot, selectedId);
      if (!node) {
        continue;
      }

      // Prevent deletion of root and screen nodes
      if (node.type === 'root' || node.type === 'screen') {
        continue;
      }

      // Find parent and index
      let parentId: string | null = null;
      let index = 0;

      if (snapshot) {
        const findParentAndIndex = (
          parent: NodeSnapshot,
          targetId: string
        ): { parentId: string; index: number } | null => {
          if (parent.children) {
            for (let i = 0; i < parent.children.length; i++) {
              const child = parent.children[i];
              if (child && child.id === targetId) {
                return { parentId: parent.id, index: i };
              }
              if (child) {
                const found = findParentAndIndex(child, targetId);
                if (found) {
                  return found;
                }
              }
            }
          }
          return null;
        };

        const parentInfo = findParentAndIndex(snapshot, selectedId);
        if (parentInfo) {
          parentId = parentInfo.parentId;
          index = parentInfo.index;
        }
      }

      deletedNodes.push({
        serialized: serializeNode(node),
        parentId,
        index
      });
    }

    // Perform deletion
    mimic.document.transaction((root) => {
      for (const { serialized } of deletedNodes) {
        try {
          root.remove(serialized.id);
        } catch {
          // Node might already be deleted
        }
      }
    });

    // Clear selection after deletion
    ctx.dispatch(clearSelection)({});

    return { deletedNodes };
  },
  (ctx, _params, result) => {
    if (result.deletedNodes.length === 0) {
      return;
    }

    const { mimic } = ctx.getState();

    // Restore deleted nodes
    mimic.document.transaction((root) => {
      const restoreNode = (
        serialized: SerializedNode,
        parentId: string | null,
        index: number
      ) => {
        if (parentId !== null) {
          try {
            // Use insertAt to restore at original position
            root.insertAt(
              parentId,
              index,
              { type: serialized.type } as never,
              serialized.data as never
            );
          } catch {
            // Failed to restore
          }
        }
      };

      // Restore in reverse order to maintain indices
      for (let i = result.deletedNodes.length - 1; i >= 0; i--) {
        const deleted = result.deletedNodes[i];
        if (deleted) {
          restoreNode(deleted.serialized, deleted.parentId, deleted.index);
        }
      }
    });
  }
);

/**
 * Copy selected nodes to clipboard.
 * Non-undoable (read-only operation).
 */
export const copyNodes = commander.action(Schema.Struct({}), async (ctx) => {
  const state = ctx.getState();
  const { mimic } = state;

  const selectedNodeIds = mimic.presence?.self?.selectedNodeIds ?? [];
  if (selectedNodeIds.length === 0) {
    return;
  }

  const snapshot = mimic.snapshot as NodeSnapshot | null;
  const nodes = getNodesFromSnapshot(snapshot);

  // Filter out root and screen nodes
  const nodeIdsToCopy = selectedNodeIds.filter((id) => {
    const node = nodes[id];
    return node && node.type !== 'root' && node.type !== 'screen';
  });

  if (nodeIdsToCopy.length === 0) {
    return;
  }

  // Serialize nodes
  const serializedNodes: SerializedNode[] = [];
  let originalParentId: string | null = null;

  for (const nodeId of nodeIdsToCopy) {
    const node = findNodeInSnapshot(snapshot, nodeId);
    if (node) {
      serializedNodes.push(serializeNode(node));
      // Use the first node's parent as the original parent
      if (originalParentId === null) {
        // Find parent
        const findParent = (
          parent: NodeSnapshot,
          targetId: string
        ): string | null => {
          if (parent.children) {
            for (const child of parent.children) {
              if (child.id === targetId) {
                return parent.id;
              }
              const found = findParent(child, targetId);
              if (found) {
                return found;
              }
            }
          }
          return null;
        };
        if (snapshot) {
          originalParentId = findParent(snapshot, nodeId);
        }
      }
    }
  }

  if (serializedNodes.length === 0) {
    return;
  }

  // Write to clipboard
  const clipboardData: ClipboardData = {
    __voidhash: true,
    nodes: serializedNodes,
    originalParentId
  };

  try {
    await navigator.clipboard.writeText(JSON.stringify(clipboardData));
  } catch {
    // Clipboard API might not be available
  }
});

/**
 * Cut selected nodes (copy then delete).
 */
export const cutNodes = commander.action(Schema.Struct({}), async (ctx) => {
  // Copy first
  await ctx.dispatch(copyNodes)({});

  // Then delete
  ctx.dispatch(deleteNodes)({});
});

/**
 * Paste nodes from clipboard.
 * Note: This is a regular action (not undoable) since it modifies async state.
 * Use deleteNodes to undo a paste operation.
 */
export const pasteNodes = commander.action(Schema.Struct({}), async (ctx) => {
  // Read from clipboard
  let clipboardText: string;
  try {
    clipboardText = await navigator.clipboard.readText();
  } catch {
    return;
  }

  // Parse clipboard data
  const clipboardData = parseClipboardData(clipboardText);
  if (!clipboardData || clipboardData.nodes.length === 0) {
    return;
  }

  const state = ctx.getState();
  const { mimic } = state;
  const selectedNodeIds = mimic.presence?.self?.selectedNodeIds ?? [];
  const snapshot = mimic.snapshot as NodeSnapshot | null;
  const nodes = getNodesFromSnapshot(snapshot);

  // Determine paste location (smart paste)
  let targetParentId: string | null = null;

  if (selectedNodeIds.length > 0) {
    const firstSelectedId = selectedNodeIds[0];
    if (firstSelectedId) {
      const selectedNode = nodes[firstSelectedId];

      if (
        selectedNode &&
        isContainerType(selectedNode.type) &&
        selectedNode.type !== 'root'
      ) {
        // Paste as child of selected container
        targetParentId = firstSelectedId;
      } else if (clipboardData.originalParentId) {
        // Paste at original parent
        targetParentId = clipboardData.originalParentId;
      }
    }
  } else if (clipboardData.originalParentId) {
    // No selection, paste at original parent
    targetParentId = clipboardData.originalParentId;
  }

  // Verify target parent exists
  if (targetParentId === null || !nodes[targetParentId]) {
    return;
  }

  const pastedNodeIds: string[] = [];
  const finalTargetParentId = targetParentId;

  // Insert nodes with new IDs
  mimic.document.transaction((root) => {
    const insertNode = (
      serialized: SerializedNode,
      parentId: string
    ): string => {
      const newId = generateId();
      pastedNodeIds.push(newId);

      // Note: This is a simplified paste - in practice you'd need
      // to use the proper node type constructors
      try {
        root.insertLast(
          parentId,
          { type: serialized.type } as never,
          {
            ...serialized.data,
            id: newId
          } as never
        );

        // Recursively insert children
        for (const child of serialized.children) {
          insertNode(child, newId);
        }
      } catch {
        // Failed to insert
      }

      return newId;
    };

    for (const serialized of clipboardData.nodes) {
      insertNode(serialized, finalTargetParentId);
    }
  });

  // Select newly pasted nodes
  if (pastedNodeIds.length > 0) {
    ctx.dispatch(clearSelection)({});
    const firstPastedId = pastedNodeIds[0];
    if (firstPastedId) {
      ctx.dispatch(selectNode)({ id: firstPastedId, many: false });
    }

    for (let i = 1; i < pastedNodeIds.length; i++) {
      const pastedId = pastedNodeIds[i];
      if (pastedId) {
        ctx.dispatch(selectNode)({ id: pastedId, many: true });
      }
    }
  }
});
