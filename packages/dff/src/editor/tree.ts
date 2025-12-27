// /** biome-ignore-all lint/suspicious/noExplicitAny: Used for generics */
// import type { DocumentDefinition } from '../documents';
// import type { AnyNodeDataFromDocument, Handle } from './types';

// /**
//  * Tree utilities for navigating the node hierarchy.
//  * All methods return handles for consistent access patterns.
//  */
// export interface TreeUtils<TDoc extends DocumentDefinition<any>> {
//   /**
//    * Get direct children of a node (unsorted).
//    * Use getSortedChildren for ordered results.
//    */
//   getChildren(parentId: string): Handle<AnyNodeDataFromDocument<TDoc>>[];

//   /**
//    * Get direct children of a node sorted by their fractional index.
//    */
//   getSortedChildren(parentId: string): Handle<AnyNodeDataFromDocument<TDoc>>[];

//   /**
//    * Get all descendants of a node (children, grandchildren, etc.).
//    * Does not include the node itself.
//    */
//   getDescendants(nodeId: string): Handle<AnyNodeDataFromDocument<TDoc>>[];

//   /**
//    * Get all ancestors of a node (parent, grandparent, etc.).
//    * Ordered from immediate parent to root.
//    */
//   getAncestors(nodeId: string): Handle<AnyNodeDataFromDocument<TDoc>>[];

//   /**
//    * Check if a node is a descendant of another node.
//    * Returns true if nodeId is a child, grandchild, etc. of ancestorId.
//    */
//   isDescendantOf(nodeId: string, ancestorId: string): boolean;

//   /**
//    * Get the parent of a node.
//    * Returns undefined for root nodes.
//    */
//   getParent(nodeId: string): Handle<AnyNodeDataFromDocument<TDoc>> | undefined;
// }

// /**
//  * Node data with parent information for tree operations.
//  */
// interface NodeWithParent {
//   id: string;
//   type: string;
//   parent?: { id: string; index: string };
// }

// /**
//  * Create tree utilities for the editor.
//  */
// export function createTreeUtils<TDoc extends DocumentDefinition<any>>(
//   getNodes: () => Record<string, unknown>,
//   getHandle: (id: string) => Handle<AnyNodeDataFromDocument<TDoc>> | undefined
// ): TreeUtils<TDoc> {
//   /**
//    * Get parent info from a node if it exists.
//    */
//   function getParentInfo(
//     node: unknown
//   ): { id: string; index: string } | undefined {
//     if (
//       typeof node === 'object' &&
//       node !== null &&
//       'parent' in node &&
//       typeof (node as NodeWithParent).parent === 'object' &&
//       (node as NodeWithParent).parent !== null
//     ) {
//       return (node as NodeWithParent).parent;
//     }
//     return;
//   }

//   /**
//    * Get node ID from a node object.
//    */
//   function getNodeId(node: unknown): string | undefined {
//     if (typeof node === 'object' && node !== null && 'id' in node) {
//       return (node as { id: string }).id;
//     }
//     return;
//   }

//   return {
//     getChildren(parentId: string): Handle<AnyNodeDataFromDocument<TDoc>>[] {
//       const nodes = getNodes();
//       const children: Handle<AnyNodeDataFromDocument<TDoc>>[] = [];

//       for (const [id, node] of Object.entries(nodes)) {
//         const parentInfo = getParentInfo(node);
//         if (parentInfo?.id === parentId) {
//           const handle = getHandle(id);
//           if (handle) {
//             children.push(handle);
//           }
//         }
//       }

//       return children;
//     },

//     getSortedChildren(
//       parentId: string
//     ): Handle<AnyNodeDataFromDocument<TDoc>>[] {
//       const nodes = getNodes();
//       const children: {
//         handle: Handle<AnyNodeDataFromDocument<TDoc>>;
//         index: string;
//       }[] = [];

//       for (const [id, node] of Object.entries(nodes)) {
//         const parentInfo = getParentInfo(node);
//         if (parentInfo?.id === parentId) {
//           const handle = getHandle(id);
//           if (handle) {
//             children.push({ handle, index: parentInfo.index });
//           }
//         }
//       }

//       // Sort by fractional index using lexicographic comparison
//       // Note: fractional-indexing uses character codes, not locale-aware comparison
//       children.sort((a, b) =>
//         a.index < b.index ? -1 : a.index > b.index ? 1 : 0
//       );

//       return children.map((c) => c.handle);
//     },

//     getDescendants(nodeId: string): Handle<AnyNodeDataFromDocument<TDoc>>[] {
//       const descendants: Handle<AnyNodeDataFromDocument<TDoc>>[] = [];
//       const queue = [nodeId];

//       while (queue.length > 0) {
//         const currentId = queue.shift();
//         if (!currentId) {
//           throw new Error('No current id even though there should be one');
//         }
//         const children = this.getChildren(currentId);

//         for (const child of children) {
//           descendants.push(child);
//           const childId = getNodeId(child.get());
//           if (childId) {
//             queue.push(childId);
//           }
//         }
//       }

//       return descendants;
//     },

//     getAncestors(nodeId: string): Handle<AnyNodeDataFromDocument<TDoc>>[] {
//       const nodes = getNodes();
//       const ancestors: Handle<AnyNodeDataFromDocument<TDoc>>[] = [];

//       let currentNode = nodes[nodeId];
//       while (currentNode) {
//         const parentInfo = getParentInfo(currentNode);
//         if (!parentInfo) {
//           break;
//         }

//         const parentHandle = getHandle(parentInfo.id);
//         if (!parentHandle) {
//           break;
//         }

//         ancestors.push(parentHandle);
//         currentNode = nodes[parentInfo.id];
//       }

//       return ancestors;
//     },

//     isDescendantOf(nodeId: string, ancestorId: string): boolean {
//       if (nodeId === ancestorId) {
//         return false;
//       }

//       const nodes = getNodes();
//       let currentNode = nodes[nodeId];

//       while (currentNode) {
//         const parentInfo = getParentInfo(currentNode);
//         if (!parentInfo) {
//           return false;
//         }

//         if (parentInfo.id === ancestorId) {
//           return true;
//         }

//         currentNode = nodes[parentInfo.id];
//       }

//       return false;
//     },

//     getParent(
//       nodeId: string
//     ): Handle<AnyNodeDataFromDocument<TDoc>> | undefined {
//       const nodes = getNodes();
//       const node = nodes[nodeId];

//       if (!node) {
//         return;
//       }

//       const parentInfo = getParentInfo(node);
//       if (!parentInfo) {
//         return;
//       }

//       return getHandle(parentInfo.id);
//     }
//   };
// }
