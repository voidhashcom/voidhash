import type { VariableType, VariableTypeKey } from '@voidhash/mimic-schema';

// ================================
// Debug
// ================================
export const SHOW_GRID = false;

export const CANVAS_DEFAULTS = {
  WORLD_WIDTH: 20_000,
  WORLD_HEIGHT: 20_000,
  MIN_ZOOM: 0.1,
  MAX_ZOOM: 5,
  GRID_SIZE: 20,
  // Colors
  PRIMARY_COLOR: 0x00_5e_ff,
  GRID_COLOR: 0x3f_3f_3f,
  BACKGROUND_COLOR: '#121212'
} as const;

export const INIT_SCREEN_DATA = {
  x: 0,
  y: 0,
  width: 390,
  height: 844,
  backgroundColor: '#ffffff'
} as const;

// ================================
// Variable Types
// ================================

/** Predicate types for comparing variable values */
export type PredicateType =
  | 'equals'
  | 'not-equals'
  | 'greater-than'
  | 'greater-than-or-equal'
  | 'less-than'
  | 'less-than-or-equal';

/** Configuration for each variable type */
export interface VariableTypeConfig {
  /** Display label for the type */
  label: string;
  /** Short label for compact UIs */
  shortLabel: string;
  /** Available predicates for this type in conditions */
  predicates: readonly PredicateType[];
  /** Default value when creating a new literal of this type */
  defaultValue: VariableType;
  /** Category for grouping in menus */
  category: 'primitive' | 'entity';
}

/** Registry of all available variable types and their configurations */
export const VARIABLE_TYPE_REGISTRY: Record<VariableTypeKey, VariableTypeConfig> =
  {
    boolean: {
      label: 'Boolean',
      shortLabel: 'Bool',
      predicates: ['equals', 'not-equals'],
      defaultValue: { key: 'boolean', value: true },
      category: 'primitive'
    },
    string: {
      label: 'Text',
      shortLabel: 'Text',
      predicates: ['equals', 'not-equals'],
      defaultValue: { key: 'string', value: '' },
      category: 'primitive'
    },
    number: {
      label: 'Number',
      shortLabel: 'Num',
      predicates: [
        'equals',
        'not-equals',
        'greater-than',
        'greater-than-or-equal',
        'less-than',
        'less-than-or-equal'
      ],
      defaultValue: { key: 'number', value: 0 },
      category: 'primitive'
    },
    product: {
      label: 'Product',
      shortLabel: 'Product',
      predicates: ['equals', 'not-equals'],
      defaultValue: { key: 'product', value: { productId: null } },
      category: 'entity'
    }
  };

/** Human-readable labels for predicate types */
export const PREDICATE_LABELS: Record<PredicateType, string> = {
  equals: 'equals',
  'not-equals': 'not equals',
  'greater-than': '>',
  'greater-than-or-equal': '>=',
  'less-than': '<',
  'less-than-or-equal': '<='
};
