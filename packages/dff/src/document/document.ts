import { Effect } from 'effect';
import type * as Y from 'yjs';
import type {
  ColumnNodeData,
  NodeData,
  NodeDataWithoutRoot,
  RootNodeData,
  RowNodeData,
  ScreenNodeData,
  TextNodeData
} from '../schema';
import {
  deleteNode,
  getAllNodes,
  getNode,
  getRootNode,
  type NodeNotFoundError,
  type NodeParseError,
  setNode,
  setRootNode,
  updateNodeProperties
} from './conversions';

// ============================================================================
// DesignDocument Class
// ============================================================================

/**
 * DesignDocument provides a type-safe wrapper around a Y.Doc for design files.
 *
 * All mutations go through Effect Schema validation before being written to Yjs,
 * ensuring the document always contains valid data.
 *
 * @example
 * ```ts
 * const doc = new Y.Doc();
 * const designDoc = new DesignDocument(doc);
 *
 * // Create root node
 * Effect.runSync(designDoc.createRootNode());
 *
 * // Add a screen
 * Effect.runSync(designDoc.setNode({
 *   type: 'screen',
 *   id: 'screen-1',
 *   name: 'Main Screen',
 *   parent: { id: 'root', index: 'a0' },
 *   x: 0,
 *   y: 0,
 *   width: 375,
 *   height: 812
 * }));
 * ```
 */
export class DesignDocument {
  private readonly nodesMap: Y.Map<unknown>;

  constructor(private readonly doc: Y.Doc) {
    this.nodesMap = doc.getMap('nodes');
  }

  // ==========================================================================
  // Accessors
  // ==========================================================================

  /** Get the underlying Y.Doc */
  get ydoc(): Y.Doc {
    return this.doc;
  }

  /** Get the underlying Y.Map for nodes */
  get nodes(): Y.Map<unknown> {
    return this.nodesMap;
  }

  // ==========================================================================
  // Read Operations
  // ==========================================================================

  /**
   * Get a node by ID with schema validation
   */
  getNode(
    nodeId: string
  ): Effect.Effect<NodeData, NodeNotFoundError | NodeParseError> {
    return getNode(this.nodesMap, nodeId);
  }

  /**
   * Get all nodes with schema validation
   */
  getAllNodes(): Effect.Effect<Record<string, NodeData>, NodeParseError> {
    return getAllNodes(this.nodesMap);
  }

  /**
   * Get the root node
   */
  getRootNode(
    rootId = 'root'
  ): Effect.Effect<RootNodeData, NodeNotFoundError | NodeParseError> {
    return getRootNode(this.nodesMap, rootId);
  }

  /**
   * Check if a node exists
   */
  hasNode(nodeId: string): boolean {
    return this.nodesMap.has(nodeId);
  }

  // ==========================================================================
  // Write Operations
  // ==========================================================================

  /**
   * Set a node (create or replace)
   */
  setNode(node: NodeData): Effect.Effect<void, NodeParseError> {
    return setNode(this.nodesMap, node);
  }

  /**
   * Create the root node
   */
  createRootNode(rootId = 'root'): Effect.Effect<RootNodeData, NodeParseError> {
    return setRootNode(this.nodesMap, rootId);
  }

  /**
   * Delete a node by ID
   */
  deleteNode(nodeId: string): Effect.Effect<void, NodeNotFoundError> {
    return deleteNode(this.nodesMap, nodeId);
  }

  // ==========================================================================
  // Typed Update Operations
  // ==========================================================================

  /**
   * Update a screen node's properties atomically
   */
  updateScreenNode(
    nodeId: string,
    updates: Partial<Omit<ScreenNodeData, 'id' | 'type'>>
  ): Effect.Effect<ScreenNodeData, NodeNotFoundError | NodeParseError> {
    return updateNodeProperties<ScreenNodeData>(this.nodesMap, nodeId, updates);
  }

  /**
   * Update a text node's properties atomically
   */
  updateTextNode(
    nodeId: string,
    updates: Partial<Omit<TextNodeData, 'id' | 'type'>>
  ): Effect.Effect<TextNodeData, NodeNotFoundError | NodeParseError> {
    return updateNodeProperties<TextNodeData>(this.nodesMap, nodeId, updates);
  }

  /**
   * Update a column node's properties atomically
   */
  updateColumnNode(
    nodeId: string,
    updates: Partial<Omit<ColumnNodeData, 'id' | 'type'>>
  ): Effect.Effect<ColumnNodeData, NodeNotFoundError | NodeParseError> {
    return updateNodeProperties<ColumnNodeData>(this.nodesMap, nodeId, updates);
  }

  /**
   * Update a row node's properties atomically
   */
  updateRowNode(
    nodeId: string,
    updates: Partial<Omit<RowNodeData, 'id' | 'type'>>
  ): Effect.Effect<RowNodeData, NodeNotFoundError | NodeParseError> {
    return updateNodeProperties<RowNodeData>(this.nodesMap, nodeId, updates);
  }

  /**
   * Update any non-root node's properties atomically
   */
  updateNode<T extends NodeDataWithoutRoot>(
    nodeId: string,
    updates: Partial<Omit<T, 'id' | 'type'>>
  ): Effect.Effect<T, NodeNotFoundError | NodeParseError> {
    return updateNodeProperties<T>(this.nodesMap, nodeId, updates);
  }

  // ==========================================================================
  // Batch Operations (within transaction)
  // ==========================================================================

  /**
   * Execute multiple operations within a Yjs transaction.
   * All changes are batched and emitted as a single update.
   */
  transact<A, E>(fn: () => Effect.Effect<A, E>): Effect.Effect<A, E> {
    const doc = this.doc;
    return Effect.gen(function* () {
      let result: A;
      let error: E | undefined;
      let hasError = false;

      doc.transact(() => {
        const effect = fn();
        const exit = Effect.runSyncExit(effect);

        if (exit._tag === 'Success') {
          result = exit.value;
        } else {
          hasError = true;
          // Extract the error from the cause
          if (exit.cause._tag === 'Fail') {
            error = exit.cause.error;
          }
        }
      });

      if (hasError && error !== undefined) {
        return yield* Effect.fail(error);
      }

      return result!;
    });
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a DesignDocument from an existing Y.Doc
 */
export function createDesignDocument(doc: Y.Doc): DesignDocument {
  return new DesignDocument(doc);
}

/**
 * Wrap an existing Y.Doc as a DesignDocument - alias for createDesignDocument
 */
export const fromYDoc = createDesignDocument;
