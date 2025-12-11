/** biome-ignore-all lint/suspicious/noExplicitAny: Used for generics */
import { nanoid } from 'nanoid';
import type { DocumentDefinition, NodeDataFromDocument } from '../documents';
import { NodeNotFoundError, ValidationError } from './errors';
import { generateIndex, type SiblingInfo } from './indexing';
import type { TreeUtils } from './tree';
import type { AnyNodeDataFromDocument, Handle, NodesAccessor } from './types';

/**
 * Options for creating a node.
 */
export interface CreateNodeOptions<TData> {
  /** Custom ID for the node. If not provided, one will be generated. */
  id?: string;
  /** Parent node ID */
  parentId: string;
  /** ID of sibling to insert before. null = insert at end */
  beforeSiblingId?: string | null;
  /** Additional node data to merge with defaults */
  data?: Partial<Omit<TData, 'id' | 'type' | 'parent'>>;
}

/**
 * Options for moving a node.
 */
export interface MoveNodeOptions {
  /** New parent node ID */
  parentId: string;
  /** ID of sibling to insert before. null = insert at end */
  beforeSiblingId?: string | null;
}

/**
 * Editor commands for high-level operations.
 * All operations are atomic and handle index management automatically.
 */
export interface EditorCommands<TDoc extends DocumentDefinition<any>> {
  /**
   * Create a new node with automatic index generation.
   *
   * @param nodeType - Type of node to create
   * @param options - Creation options including parent and position
   * @returns Handle to the created node
   */
  createNode<K extends keyof TDoc['nodes']>(
    nodeType: K,
    options: CreateNodeOptions<NodeDataFromDocument<TDoc, K>>
  ): Handle<NodeDataFromDocument<TDoc, K>>;

  /**
   * Delete a node and all its descendants.
   *
   * @param nodeId - ID of the node to delete
   * @throws NodeNotFoundError if the node doesn't exist
   */
  deleteSubtree(nodeId: string): void;

  /**
   * Move a node to a new parent and/or position.
   * Handles index generation automatically.
   *
   * @param nodeId - ID of the node to move
   * @param options - Move options including new parent and position
   * @throws NodeNotFoundError if the node or parent doesn't exist
   * @throws ValidationError if move would create a cycle
   */
  moveNode(nodeId: string, options: MoveNodeOptions): void;
}

/**
 * Node data with parent information.
 */
interface NodeWithParent {
  id: string;
  type: string;
  parent?: { id: string; index: string };
}

/**
 * Create commands implementation for the editor.
 */
export function createCommands<TDoc extends DocumentDefinition<any>>(
  document: TDoc,
  nodes: NodesAccessor<TDoc>,
  tree: TreeUtils<TDoc>,
  getNodes: () => Record<string, unknown>
): EditorCommands<TDoc> {
  /**
   * Get siblings for index calculation.
   */
  function getSiblings(
    parentId: string,
    excludeNodeId?: string
  ): SiblingInfo[] {
    const children = tree.getSortedChildren(parentId);
    return children
      .map((handle) => {
        const node = handle.get() as NodeWithParent;
        return {
          id: node.id,
          index: node.parent?.index ?? ''
        };
      })
      .filter((s) => s.id !== excludeNodeId);
  }

  return {
    createNode<K extends keyof TDoc['nodes']>(
      nodeType: K,
      options: CreateNodeOptions<NodeDataFromDocument<TDoc, K>>
    ): Handle<NodeDataFromDocument<TDoc, K>> {
      const { id = nanoid(), parentId, beforeSiblingId = null, data } = options;

      // Verify parent exists
      const parentHandle = nodes.get(parentId);
      if (!parentHandle) {
        throw new NodeNotFoundError(parentId);
      }

      // Calculate fractional index
      const siblings = getSiblings(parentId);
      const index = generateIndex(siblings, beforeSiblingId);

      // Create the node
      return nodes.create(nodeType, {
        id,
        parent: { id: parentId, index },
        ...data
      } as any);
    },

    deleteSubtree(nodeId: string): void {
      const handle = nodes.get(nodeId);
      if (!handle) {
        throw new NodeNotFoundError(nodeId);
      }

      // Get all descendants first (we need the IDs before deleting)
      const descendants = tree.getDescendants(nodeId);
      const descendantIds = descendants.map(
        (h) => (h.get() as NodeWithParent).id
      );

      // Delete in reverse order (children before parents) to avoid issues
      for (const id of descendantIds.reverse()) {
        try {
          nodes.delete(id);
        } catch {
          // Node might already be deleted, continue
        }
      }

      // Delete the root node
      nodes.delete(nodeId);
    },

    moveNode(nodeId: string, options: MoveNodeOptions): void {
      const { parentId, beforeSiblingId = null } = options;

      // Get the node to move
      const handle = nodes.get(nodeId);
      if (!handle) {
        throw new NodeNotFoundError(nodeId);
      }

      // Verify new parent exists
      const parentHandle = nodes.get(parentId);
      if (!parentHandle) {
        throw new NodeNotFoundError(parentId);
      }

      // Prevent moving a node into itself or its descendants
      if (nodeId === parentId || tree.isDescendantOf(parentId, nodeId)) {
        throw new ValidationError(
          nodeId,
          'Cannot move a node into itself or its descendants'
        );
      }

      // Calculate new index (exclude the node being moved from siblings)
      const siblings = getSiblings(parentId, nodeId);
      const newIndex = generateIndex(siblings, beforeSiblingId);

      // Update the node
      const nodeData = handle.get() as NodeWithParent;
      handle.set({
        ...nodeData,
        parent: { id: parentId, index: newIndex }
      } as AnyNodeDataFromDocument<TDoc>);
    }
  };
}
