// /** biome-ignore-all lint/suspicious/noExplicitAny: Used for generics */
// import type { z } from 'zod';
// import { createDocument } from '../documents/create-document';
// import type { DocumentDefinition } from '../documents/types';
// import { rootNode } from '../nodes/root-node';
// import { screenNode } from '../nodes/screen-node';
// import { getDefaults } from '../schema';

// /**
//  * Simple test document definition with root and screen node types.
//  * Used for testing storage adapters.
//  */
// export const testDocument: DocumentDefinition<{
//   root: typeof rootNode;
//   screen: typeof screenNode;
// }> = createDocument({
//   type: 'paywall',
//   schemaVersion: 1,
//   nodes: {
//     root: rootNode,
//     screen: screenNode
//   },
//   allowedChildren: {
//     root: ['screen'],
//     screen: []
//   },
//   rootNodeTypes: ['root']
// });

// /**
//  * Create a simple root node for testing.
//  */
// export function createTestRootNode(id = 'root') {
//   return {
//     type: 'root' as const,
//     id
//   };
// }

// /**
//  * Create a simple screen node for testing.
//  * Extracts the style schema from screenNode and gets its defaults.
//  */
// export function createTestScreenNode(id = 'screen-1', name = 'Screen') {
//   // Extract the style schema from screenNode
//   const screenNodeShape = screenNode.shape;
//   const styleSchema = screenNodeShape.style as z.ZodObject<any>;
//   const styleDefaults = getDefaults(styleSchema);

//   return {
//     type: 'screen' as const,
//     id,
//     name,
//     parent: {
//       id: 'root',
//       index: 'a0'
//     },
//     style: styleDefaults
//   };
// }
