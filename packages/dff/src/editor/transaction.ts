// /** biome-ignore-all lint/suspicious/noExplicitAny: Used for generics */
// import type { DocumentDefinition } from '../documents';
// import { createNodesAccessor } from './nodes-accessor';
// import type { Transaction } from './types';

// /**
//  * Transaction context implementation.
//  * Batches operations and applies them atomically.
//  */
// export class TransactionContext<TDoc extends DocumentDefinition<any>>
//   implements Transaction<TDoc>
// {
//   private readonly pendingUpdates: Map<string, unknown> = new Map();
//   private readonly pendingDeletes: Set<string> = new Set();
//   // private readonly getNodes: () => Record<string, unknown>;
//   private readonly setNode: (id: string, node: unknown) => void;
//   private readonly deleteNode: (id: string) => void;
//   // private readonly validateParentAcceptsChild: (
//   //   parentId: string,
//   //   childType: keyof TDoc['nodes']
//   // ) => void;
//   // private readonly document: TDoc;
//   private readonly commitFn: () => void;

//   readonly nodes: ReturnType<typeof createNodesAccessor<TDoc>>;

//   constructor(
//     document: TDoc,
//     getNodes: () => Record<string, unknown>,
//     setNode: (id: string, node: unknown) => void,
//     deleteNode: (id: string) => void,
//     validateParentAcceptsChild: (
//       parentId: string,
//       childType: keyof TDoc['nodes']
//     ) => void,
//     commitFn: () => void
//   ) {
//     // this.document = document;
//     // this.getNodes = getNodes;
//     this.setNode = setNode;
//     this.deleteNode = deleteNode;
//     // this.validateParentAcceptsChild = validateParentAcceptsChild;
//     this.commitFn = commitFn;

//     // Create nodes accessor that writes to pending updates
//     this.nodes = createNodesAccessor(
//       document,
//       () => {
//         // Merge current nodes with pending updates, excluding deletes
//         const current = getNodes();
//         const merged = { ...current };
//         for (const [id, node] of this.pendingUpdates.entries()) {
//           merged[id] = node;
//         }
//         for (const id of this.pendingDeletes) {
//           delete merged[id];
//         }
//         return merged;
//       },
//       (id: string, node: unknown) => {
//         this.pendingDeletes.delete(id);
//         this.pendingUpdates.set(id, node);
//       },
//       (id: string) => {
//         this.pendingUpdates.delete(id);
//         this.pendingDeletes.add(id);
//       },
//       validateParentAcceptsChild
//     );
//   }

//   /**
//    * Commit all pending changes atomically.
//    */
//   commit(): void {
//     // Apply all updates
//     for (const [id, node] of this.pendingUpdates.entries()) {
//       this.setNode(id, node);
//     }

//     // Apply all deletes
//     for (const id of this.pendingDeletes) {
//       this.deleteNode(id);
//     }

//     // Clear pending changes
//     this.pendingUpdates.clear();
//     this.pendingDeletes.clear();

//     // Call commit callback
//     this.commitFn();
//   }
// }
