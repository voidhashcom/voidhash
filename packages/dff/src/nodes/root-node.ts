import type { BaseNodeData, PickStyles } from '../core';
import { WithChildren } from '../mixins';

/** RootNode data type - the document root that contains screens */
export interface RootNodeData {
  type: 'root';
  id: string;
}

/**
 * RootNode is a special node that serves as the document root.
 * It has no styles, no parent, and can contain screen nodes.
 *
 * Note: RootNode doesn't extend BaseNode because it has a completely
 * different structure (no parent, no name, no styles).
 */
class RootNodeBase {
  readonly type = 'root' as const;
  readonly defaultName = 'Root';
  readonly isRoot = true;
  readonly supportedStyles = [] as const;
  readonly styleOverrides = {};

  getDefaults(): { type: 'root'; name: string } {
    return {
      type: this.type,
      name: this.defaultName
    };
  }

  /** Root node has special validation - no parent required */
  validate(data: unknown): data is BaseNodeData & PickStyles<never> {
    if (typeof data !== 'object' || data === null) {
      return false;
    }
    const obj = data as Record<string, unknown>;
    return obj.type === 'root' && typeof obj.id === 'string';
  }
}

export const RootNode = WithChildren(RootNodeBase, ['screen']);
