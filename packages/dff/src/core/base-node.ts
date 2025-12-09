import type { StylePropertyName, StylePropertyTypes } from '../styles';
import { getStyleDefaults, type PickStyles } from './node-styles';

/** Parent reference for ordering children */
export interface ParentRef {
  id: string;
  /** Fractional index for ordering */
  index: string;
}

/** Base fields every node has */
export interface BaseNodeData {
  id: string;
  type: string;
  name: string;
  parent: ParentRef;
}

/** Validate if a value is a valid ParentRef */
function isValidParentRef(value: unknown): value is ParentRef {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return typeof obj.id === 'string' && typeof obj.index === 'string';
}

/** Node class definition - extend this to create specific node types */
export class BaseNode<
  TType extends string = string,
  TStyles extends StylePropertyName = StylePropertyName
> {
  readonly type: TType = '' as TType;
  readonly defaultName: string = '';
  readonly isRoot: boolean = false;

  /** Style properties this node supports */
  readonly supportedStyles: readonly TStyles[] = [];

  /** Per-node default overrides */
  readonly styleOverrides: Partial<StylePropertyTypes> = {};

  /** Get all defaults for creating a new node */
  getDefaults(): { type: TType; name: string; style: PickStyles<TStyles> } {
    return {
      type: this.type,
      name: this.defaultName,
      style: getStyleDefaults(this.supportedStyles, this.styleOverrides)
    };
  }

  /** Validate that data has all required properties */
  validate(
    data: unknown
  ): data is BaseNodeData & { style: PickStyles<TStyles> } {
    if (typeof data !== 'object' || data === null) {
      return false;
    }
    const obj = data as Record<string, unknown>;

    // Check base fields
    if (typeof obj.id !== 'string') {
      return false;
    }
    if (obj.type !== this.type) {
      return false;
    }
    if (typeof obj.name !== 'string') {
      return false;
    }
    if (!isValidParentRef(obj.parent)) {
      return false;
    }

    // Check style object exists and contains required properties
    if (typeof obj.style !== 'object' || obj.style === null) {
      return false;
    }
    const styleObj = obj.style as Record<string, unknown>;

    // Check style properties exist (type checking is loose for flexibility)
    for (const prop of this.supportedStyles) {
      if (!(prop in styleObj)) {
        return false;
      }
    }

    return true;
  }
}
