import type { DocumentDefinition, DocumentMeta, ParentRef } from '../core';
import type { StorageProvider } from '../storage';

export class NodeNotFoundError extends Error {
  readonly name = 'NodeNotFoundError';
  readonly nodeId: string;
  constructor(nodeId: string) {
    super(`Node not found: ${nodeId}`);
    this.nodeId = nodeId;
  }
}

export class ValidationError extends Error {
  readonly name = 'ValidationError';
  readonly nodeId: string;
  readonly reason: string;
  constructor(nodeId: string, reason: string) {
    super(`Validation failed for ${nodeId}: ${reason}`);
    this.nodeId = nodeId;
    this.reason = reason;
  }
}

export interface DocumentEditorOptions {
  /** Primary storage provider for loading and saving */
  primaryStorage?: StorageProvider;
  /** Additional storage providers that receive writes but are not read from */
  writeOnlyStorages?: StorageProvider[];
  /** Initial nodes to populate the editor with (used for read-only views from Zustand) */
  initialNodes?: Record<string, unknown>;
}

/**
 * Storage-agnostic document editor that handles all document manipulation logic.
 * Can optionally persist to one or more storage providers.
 */
export class DocumentEditor<TDoc extends DocumentDefinition> {
  private nodes: Record<string, unknown> = {};
  private meta: DocumentMeta | null = null;
  private inTransaction = false;

  readonly document: TDoc;
  private readonly primaryStorage?: StorageProvider;
  private readonly writeOnlyStorages: StorageProvider[];

  constructor(document: TDoc, options: DocumentEditorOptions = {}) {
    this.document = document;
    this.primaryStorage = options.primaryStorage;
    this.writeOnlyStorages = options.writeOnlyStorages ?? [];

    // Initialize from provided nodes (for read-only views from Zustand)
    if (options.initialNodes) {
      this.nodes = { ...options.initialNodes };
    }
    // Or load initial state from primary storage
    else if (this.primaryStorage) {
      const snapshot = this.primaryStorage.load();
      this.nodes = snapshot.nodes;
      this.meta = snapshot.meta;
    }
  }

  /** Initialize new document with metadata */
  initialize(): void {
    this.meta = {
      schemaVersion: this.document.schemaVersion,
      documentType: this.document.type
    };
    this.persistIfNotInTransaction();
  }

  /** Get document metadata */
  getMeta(): DocumentMeta | null {
    return this.meta;
  }

  /** Check if a node exists */
  hasNode(nodeId: string): boolean {
    return nodeId in this.nodes;
  }

  /** Get node by ID */
  getNode(nodeId: string): unknown {
    const raw = this.nodes[nodeId];
    if (raw === undefined) {
      throw new NodeNotFoundError(nodeId);
    }
    return raw;
  }

  /** Get node by ID, returns undefined if not found */
  getNodeOrUndefined(nodeId: string): unknown {
    return this.nodes[nodeId];
  }

  /** Get all nodes */
  getAllNodes(): Record<string, unknown> {
    return { ...this.nodes };
  }

  /** Set/create a node with validation */
  setNode(node: Record<string, unknown>): void {
    const nodeId = node.id;
    if (typeof nodeId !== 'string') {
      throw new ValidationError('unknown', 'Node must have a string id');
    }
    if (!this.document.validateNode(node)) {
      throw new ValidationError(nodeId, 'Invalid node data');
    }
    this.nodes[nodeId] = node;
    this.persistIfNotInTransaction();
  }

  /** Update node properties (merges with existing) */
  updateNode(nodeId: string, updates: Record<string, unknown>): void {
    const existing = this.getNode(nodeId) as Record<string, unknown>;
    const updated = { ...existing, ...updates, id: nodeId };
    this.setNode(updated);
  }

  /** Delete node */
  deleteNode(nodeId: string): void {
    if (!(nodeId in this.nodes)) {
      throw new NodeNotFoundError(nodeId);
    }
    delete this.nodes[nodeId];
    this.persistIfNotInTransaction();
  }

  /** Get the number of nodes */
  get size(): number {
    return Object.keys(this.nodes).length;
  }

  /** Get all node IDs */
  getNodeIds(): string[] {
    return Object.keys(this.nodes);
  }

  /** Update a node's parent reference (for moving nodes) */
  updateNodeParent(nodeId: string, newParent: ParentRef): void {
    const existing = this.getNode(nodeId) as Record<string, unknown>;
    if (existing.type === 'root') {
      throw new ValidationError(nodeId, 'Cannot update parent of root node');
    }
    const updated = { ...existing, parent: newParent };
    this.setNode(updated);
  }

  /**
   * Create a new node using the document's node class for defaults.
   * @param nodeType - The type of node to create
   * @param data - Required: id, parent. Optional: any other node properties to override defaults
   * @returns The created node data
   */
  createNode(
    nodeType: string,
    data: { id: string; parent: ParentRef } & Record<string, unknown>
  ): Record<string, unknown> {
    const nodeClass = this.document.getNodeClass(
      nodeType as Parameters<typeof this.document.getNodeClass>[0]
    );
    if (!nodeClass) {
      throw new ValidationError(data.id, `Unknown node type: ${nodeType}`);
    }

    const defaults = nodeClass.getDefaults();
    const nodeData = {
      ...defaults,
      ...data,
      type: nodeType
    };

    this.setNode(nodeData);
    return nodeData;
  }

  /**
   * Create the root node for a document.
   * @param rootId - The ID for the root node (defaults to 'root')
   */
  createRootNode(rootId = 'root'): void {
    this.setNode({ type: 'root', id: rootId });
  }

  /**
   * Run operations in a transaction. Changes are persisted once when the transaction completes.
   */
  transact(fn: () => void): void {
    this.inTransaction = true;
    try {
      fn();
    } finally {
      this.inTransaction = false;
      this.persist();
    }
  }

  /**
   * Subscribe to changes from the primary storage.
   * Useful for receiving remote changes in collaborative scenarios.
   */
  observeStorage(
    callback: (nodes: Record<string, unknown>) => void
  ): () => void {
    if (!this.primaryStorage?.observe) {
      return () => {
        // No-op unsubscribe when there's no observable storage
      };
    }

    return this.primaryStorage.observe((snapshot) => {
      this.nodes = snapshot.nodes;
      this.meta = snapshot.meta;
      callback(this.nodes);
    });
  }

  /** Persist current state to all storage providers */
  private persist(): void {
    const snapshot = { meta: this.meta, nodes: this.nodes };

    this.primaryStorage?.save(snapshot);
    for (const storage of this.writeOnlyStorages) {
      storage.save(snapshot);
    }
  }

  /** Persist only if not currently in a transaction */
  private persistIfNotInTransaction(): void {
    if (!this.inTransaction) {
      this.persist();
    }
  }
}
