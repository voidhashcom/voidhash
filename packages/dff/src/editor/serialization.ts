// /** biome-ignore-all lint/suspicious/noExplicitAny: Used for generics */
// import { nanoid } from 'nanoid';
// import type { DocumentDefinition } from '../documents';
// import { NodeNotFoundError } from './errors';
// import { generateIndex, type SiblingInfo } from './indexing';
// import type { TreeUtils } from './tree';
// import type { NodesAccessor } from './types';

// /**
//  * Serialized node data for clipboard operations.
//  */
// export interface SerializedNodes {
//   /** All nodes in the selection (including descendants) */
//   nodes: Record<string, unknown>[];
//   /** IDs of the top-level nodes in the selection (roots of the subtrees) */
//   rootNodeIds: string[];
//   /** Original parent ID of the root nodes (for smart paste) */
//   originalParentId: string | null;
// }

// /**
//  * Options for deserializing nodes.
//  */
// export interface DeserializeOptions {
//   /** Parent node ID to insert under */
//   parentId: string;
//   /** ID of sibling to insert before. null = insert at end */
//   beforeSiblingId?: string | null;
// }

// /**
//  * Serialization utilities for copy/paste operations.
//  */
// // biome-ignore lint/correctness/noUnusedVariables: TDoc is used for type compatibility with createSerializationUtils
// export interface SerializationUtils<TDoc extends DocumentDefinition<any>> {
//   /**
//    * Serialize nodes and their descendants for clipboard.
//    *
//    * @param nodeIds - IDs of nodes to serialize
//    * @returns Serialized data including all descendants
//    */
//   serializeNodes(nodeIds: string[]): SerializedNodes;

//   /**
//    * Deserialize nodes from clipboard data.
//    * Creates new nodes with regenerated IDs.
//    *
//    * @param data - Serialized node data
//    * @param options - Where to insert the nodes
//    * @returns IDs of the newly created root nodes
//    */
//   deserializeNodes(
//     data: SerializedNodes,
//     options: DeserializeOptions
//   ): string[];
// }

// /**
//  * Node data with parent information.
//  */
// interface NodeWithParent {
//   id: string;
//   type: string;
//   parent?: { id: string; index: string };
//   localVariables?: Array<{ id: string; name: string; value: unknown }>;
// }

// /**
//  * Create serialization utilities for the editor.
//  */
// export function createSerializationUtils<TDoc extends DocumentDefinition<any>>(
//   _document: TDoc,
//   nodes: NodesAccessor<TDoc>,
//   tree: TreeUtils<TDoc>,
//   _getNodes: () => Record<string, unknown>
// ): SerializationUtils<TDoc> {
//   /**
//    * Get siblings for index calculation.
//    */
//   function getSiblings(parentId: string): SiblingInfo[] {
//     const children = tree.getSortedChildren(parentId);
//     return children.map((handle) => {
//       const node = handle.get() as NodeWithParent;
//       return {
//         id: node.id,
//         index: node.parent?.index ?? ''
//       };
//     });
//   }

//   return {
//     serializeNodes(nodeIds: string[]): SerializedNodes {
//       const serializedNodes: Record<string, unknown>[] = [];
//       const rootNodesWithIndex: { id: string; index: string }[] = [];
//       const processedIds = new Set<string>();
//       let originalParentId: string | null = null;

//       for (const nodeId of nodeIds) {
//         const handle = nodes.get(nodeId);
//         if (!handle) {
//           continue;
//         }

//         const nodeData = handle.get() as NodeWithParent;

//         // Skip root nodes (they shouldn't be copied)
//         if (nodeData.type === 'root') {
//           continue;
//         }

//         // Track root node IDs with their index for sorting
//         rootNodesWithIndex.push({
//           id: nodeId,
//           index: nodeData.parent?.index ?? ''
//         });
//         if (originalParentId === null && nodeData.parent) {
//           originalParentId = nodeData.parent.id;
//         }

//         // Collect this node and all descendants
//         if (!processedIds.has(nodeId)) {
//           serializedNodes.push(
//             structuredClone(nodeData) as unknown as Record<string, unknown>
//           );
//           processedIds.add(nodeId);
//         }

//         const descendants = tree.getDescendants(nodeId);
//         for (const descendant of descendants) {
//           const descendantData = descendant.get() as NodeWithParent;
//           if (!processedIds.has(descendantData.id)) {
//             serializedNodes.push(
//               structuredClone(descendantData) as unknown as Record<
//                 string,
//                 unknown
//               >
//             );
//             processedIds.add(descendantData.id);
//           }
//         }
//       }

//       // Sort root nodes by their fractional index to preserve visual order
//       rootNodesWithIndex.sort((a, b) =>
//         a.index < b.index ? -1 : a.index > b.index ? 1 : 0
//       );
//       const rootNodeIds = rootNodesWithIndex.map((n) => n.id);

//       return {
//         nodes: serializedNodes,
//         rootNodeIds,
//         originalParentId
//       };
//     },

//     deserializeNodes(
//       data: SerializedNodes,
//       options: DeserializeOptions
//     ): string[] {
//       const { parentId, beforeSiblingId = null } = options;

//       // Verify parent exists
//       const parentHandle = nodes.get(parentId);
//       if (!parentHandle) {
//         throw new NodeNotFoundError(parentId);
//       }

//       if (data.nodes.length === 0) {
//         return [];
//       }

//       // Create ID mapping: oldId -> newId
//       const idMap = new Map<string, string>();
//       for (const node of data.nodes) {
//         const nodeWithParent = node as unknown as NodeWithParent;
//         idMap.set(nodeWithParent.id, nanoid());
//       }

//       // Create variable ID mapping: oldVariableId -> newVariableId
//       const variableIdMap = new Map<string, string>();
//       for (const node of data.nodes) {
//         const nodeData = node as Record<string, unknown>;
//         const localVariables =
//           (nodeData.localVariables as
//             | Array<{ id: string; name: string; value: unknown }>
//             | undefined) ?? [];
//         for (const variable of localVariables) {
//           if (!variableIdMap.has(variable.id)) {
//             variableIdMap.set(variable.id, nanoid());
//           }
//         }
//       }

//       // Track created nodes
//       const createdRootIds: string[] = [];
//       const createdNodeIds = new Set<string>();

//       // Get current siblings for index generation
//       let currentSiblings = getSiblings(parentId);

//       /**
//        * Create a node and all its descendants recursively.
//        */
//       function createNodeRecursive(
//         nodeData: NodeWithParent,
//         isRootNode: boolean
//       ): void {
//         const newId = idMap.get(nodeData.id);
//         if (!newId || createdNodeIds.has(newId)) {
//           return;
//         }

//         // Determine parent for this node
//         let newParentId: string;
//         let newIndex: string;

//         if (isRootNode) {
//           // Root nodes go under the target parent
//           newParentId = parentId;
//           newIndex = generateIndex(currentSiblings, beforeSiblingId);
//           // Update siblings for next root node (keep sorted by index)
//           currentSiblings = [
//             ...currentSiblings,
//             { id: newId, index: newIndex }
//           ].sort((a, b) =>
//             a.index < b.index ? -1 : a.index > b.index ? 1 : 0
//           );
//         } else {
//           // Non-root nodes: check if parent is being pasted too
//           const oldParentId = nodeData.parent?.id;
//           const mappedParentId = oldParentId
//             ? idMap.get(oldParentId)
//             : undefined;

//           if (mappedParentId && createdNodeIds.has(mappedParentId)) {
//             // Parent was also pasted, use mapped parent
//             newParentId = mappedParentId;
//           } else {
//             // Parent not in paste data, skip this node
//             return;
//           }

//           // Generate index for this node under its new parent
//           const parentSiblings = getSiblings(newParentId);
//           newIndex = generateIndex(parentSiblings, null);
//         }

//         // Regenerate variable IDs in localVariables before creating node
//         const nodeDataCopy = structuredClone(nodeData) as NodeWithParent;
//         if (
//           nodeDataCopy.localVariables &&
//           Array.isArray(nodeDataCopy.localVariables)
//         ) {
//           nodeDataCopy.localVariables = nodeDataCopy.localVariables.map(
//             (variable) => ({
//               ...variable,
//               id: variableIdMap.get(variable.id) ?? nanoid()
//             })
//           );
//         }

//         // Create the node without parent and id, then add them
//         const {
//           id: _oldId,
//           parent: _oldParent,
//           ...nodeDataWithoutMeta
//         } = nodeDataCopy as unknown as Record<string, unknown>;

//         try {
//           nodes.create(
//             nodeData.type as keyof TDoc['nodes'],
//             {
//               id: newId,
//               parent: { id: newParentId, index: newIndex },
//               ...nodeDataWithoutMeta
//             } as any
//           );

//           createdNodeIds.add(newId);

//           if (isRootNode) {
//             createdRootIds.push(newId);
//           }
//         } catch {
//           // Node creation failed (e.g., invalid parent-child relationship)
//           return;
//         }
//       }

//       // First, create all root nodes
//       for (const rootId of data.rootNodeIds) {
//         const nodeData = data.nodes.find(
//           (n) => (n as unknown as NodeWithParent).id === rootId
//         ) as unknown as NodeWithParent | undefined;
//         if (nodeData) {
//           createNodeRecursive(nodeData, true);
//         }
//       }

//       // Then create children in topological order
//       // Keep iterating until no more nodes can be created
//       let madeProgress = true;
//       while (madeProgress) {
//         madeProgress = false;

//         for (const node of data.nodes) {
//           const nodeData = node as unknown as NodeWithParent;
//           const newId = idMap.get(nodeData.id);

//           if (!newId || createdNodeIds.has(newId)) {
//             continue;
//           }

//           // Check if parent was created
//           const oldParentId = nodeData.parent?.id;
//           const mappedParentId = oldParentId
//             ? idMap.get(oldParentId)
//             : undefined;

//           if (mappedParentId && createdNodeIds.has(mappedParentId)) {
//             createNodeRecursive(nodeData, false);
//             madeProgress = true;
//           }
//         }
//       }

//       return createdRootIds;
//     }
//   };
// }
