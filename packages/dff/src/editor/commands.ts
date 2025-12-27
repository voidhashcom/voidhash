// /** biome-ignore-all lint/suspicious/noExplicitAny: Used for generics */
// import { nanoid } from 'nanoid';
// import type { DocumentDefinition, NodeDataFromDocument } from '../documents';
// import type { Variable } from '../nodes/base';
// import type { DNF } from '../states';
// import { stateSchema } from '../states/states';
// import {
//   booleanVariableTypeSchema,
//   numberVariableTypeSchema,
//   productVariableTypeSchema,
//   stringVariableTypeSchema,
//   type VariableType,
//   type VariableTypeKey
// } from '../variables';
// import { variableSchema } from '../variables/variables';
// import { NodeNotFoundError, ValidationError } from './errors';
// import { generateIndex, type SiblingInfo } from './indexing';
// import type { TreeUtils } from './tree';
// import type { AnyNodeDataFromDocument, Handle, NodesAccessor } from './types';

// /**
//  * Options for creating a node.
//  */
// export interface CreateNodeOptions<TData> {
//   /** Custom ID for the node. If not provided, one will be generated. */
//   id?: string;
//   /** Parent node ID */
//   parentId: string;
//   /** ID of sibling to insert before. null = insert at end */
//   beforeSiblingId?: string | null;
//   /** Additional node data to merge with defaults */
//   data?: Partial<Omit<TData, 'id' | 'type' | 'parent'>>;
// }

// /**
//  * Options for moving a node.
//  */
// export interface MoveNodeOptions {
//   /** New parent node ID */
//   parentId: string;
//   /** ID of sibling to insert before. null = insert at end */
//   beforeSiblingId?: string | null;
// }

// /**
//  * Editor commands for high-level operations.
//  * All operations are atomic and handle index management automatically.
//  */
// export interface EditorCommands<TDoc extends DocumentDefinition<any>> {
//   /**
//    * Create a new node with automatic index generation.
//    *
//    * @param nodeType - Type of node to create
//    * @param options - Creation options including parent and position
//    * @returns Handle to the created node
//    */
//   createNode<K extends keyof TDoc['nodes']>(
//     nodeType: K,
//     options: CreateNodeOptions<NodeDataFromDocument<TDoc, K>>
//   ): Handle<NodeDataFromDocument<TDoc, K>>;

//   /**
//    * Delete a node and all its descendants.
//    *
//    * @param nodeId - ID of the node to delete
//    * @throws NodeNotFoundError if the node doesn't exist
//    */
//   deleteSubtree(nodeId: string): void;

//   /**
//    * Move a node to a new parent and/or position.
//    * Handles index generation automatically.
//    *
//    * @param nodeId - ID of the node to move
//    * @param options - Move options including new parent and position
//    * @throws NodeNotFoundError if the node or parent doesn't exist
//    * @throws ValidationError if move would create a cycle
//    */
//   moveNode(nodeId: string, options: MoveNodeOptions): void;

//   /**
//    * Add a variable to a node's localVariables array.
//    *
//    * @param nodeId - ID of the node
//    * @param type - Type of variable to add
//    * @param name - Name of the variable
//    * @returns The ID of the created variable
//    * @throws NodeNotFoundError if the node doesn't exist
//    * @throws ValidationError if a variable with the same name already exists
//    */
//   addVariable(nodeId: string, type: VariableTypeKey, name: string): string;

//   /**
//    * Remove a variable from a node's localVariables array by ID.
//    *
//    * @param nodeId - ID of the node
//    * @param variableId - ID of the variable to remove
//    * @throws NodeNotFoundError if the node doesn't exist
//    * @throws ValidationError if the variable doesn't exist
//    */
//   removeVariable(nodeId: string, variableId: string): void;

//   /**
//    * Update a variable's name or value in a node's localVariables array.
//    *
//    * @param nodeId - ID of the node
//    * @param variableId - ID of the variable to update
//    * @param updates - Updates to apply (newName and/or newValue)
//    * @throws NodeNotFoundError if the node doesn't exist
//    * @throws ValidationError if the variable doesn't exist or new name conflicts
//    */
//   updateVariable(
//     nodeId: string,
//     variableId: string,
//     updates: {
//       newName?: string;
//       newValue?: VariableType;
//     }
//   ): void;

//   /**
//    * Add a state to a node's states array.
//    *
//    * @param nodeId - ID of the node
//    * @param name - Name of the state
//    * @param condition - DNF condition for the state
//    * @returns The ID of the created state
//    * @throws NodeNotFoundError if the node doesn't exist
//    * @throws ValidationError if a state with the same name already exists
//    */
//   addState(nodeId: string, name: string, condition: DNF): string;

//   /**
//    * Remove a state from a node's states array by ID.
//    *
//    * @param nodeId - ID of the node
//    * @param stateId - ID of the state to remove
//    * @throws NodeNotFoundError if the node doesn't exist
//    * @throws ValidationError if the state doesn't exist
//    */
//   removeState(nodeId: string, stateId: string): void;

//   /**
//    * Update a state's name or condition in a node's states array.
//    *
//    * @param nodeId - ID of the node
//    * @param stateId - ID of the state to update
//    * @param updates - Updates to apply (newName and/or newCondition)
//    * @throws NodeNotFoundError if the node doesn't exist
//    * @throws ValidationError if the state doesn't exist or new name conflicts
//    */
//   updateState(
//     nodeId: string,
//     stateId: string,
//     updates: {
//       newName?: string;
//       newCondition?: DNF;
//     }
//   ): void;
// }

// /**
//  * Node data with parent information.
//  */
// interface NodeWithParent {
//   id: string;
//   type: string;
//   parent?: { id: string; index: string };
// }

// /**
//  * Create commands implementation for the editor.
//  */
// export function createCommands<TDoc extends DocumentDefinition<any>>(
//   _document: TDoc,
//   nodes: NodesAccessor<TDoc>,
//   tree: TreeUtils<TDoc>,
//   _getNodes: () => Record<string, unknown>
// ): EditorCommands<TDoc> {
//   /**
//    * Get siblings for index calculation.
//    */
//   function getSiblings(
//     parentId: string,
//     excludeNodeId?: string
//   ): SiblingInfo[] {
//     const children = tree.getSortedChildren(parentId);
//     return children
//       .map((handle) => {
//         const node = handle.get() as NodeWithParent;
//         return {
//           id: node.id,
//           index: node.parent?.index ?? ''
//         };
//       })
//       .filter((s) => s.id !== excludeNodeId);
//   }

//   return {
//     createNode<K extends keyof TDoc['nodes']>(
//       nodeType: K,
//       options: CreateNodeOptions<NodeDataFromDocument<TDoc, K>>
//     ): Handle<NodeDataFromDocument<TDoc, K>> {
//       const { id = nanoid(), parentId, beforeSiblingId = null, data } = options;

//       // Verify parent exists
//       const parentHandle = nodes.get(parentId);
//       if (!parentHandle) {
//         throw new NodeNotFoundError(parentId);
//       }

//       // Calculate fractional index
//       const siblings = getSiblings(parentId);
//       const index = generateIndex(siblings, beforeSiblingId);

//       // Create the node
//       return nodes.create(nodeType, {
//         id,
//         parent: { id: parentId, index },
//         ...data
//       } as any);
//     },

//     deleteSubtree(nodeId: string): void {
//       const handle = nodes.get(nodeId);
//       if (!handle) {
//         throw new NodeNotFoundError(nodeId);
//       }

//       // Get all descendants first (we need the IDs before deleting)
//       const descendants = tree.getDescendants(nodeId);
//       const descendantIds = descendants.map(
//         (h) => (h.get() as NodeWithParent).id
//       );

//       // Delete in reverse order (children before parents) to avoid issues
//       for (const id of descendantIds.reverse()) {
//         try {
//           nodes.delete(id);
//         } catch {
//           // Node might already be deleted, continue
//         }
//       }

//       // Delete the root node
//       nodes.delete(nodeId);
//     },

//     moveNode(nodeId: string, options: MoveNodeOptions): void {
//       const { parentId, beforeSiblingId = null } = options;

//       // Get the node to move
//       const handle = nodes.get(nodeId);
//       if (!handle) {
//         throw new NodeNotFoundError(nodeId);
//       }

//       // Verify new parent exists
//       const parentHandle = nodes.get(parentId);
//       if (!parentHandle) {
//         throw new NodeNotFoundError(parentId);
//       }

//       // Prevent moving a node into itself or its descendants
//       if (nodeId === parentId || tree.isDescendantOf(parentId, nodeId)) {
//         throw new ValidationError(
//           nodeId,
//           'Cannot move a node into itself or its descendants'
//         );
//       }

//       // Calculate new index (exclude the node being moved from siblings)
//       const siblings = getSiblings(parentId, nodeId);
//       const newIndex = generateIndex(siblings, beforeSiblingId);

//       // Update the node
//       const nodeData = handle.get() as NodeWithParent;
//       handle.set({
//         ...nodeData,
//         parent: { id: parentId, index: newIndex }
//       } as AnyNodeDataFromDocument<TDoc>);
//     },

//     addVariable(nodeId: string, type: VariableTypeKey, name: string): string {
//       const handle = nodes.get(nodeId);
//       if (!handle) {
//         throw new NodeNotFoundError(nodeId);
//       }

//       const nodeData = handle.get() as Record<string, unknown>;
//       const currentVariables = (nodeData.localVariables as Variable[]) ?? [];

//       // Check if variable with this name already exists
//       if (currentVariables.some((v) => v.name === name)) {
//         throw new ValidationError(
//           nodeId,
//           `Variable with name '${name}' already exists`
//         );
//       }

//       // Get default value for type
//       let defaultValue: VariableType;
//       switch (type) {
//         case 'string':
//           defaultValue = stringVariableTypeSchema.parse({});
//           break;
//         case 'number':
//           defaultValue = numberVariableTypeSchema.parse({});
//           break;
//         case 'boolean':
//           defaultValue = booleanVariableTypeSchema.parse({});
//           break;
//         case 'product':
//           defaultValue = productVariableTypeSchema.parse({});
//           break;
//         default:
//           throw new ValidationError(nodeId, `Invalid variable type: ${type}`);
//       }

//       const variableId = nanoid();
//       const newVariable = variableSchema.parse({
//         id: variableId,
//         name,
//         value: defaultValue
//       });

//       handle.set({
//         ...nodeData,
//         localVariables: [...currentVariables, newVariable]
//       } as AnyNodeDataFromDocument<TDoc>);

//       return variableId;
//     },

//     removeVariable(nodeId: string, variableId: string): void {
//       const handle = nodes.get(nodeId);
//       if (!handle) {
//         throw new NodeNotFoundError(nodeId);
//       }

//       const nodeData = handle.get() as Record<string, unknown>;
//       const currentVariables = (nodeData.localVariables as Variable[]) ?? [];

//       // Check if variable exists
//       const variableIndex = currentVariables.findIndex(
//         (v) => v.id === variableId
//       );
//       if (variableIndex === -1) {
//         throw new ValidationError(
//           nodeId,
//           `Variable with id '${variableId}' does not exist`
//         );
//       }

//       const newVariables = currentVariables.filter((v) => v.id !== variableId);

//       handle.set({
//         ...nodeData,
//         localVariables: newVariables
//       } as AnyNodeDataFromDocument<TDoc>);
//     },

//     updateVariable(
//       nodeId: string,
//       variableId: string,
//       updates: { newName?: string; newValue?: VariableType }
//     ): void {
//       const handle = nodes.get(nodeId);
//       if (!handle) {
//         throw new NodeNotFoundError(nodeId);
//       }

//       const nodeData = handle.get() as Record<string, unknown>;
//       const currentVariables = (nodeData.localVariables as Variable[]) ?? [];

//       // Find the variable
//       const variableIndex = currentVariables.findIndex(
//         (v) => v.id === variableId
//       );
//       if (variableIndex === -1) {
//         throw new ValidationError(
//           nodeId,
//           `Variable with id '${variableId}' does not exist`
//         );
//       }

//       const newVariables = [...currentVariables];
//       const existingVariable = newVariables[variableIndex];
//       if (!existingVariable) {
//         throw new ValidationError(
//           nodeId,
//           `Variable with id '${variableId}' does not exist`
//         );
//       }

//       // Check if new name conflicts with existing variable (excluding the current one)
//       if (
//         updates.newName &&
//         updates.newName !== existingVariable.name &&
//         currentVariables.some(
//           (v) => v.id !== variableId && v.name === updates.newName
//         )
//       ) {
//         throw new ValidationError(
//           nodeId,
//           `Variable with name '${updates.newName}' already exists`
//         );
//       }

//       // Update the variable
//       newVariables[variableIndex] = variableSchema.parse({
//         id: existingVariable.id,
//         name: updates.newName ?? existingVariable.name,
//         value: updates.newValue ?? existingVariable.value
//       });

//       handle.set({
//         ...nodeData,
//         localVariables: newVariables
//       } as AnyNodeDataFromDocument<TDoc>);
//     },

//     addState(nodeId: string, name: string, condition: DNF): string {
//       const handle = nodes.get(nodeId);
//       if (!handle) {
//         throw new NodeNotFoundError(nodeId);
//       }

//       const nodeData = handle.get() as Record<string, unknown>;
//       const currentStates =
//         (nodeData.states as Array<{ id: string; name: string }>) ?? [];

//       // Check if state with this name already exists
//       if (currentStates.some((s) => s.name === name)) {
//         throw new ValidationError(
//           nodeId,
//           `State with name '${name}' already exists`
//         );
//       }

//       const stateId = nanoid();
//       const newState = stateSchema.parse({
//         id: stateId,
//         name,
//         condition
//       });

//       handle.set({
//         ...nodeData,
//         states: [...currentStates, newState]
//       } as AnyNodeDataFromDocument<TDoc>);

//       return stateId;
//     },

//     removeState(nodeId: string, stateId: string): void {
//       const handle = nodes.get(nodeId);
//       if (!handle) {
//         throw new NodeNotFoundError(nodeId);
//       }

//       const nodeData = handle.get() as Record<string, unknown>;
//       const currentStates = (nodeData.states as Array<{ id: string }>) ?? [];

//       // Check if state exists
//       const stateIndex = currentStates.findIndex((s) => s.id === stateId);
//       if (stateIndex === -1) {
//         throw new ValidationError(
//           nodeId,
//           `State with id '${stateId}' does not exist`
//         );
//       }

//       const newStates = currentStates.filter((s) => s.id !== stateId);

//       handle.set({
//         ...nodeData,
//         states: newStates
//       } as AnyNodeDataFromDocument<TDoc>);
//     },

//     updateState(
//       nodeId: string,
//       stateId: string,
//       updates: {
//         newName?: string;
//         newCondition?: DNF;
//       }
//     ): void {
//       const handle = nodes.get(nodeId);
//       if (!handle) {
//         throw new NodeNotFoundError(nodeId);
//       }

//       const nodeData = handle.get() as Record<string, unknown>;
//       const currentStates =
//         (nodeData.states as Array<{
//           id: string;
//           name: string;
//           condition: DNF;
//         }>) ?? [];

//       // Find the state
//       const stateIndex = currentStates.findIndex((s) => s.id === stateId);
//       if (stateIndex === -1) {
//         throw new ValidationError(
//           nodeId,
//           `State with id '${stateId}' does not exist`
//         );
//       }

//       const newStates = [...currentStates];
//       const existingState = newStates[stateIndex];
//       if (!existingState) {
//         throw new ValidationError(
//           nodeId,
//           `State with id '${stateId}' does not exist`
//         );
//       }

//       // Check if new name conflicts with existing state (excluding the current one)
//       if (
//         updates.newName &&
//         updates.newName !== existingState.name &&
//         currentStates.some(
//           (s) => s.id !== stateId && s.name === updates.newName
//         )
//       ) {
//         throw new ValidationError(
//           nodeId,
//           `State with name '${updates.newName}' already exists`
//         );
//       }

//       // Update the state
//       newStates[stateIndex] = stateSchema.parse({
//         id: existingState.id,
//         name: updates.newName ?? existingState.name,
//         condition: updates.newCondition ?? existingState.condition
//       });

//       handle.set({
//         ...nodeData,
//         states: newStates
//       } as AnyNodeDataFromDocument<TDoc>);
//     }
//   };
// }
