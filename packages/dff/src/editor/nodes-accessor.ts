// /** biome-ignore-all lint/suspicious/noExplicitAny: Used for generics */
// import type { DocumentDefinition, NodeDataFromDocument } from '../documents';
// import { getDefaults, validate } from '../schema';
// import { NodeNotFoundError, ValidationError } from './errors';
// import { createHandle } from './handle';
// import type { AnyNodeDataFromDocument, Handle, NodesAccessor } from './types';

// /**
//  * Deep merge two objects, recursively merging nested objects.
//  * Arrays and non-plain objects are replaced (not merged).
//  */
// function deepMerge<T extends Record<string, unknown>>(
//   target: T,
//   source: Partial<T>
// ): T {
//   const result = { ...target } as T;

//   for (const key in source) {
//     if (!Object.hasOwn(source, key)) {
//       continue;
//     }

//     const sourceValue = source[key];
//     const targetValue = result[key];

//     // If both values are plain objects, merge them recursively
//     if (
//       sourceValue !== null &&
//       typeof sourceValue === 'object' &&
//       !Array.isArray(sourceValue) &&
//       targetValue !== null &&
//       typeof targetValue === 'object' &&
//       !Array.isArray(targetValue) &&
//       !(sourceValue instanceof Date) &&
//       !(targetValue instanceof Date)
//     ) {
//       result[key] = deepMerge(
//         targetValue as Record<string, unknown>,
//         sourceValue as Record<string, unknown>
//       ) as T[Extract<keyof T, string>];
//     } else if (sourceValue !== undefined) {
//       // Otherwise, use the source value (or undefined to keep target value)
//       result[key] = sourceValue as T[Extract<keyof T, string>];
//     }
//   }

//   return result;
// }

// /**
//  * Create a nodes accessor for the editor.
//  */
// export function createNodesAccessor<TDoc extends DocumentDefinition<any>>(
//   document: TDoc,
//   getNodes: () => Record<string, unknown>,
//   setNode: (id: string, node: unknown) => void,
//   deleteNode: (id: string) => void,
//   validateParentAcceptsChild: (
//     parentId: string,
//     childType: keyof TDoc['nodes']
//   ) => void
// ): NodesAccessor<TDoc> {
//   return {
//     get(id: string): Handle<AnyNodeDataFromDocument<TDoc>> | undefined {
//       const nodes = getNodes();
//       const rawNode = nodes[id];
//       if (rawNode === undefined) {
//         return;
//       }

//       // Try to infer node type from the node data
//       const nodeType = inferNodeType(document, rawNode);
//       if (nodeType === undefined) {
//         return;
//       }

//       // Validate the node matches its schema
//       const schema = document.nodes[nodeType];
//       if (!validate(schema, rawNode)) {
//         return;
//       }

//       return createHandle(
//         () => rawNode as AnyNodeDataFromDocument<TDoc>,
//         (value: AnyNodeDataFromDocument<TDoc>) => {
//           // Validate before setting
//           if (!validate(schema, value)) {
//             throw new ValidationError(
//               id,
//               `Node does not match schema for type ${String(nodeType)}`
//             );
//           }
//           setNode(id, value);
//         },
//         ['nodes', id]
//       ) as Handle<AnyNodeDataFromDocument<TDoc>>;
//     },

//     find(
//       predicate: (node: Handle<AnyNodeDataFromDocument<TDoc>>) => boolean
//     ): Handle<AnyNodeDataFromDocument<TDoc>>[] {
//       const nodes = getNodes();
//       const handles: Handle<AnyNodeDataFromDocument<TDoc>>[] = [];

//       for (const [id, rawNode] of Object.entries(nodes)) {
//         const nodeType = inferNodeType(document, rawNode);
//         if (nodeType === undefined) {
//           continue;
//         }

//         const schema = document.nodes[nodeType];
//         if (!validate(schema, rawNode)) {
//           continue;
//         }

//         const handle = createHandle(
//           () => rawNode as AnyNodeDataFromDocument<TDoc>,
//           (value: AnyNodeDataFromDocument<TDoc>) => {
//             if (!validate(schema, value)) {
//               throw new ValidationError(
//                 id,
//                 `Node does not match schema for type ${String(nodeType)}`
//               );
//             }
//             setNode(id, value);
//           },
//           ['nodes', id]
//         ) as Handle<AnyNodeDataFromDocument<TDoc>>;

//         if (predicate(handle)) {
//           handles.push(handle);
//         }
//       }

//       return handles;
//     },

//     create<K extends keyof TDoc['nodes']>(
//       nodeType: K,
//       data: {
//         id: string;
//         parent?: { id: string; index: string };
//       } & Partial<NodeDataFromDocument<TDoc, K>>
//     ): Handle<NodeDataFromDocument<TDoc, K>> {
//       const schema = document.nodes[nodeType];
//       const defaults = getDefaults(schema) as NodeDataFromDocument<TDoc, K>;

//       // Deep merge defaults with provided data
//       const nodeData = {
//         ...deepMerge(
//           defaults as Record<string, unknown>,
//           data as Record<string, unknown>
//         ),
//         type: nodeType
//       } as NodeDataFromDocument<TDoc, K>;

//       // Validate parent accepts this child type (skip for root nodes)
//       if (nodeType !== 'root' && nodeData.parent) {
//         validateParentAcceptsChild(nodeData.parent.id, nodeType);
//       }

//       // Validate the node matches its schema
//       if (!validate(schema, nodeData)) {
//         throw new ValidationError(
//           data.id,
//           `Invalid node data for type ${String(nodeType)}`
//         );
//       }

//       setNode(data.id, nodeData);

//       return createHandle(
//         () => nodeData,
//         (value: NodeDataFromDocument<TDoc, K>) => {
//           if (!validate(schema, value)) {
//             throw new ValidationError(
//               data.id,
//               `Node does not match schema for type ${String(nodeType)}`
//             );
//           }
//           setNode(data.id, value);
//         },
//         ['nodes', data.id]
//       ) as Handle<NodeDataFromDocument<TDoc, K>>;
//     },

//     delete(id: string): void {
//       const nodes = getNodes();
//       if (!(id in nodes)) {
//         throw new NodeNotFoundError(id);
//       }
//       deleteNode(id);
//     }
//   };
// }

// /**
//  * Infer the node type from raw node data.
//  * Returns undefined if type cannot be determined.
//  */
// function inferNodeType<TDoc extends DocumentDefinition<any>>(
//   document: TDoc,
//   rawNode: unknown
// ): keyof TDoc['nodes'] | undefined {
//   if (typeof rawNode !== 'object' || rawNode === null) {
//     return;
//   }

//   const obj = rawNode as Record<string, unknown>;
//   const type = obj.type;

//   if (typeof type !== 'string') {
//     return;
//   }

//   if (type in document.nodes) {
//     return type as keyof TDoc['nodes'];
//   }

//   return;
// }
