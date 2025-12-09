import type { StylePropertyName } from '../styles';

/** Document metadata stored alongside nodes */
export interface DocumentMeta {
  schemaVersion: number;
  documentType: string;
}

/** Interface for node classes used in documents */
export interface NodeClassLike {
  readonly type: string;
  readonly defaultName: string;
  readonly isRoot: boolean;
  readonly supportedStyles: readonly StylePropertyName[];
  readonly allowedChildTypes?: readonly string[];
  getDefaults(): Record<string, unknown>;
  validate(data: unknown): boolean;
  canContain?(nodeType: string): boolean;
}

/**
 * Abstract document definition that defines:
 * - Available node types
 * - Schema version for migrations
 * - Root node types
 */
export abstract class DocumentDefinition<TNodeTypes extends string = string> {
  abstract readonly type: string;
  abstract readonly schemaVersion: number;
  abstract readonly nodeClasses: Record<TNodeTypes, NodeClassLike>;
  abstract readonly rootNodeTypes: readonly TNodeTypes[];

  /** Schema migrations: version -> migration function */
  readonly migrations: Record<number, (data: unknown) => unknown> = {};

  /** Get node class by type */
  getNodeClass(type: TNodeTypes): NodeClassLike | undefined {
    return this.nodeClasses[type];
  }

  /** Migrate data from older version to current */
  migrate(data: unknown, fromVersion: number): unknown {
    let current = data;
    for (let v = fromVersion + 1; v <= this.schemaVersion; v++) {
      const migration = this.migrations[v];
      if (migration) {
        current = migration(current);
      }
    }
    return current;
  }

  /** Validate a node using its class */
  validateNode(data: unknown): boolean {
    if (typeof data !== 'object' || data === null) {
      return false;
    }
    const type = (data as Record<string, unknown>).type as TNodeTypes;
    const nodeClass = this.getNodeClass(type);
    return nodeClass?.validate(data) ?? false;
  }

  /** Get defaults for creating a new node of the given type */
  getNodeDefaults(type: TNodeTypes): Record<string, unknown> | undefined {
    const nodeClass = this.getNodeClass(type);
    return nodeClass?.getDefaults();
  }
}
