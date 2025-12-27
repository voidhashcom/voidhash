// import { flexNode, rootNode, screenNode, textNode } from '../nodes';
// import { createDocument } from './create-document';

// /**
//  * Paywall document definition using v3 functional schema approach.
//  * Defines the structure of a paywall design document with root, screen, flex, and text nodes.
//  */
// export const paywallDocument = createDocument({
//   type: 'paywall',
//   schemaVersion: 1,
//   nodes: {
//     root: rootNode,
//     screen: screenNode,
//     flex: flexNode,
//     text: textNode
//   } as const,
//   allowedChildren: {
//     root: ['screen'],
//     screen: ['flex', 'text'],
//     flex: ['flex', 'text'],
//     text: []
//   },
//   rootNodeTypes: ['root']
// });

// export const NODE_TYPES = Object.values(paywallDocument.nodes).map(
//   (node) => node.shape.type
// );
