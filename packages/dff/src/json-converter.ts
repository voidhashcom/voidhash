import type { DocumentDefinition, DocumentMeta } from './core';
import { ValidationError } from './editor';

/** JSON document format */
export interface JsonDocument {
  meta: DocumentMeta;
  nodes: Record<string, unknown>;
}

/** Interface for editor that JsonConverter can work with */
export interface JsonConvertibleEditor<TDoc extends DocumentDefinition> {
  readonly document: TDoc;
  getMeta(): DocumentMeta | null;
  getAllNodes(): Record<string, unknown>;
  getNodeIds(): string[];
  initialize(): void;
  setNode(node: Record<string, unknown>): void;
  deleteNode(nodeId: string): void;
  transact(fn: () => void): void;
}

/**
 * Converts paywall documents to/from JSON format.
 * Useful for importing/exporting documents, creating backups,
 * or sharing documents outside of the Yjs system.
 */
export class JsonConverter<TDoc extends DocumentDefinition> {
  private readonly editor: JsonConvertibleEditor<TDoc>;

  constructor(editor: JsonConvertibleEditor<TDoc>) {
    this.editor = editor;
  }

  /**
   * Export the current document to JSON format.
   * @returns The document as a JSON-serializable object
   * @throws Error if document is not initialized (no metadata)
   */
  toJson(): JsonDocument {
    const meta = this.editor.getMeta();
    if (!meta) {
      throw new Error('Document not initialized: missing metadata');
    }

    return {
      meta,
      nodes: this.editor.getAllNodes()
    };
  }

  /**
   * Export the current document to a JSON string.
   * @param pretty - If true, format with indentation for readability
   * @returns The document as a JSON string
   */
  toJsonString(pretty = false): string {
    const json = this.toJson();
    return pretty ? JSON.stringify(json, null, 2) : JSON.stringify(json);
  }

  /**
   * Import a document from JSON format.
   * This replaces the current document content.
   * @param json - The JSON document to import
   * @param validateSchema - If true, validates that the schema version matches (default: true)
   * @throws ValidationError if the document type doesn't match
   * @throws ValidationError if schema version is newer than supported
   */
  fromJson(json: JsonDocument, validateSchema = true): void {
    // Validate document type
    if (json.meta.documentType !== this.editor.document.type) {
      throw new ValidationError(
        'document',
        `Document type mismatch: expected '${this.editor.document.type}', got '${json.meta.documentType}'`
      );
    }

    // Validate schema version if requested
    if (
      validateSchema &&
      json.meta.schemaVersion > this.editor.document.schemaVersion
    ) {
      throw new ValidationError(
        'document',
        `Schema version ${json.meta.schemaVersion} is newer than supported version ${this.editor.document.schemaVersion}`
      );
    }

    // Migrate data if needed
    let nodes = json.nodes;
    if (json.meta.schemaVersion < this.editor.document.schemaVersion) {
      nodes = this.editor.document.migrate(
        nodes,
        json.meta.schemaVersion
      ) as Record<string, unknown>;
    }

    // Import everything in a single transaction
    this.editor.transact(() => {
      // Clear existing nodes
      for (const nodeId of this.editor.getNodeIds()) {
        this.editor.deleteNode(nodeId);
      }

      // Initialize metadata
      this.editor.initialize();

      // Import nodes
      for (const [_id, node] of Object.entries(nodes)) {
        this.editor.setNode(node as Record<string, unknown>);
      }
    });
  }

  /**
   * Import a document from a JSON string.
   * @param jsonString - The JSON string to parse and import
   * @param validateSchema - If true, validates that the schema version matches (default: true)
   */
  fromJsonString(jsonString: string, validateSchema = true): void {
    const json = JSON.parse(jsonString) as JsonDocument;
    this.fromJson(json, validateSchema);
  }

  /**
   * Create a deep clone of the current document as JSON.
   * Useful for creating snapshots or undo states.
   */
  snapshot(): JsonDocument {
    return JSON.parse(this.toJsonString()) as JsonDocument;
  }
}
