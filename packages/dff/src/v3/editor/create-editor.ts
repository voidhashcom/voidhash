import type { DocumentDefinition } from '../documents';
import { validate } from '../schema';
import type { DocumentSnapshot } from '../storage';
import { NodeNotFoundError, ValidationError } from './errors';
import { createNodesAccessor } from './nodes-accessor';
import { TransactionContext } from './transaction';
import type { Editor, EditorOptions, Transaction } from './types';

/**
 * Create an editor instance for a document.
 * Provides ORM-like access to document nodes with type safety.
 *
 * @example
 * ```ts
 * const editor = createEditor(paywallDocument, {
 *   storage: createYjsStorage(ydoc, paywallDocument)
 * });
 *
 * const node = editor.nodes.get('node-1');
 * const fontSize = node.style.fontSize;
 * fontSize.set(18);
 * ```
 */
export function createEditor<TDoc extends DocumentDefinition<any>>(
  document: TDoc,
  options: EditorOptions<TDoc> = {}
): Editor<TDoc> {
  let nodes: Record<string, unknown> = {};
  let meta: { schemaVersion: number; documentType: string } | null = null;
  let inTransaction = false;

  // Initialize from provided nodes or storage
  if (options.initialNodes) {
    nodes = { ...options.initialNodes };
  } else if (options.storage) {
    const snapshot = options.storage.load();
    nodes = snapshot.nodes;
    meta = snapshot.meta;
  }

  // Internal node operations
  const getNodes = (): Record<string, unknown> => {
    return { ...nodes };
  };

  const setNode = (id: string, node: unknown): void => {
    nodes[id] = node;
    if (!inTransaction && options.storage) {
      persist();
    }
  };

  const deleteNode = (id: string): void => {
    delete nodes[id];
    if (!inTransaction && options.storage) {
      persist();
    }
  };

  const validateParentAcceptsChild = (
    parentId: string,
    childType: keyof TDoc['nodes']
  ): void => {
    const parentNode = nodes[parentId];
    if (parentNode === undefined) {
      throw new NodeNotFoundError(parentId);
    }

    if (typeof parentNode !== 'object' || parentNode === null) {
      throw new ValidationError(parentId, 'Parent node is not an object');
    }

    const parentObj = parentNode as Record<string, unknown>;
    const parentType = parentObj.type;

    if (typeof parentType !== 'string') {
      throw new ValidationError(parentId, 'Parent node has no type');
    }

    if (!(parentType in document.nodes)) {
      throw new ValidationError(
        parentId,
        `Parent node type '${parentType}' not found in document schema`
      );
    }

    const allowedChildren =
      document.allowedChildren[parentType as keyof TDoc['nodes']];

    if (!allowedChildren) {
      throw new ValidationError(
        parentId,
        `Node type '${parentType}' cannot have children`
      );
    }

    if (!allowedChildren.includes(childType as any)) {
      throw new ValidationError(
        parentId,
        `Node type '${parentType}' does not accept '${String(childType)}' as children`
      );
    }
  };

  const persist = (): void => {
    if (!options.storage) {
      return;
    }

    const snapshot: DocumentSnapshot = {
      meta,
      nodes: { ...nodes }
    };

    options.storage.save(snapshot);
  };

  // Create nodes accessor
  const nodesAccessor = createNodesAccessor(
    document,
    getNodes,
    setNode,
    deleteNode,
    validateParentAcceptsChild
  );

  // Create editor instance
  const editor: Editor<TDoc> = {
    nodes: nodesAccessor,

    getMeta() {
      return meta;
    },

    initialize() {
      meta = {
        schemaVersion: document.schemaVersion,
        documentType: document.type
      };
      if (!inTransaction) {
        persist();
      }
    },

    transaction(fn: (tx: Transaction<TDoc>) => void) {
      inTransaction = true;
      try {
        const tx = new TransactionContext(
          document,
          getNodes,
          setNode,
          deleteNode,
          validateParentAcceptsChild,
          () => {
            // Commit callback - persist after transaction
            persist();
          }
        );

        fn(tx);

        // Commit transaction
        tx.commit();
      } finally {
        inTransaction = false;
      }
    },

    observeStorage(callback: (nodes: Record<string, unknown>) => void) {
      if (!options.storage?.observe) {
        return () => {
          // No-op unsubscribe
        };
      }

      return options.storage.observe((snapshot) => {
        nodes = snapshot.nodes;
        meta = snapshot.meta;
        callback(nodes);
      });
    }
  };

  return editor;
}
