import { Effect, Schema } from 'effect';
import type * as Y from 'yjs';
import {
  type NodeData,
  type NodeDataWithoutRoot,
  NodeSchema,
  type RootNodeData
} from '../schema';

// ============================================================================
// Conversion Errors
// ============================================================================

export class NodeParseError {
  readonly _tag = 'NodeParseError';
  constructor(
    readonly nodeId: string,
    readonly cause: unknown
  ) {}
}

export class NodeNotFoundError {
  readonly _tag = 'NodeNotFoundError';
  constructor(readonly nodeId: string) {}
}

// ============================================================================
// fromYjs - Read from Yjs document
// ============================================================================

/**
 * Parse a raw value from yjs into a validated NodeData
 */
export function parseNode(
  nodeId: string,
  rawValue: unknown
): Effect.Effect<NodeData, NodeParseError> {
  return Effect.mapError(
    Schema.decodeUnknown(NodeSchema)(rawValue),
    (cause) => new NodeParseError(nodeId, cause)
  );
}

/**
 * Read a single node from a Y.Map
 */
export function getNode(
  nodesMap: Y.Map<unknown>,
  nodeId: string
): Effect.Effect<NodeData, NodeNotFoundError | NodeParseError> {
  return Effect.gen(function* () {
    const rawValue = nodesMap.get(nodeId);
    if (rawValue === undefined) {
      return yield* Effect.fail(new NodeNotFoundError(nodeId));
    }
    return yield* parseNode(nodeId, rawValue);
  });
}

/**
 * Read all nodes from a Y.Map
 */
export function getAllNodes(
  nodesMap: Y.Map<unknown>
): Effect.Effect<Record<string, NodeData>, NodeParseError> {
  return Effect.gen(function* () {
    const result: Record<string, NodeData> = {};
    for (const [id, rawValue] of nodesMap.entries()) {
      const node = yield* parseNode(id, rawValue);
      result[id] = node;
    }
    return result;
  });
}

// ============================================================================
// toYjs - Write to Yjs document
// ============================================================================

/**
 * Encode a NodeData to a plain object suitable for Yjs storage.
 * Effect Schema's encode handles optional fields with defaults properly.
 */
export function encodeNode(
  node: NodeData
): Effect.Effect<Record<string, unknown>, NodeParseError> {
  return Effect.mapError(
    Schema.encode(NodeSchema)(node),
    (cause) => new NodeParseError(node.id, cause)
  );
}

/**
 * Set a node in the Y.Map after validation and encoding
 */
export function setNode(
  nodesMap: Y.Map<unknown>,
  node: NodeData
): Effect.Effect<void, NodeParseError> {
  return Effect.gen(function* () {
    const encoded = yield* encodeNode(node);
    nodesMap.set(node.id, encoded);
  });
}

/**
 * Update specific properties of an existing node.
 * Only the specified properties will be written to Yjs for atomic updates.
 */
export function updateNodeProperties<T extends NodeDataWithoutRoot>(
  nodesMap: Y.Map<unknown>,
  nodeId: string,
  updates: Partial<Omit<T, 'id' | 'type'>>
): Effect.Effect<T, NodeNotFoundError | NodeParseError> {
  return Effect.gen(function* () {
    const existingNode = yield* getNode(nodesMap, nodeId);

    // Type guard - root nodes cannot be updated this way
    if (existingNode.type === 'root') {
      return yield* Effect.fail(
        new NodeParseError(nodeId, 'Cannot update root node properties')
      );
    }

    // Merge updates with existing node
    const updatedNode = {
      ...existingNode,
      ...updates,
      id: existingNode.id, // Ensure id cannot be changed
      type: existingNode.type // Ensure type cannot be changed
    } as T;

    // Validate and encode the updated node
    const encoded = yield* encodeNode(updatedNode);

    // Write to yjs
    nodesMap.set(nodeId, encoded);

    return updatedNode;
  });
}

/**
 * Delete a node from the Y.Map
 */
export function deleteNode(
  nodesMap: Y.Map<unknown>,
  nodeId: string
): Effect.Effect<void, NodeNotFoundError> {
  return Effect.gen(function* () {
    if (!nodesMap.has(nodeId)) {
      return yield* Effect.fail(new NodeNotFoundError(nodeId));
    }
    nodesMap.delete(nodeId);
  });
}

// ============================================================================
// Root Node Operations
// ============================================================================

/**
 * Create and set the root node
 */
export function setRootNode(
  nodesMap: Y.Map<unknown>,
  rootId = 'root'
): Effect.Effect<RootNodeData, NodeParseError> {
  return Effect.gen(function* () {
    const rootNode: RootNodeData = {
      type: 'root',
      id: rootId
    };
    yield* setNode(nodesMap, rootNode);
    return rootNode;
  });
}

/**
 * Get the root node from the document
 */
export function getRootNode(
  nodesMap: Y.Map<unknown>,
  rootId = 'root'
): Effect.Effect<RootNodeData, NodeNotFoundError | NodeParseError> {
  return Effect.gen(function* () {
    const node = yield* getNode(nodesMap, rootId);
    if (node.type !== 'root') {
      return yield* Effect.fail(
        new NodeParseError(rootId, 'Expected root node but got ' + node.type)
      );
    }
    return node;
  });
}
