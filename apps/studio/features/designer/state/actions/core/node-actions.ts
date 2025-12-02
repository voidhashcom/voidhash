/** biome-ignore-all lint/suspicious/noExplicitAny: generic action types require any */

/**
 * Node action helpers for simplified creation and update of nodes.
 * Built on top of storeState.action for type-safe node operations.
 */

import {
  createNodeData,
  type NodeDef,
  type NodeDefData,
  setNodeSync
} from '@voidhash/dff';
import { Schema } from 'effect';
import { IndexGenerator } from 'fractional-indexing-jittered';
import type * as Y from 'yjs';
import type {
  ActionDispatchFn,
  AnyEffectSchema,
  VoidsyncSchema,
  VoidsyncState
} from '../../core/voidsync';
import { createNodeId } from '../../utils/id';
import { getNodesByParentId } from '../../utils/nodes';

// ============================================================================
// Types
// ============================================================================

/**
 * Context passed to the `after` callback for create node actions.
 */
type CreateNodeAfterContext<
  TSchema extends VoidsyncSchema<AnyEffectSchema, AnyEffectSchema, any>,
  TYdoc extends Y.Doc,
  TNodeDef extends NodeDef
> = {
  /** The action parameters passed by the caller */
  params: { parentId: string };
  /** Dispatch function to call other actions */
  dispatch: ActionDispatchFn<TSchema, TYdoc>;
  /** The newly created node data */
  node: NodeDefData<TNodeDef>;
};

/**
 * Context passed to the `after` callback for update node actions.
 */
type UpdateNodeAfterContext<
  TSchema extends VoidsyncSchema<AnyEffectSchema, AnyEffectSchema, any>,
  TYdoc extends Y.Doc,
  TNodeDef extends NodeDef,
  TParams
> = {
  /** The action parameters passed by the caller */
  params: TParams;
  /** Dispatch function to call other actions */
  dispatch: ActionDispatchFn<TSchema, TYdoc>;
  /** The updated node data */
  node: NodeDefData<TNodeDef>;
  /** The node data before the update */
  previousNode: NodeDefData<TNodeDef>;
};

/**
 * Options for createNodeAction
 */
type CreateNodeActionOptions<
  TSchema extends VoidsyncSchema<AnyEffectSchema, AnyEffectSchema, any>,
  TYdoc extends Y.Doc,
  TNodeDef extends NodeDef
> = {
  /** Callback executed after the node is created */
  after?: (ctx: CreateNodeAfterContext<TSchema, TYdoc, TNodeDef>) => void;
};

/**
 * Creates update params type from node data.
 * Includes id (required) and all other properties (optional).
 */
type UpdateParams<TNodeDef extends NodeDef> = {
  id: string;
} & Partial<Omit<NodeDefData<TNodeDef>, 'id' | 'type' | 'parent'>>;

/**
 * Options for updateNodeAction
 */
type UpdateNodeActionOptions<
  TSchema extends VoidsyncSchema<AnyEffectSchema, AnyEffectSchema, any>,
  TYdoc extends Y.Doc,
  TNodeDef extends NodeDef
> = {
  /** Callback executed after the node is updated */
  after?: (
    ctx: UpdateNodeAfterContext<
      TSchema,
      TYdoc,
      TNodeDef,
      UpdateParams<TNodeDef>
    >
  ) => void;
};

// ============================================================================
// Create Node Action
// ============================================================================

/**
 * Creates a type-safe action for creating nodes of a specific type.
 * Automatically handles:
 * - ID generation
 * - Fractional index calculation
 * - Default values from node definition
 * - Syncing to the Yjs document
 *
 * The node data type is automatically inferred from the nodeDef.
 *
 * @example
 * ```ts
 * export const createColumnNode = (storeState: DesignerStoreState) =>
 *   createNodeAction(storeState, columnNode, {
 *     after: ({ params, dispatch, node }) => {
 *       // node is fully typed as ColumnNodeData
 *       dispatch(selectNode)({ id: node.id, many: false });
 *       dispatch(setActiveTool)({ tool: 'cursor' });
 *     }
 *   });
 * ```
 */
export function createNodeAction<
  TSchema extends VoidsyncSchema<AnyEffectSchema, AnyEffectSchema, any>,
  TYdoc extends Y.Doc,
  TNodeDef extends NodeDef
>(
  storeState: VoidsyncState<TSchema, TYdoc>,
  nodeDef: TNodeDef,
  options?: CreateNodeActionOptions<TSchema, TYdoc, TNodeDef>
) {
  return storeState.action(
    Schema.Struct({ parentId: Schema.String }),
    ({ params, getState, doc, dispatch }) => {
      const state = getState();

      // Verify parent exists
      const nodes = (state as { nodes?: Record<string, unknown> }).nodes;
      const parentNode = nodes?.[params.parentId];
      if (!parentNode) {
        return;
      }

      // Generate ID and fractional index
      const id = createNodeId();
      const existingParentChildren = getNodesByParentId(
        nodes as Parameters<typeof getNodesByParentId>[0],
        params.parentId
      );
      const fractionalIndexes = existingParentChildren.map(
        (n) => n.parent.index
      );
      const generator = new IndexGenerator(fractionalIndexes);
      const index = generator.keyEnd();

      // Create node data with defaults from definition
      const nodeData = createNodeData(nodeDef, {
        id,
        parent: {
          id: params.parentId,
          index
        }
      }) as NodeDefData<TNodeDef>;

      // Sync to document
      setNodeSync(doc.getMap('nodes'), nodeData as any);

      // Call after hook if provided
      if (options?.after) {
        options.after({
          params,
          dispatch: dispatch as ActionDispatchFn<TSchema, TYdoc>,
          node: nodeData
        });
      }
    }
  );
}

// ============================================================================
// Update Node Action
// ============================================================================

/**
 * Creates a type-safe action for updating nodes of a specific type.
 * Automatically handles:
 * - Fetching the existing node
 * - Merging updates with existing data
 * - Syncing to the Yjs document
 *
 * The node data type is automatically inferred from the nodeDef.
 *
 * @example
 * ```ts
 * export const updateColumnNode = (storeState: DesignerStoreState) =>
 *   updateNodeAction(storeState, columnNode, {
 *     after: ({ params, dispatch, node, previousNode }) => {
 *       // node and previousNode are fully typed as ColumnNodeData
 *     }
 *   });
 * ```
 */
export function updateNodeAction<
  TSchema extends VoidsyncSchema<AnyEffectSchema, AnyEffectSchema, any>,
  TYdoc extends Y.Doc,
  TNodeDef extends NodeDef
>(
  storeState: VoidsyncState<TSchema, TYdoc>,
  nodeDef: TNodeDef,
  options?: UpdateNodeActionOptions<TSchema, TYdoc, TNodeDef>
) {
  // Build schema for update params dynamically from node properties
  const updateFields: Record<
    string,
    | Schema.Schema<string, string, never>
    | Schema.optional<Schema.Schema<any, any, never>>
  > = {
    id: Schema.String
  };

  for (const prop of nodeDef.properties) {
    // Make all properties optional for updates
    updateFields[prop.name] = Schema.optional(prop.schema as any);
  }

  const UpdateParamsSchema = Schema.Struct(
    updateFields as Schema.Struct.Fields
  );

  return storeState.action(
    UpdateParamsSchema,
    ({ params, getState, doc, dispatch }) => {
      const state = getState();

      // Get existing node
      const nodes = (state as { nodes?: Record<string, any> }).nodes;
      const existingNode = nodes?.[params.id] as
        | NodeDefData<TNodeDef>
        | undefined;

      if (!existingNode || (existingNode as any).type !== nodeDef.type) {
        return;
      }

      // Build updates object (excluding undefined values)
      const updates: Record<string, unknown> = {};
      for (const prop of nodeDef.properties) {
        const value = (params as Record<string, unknown>)[prop.name];
        if (value !== undefined) {
          updates[prop.name] = value;
        }
      }

      // Merge with existing node
      const updatedNode = {
        ...existingNode,
        ...updates,
        id: (existingNode as any).id,
        type: (existingNode as any).type
      } as NodeDefData<TNodeDef>;

      // Sync to document
      setNodeSync(doc.getMap('nodes'), updatedNode as any);

      // Call after hook if provided
      if (options?.after) {
        options.after({
          params: params as UpdateParams<TNodeDef>,
          dispatch: dispatch as ActionDispatchFn<TSchema, TYdoc>,
          node: updatedNode,
          previousNode: existingNode
        });
      }
    }
  );
}
