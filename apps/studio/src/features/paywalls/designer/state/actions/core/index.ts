/**
 * Core utilities for node actions.
 *
 * This module exports shared schemas and types used by node actions.
 */

import { Schema } from 'effect';

/**
 * Schema for variable type keys.
 */
export const variableTypeKeySchema = Schema.Literal(
  'string',
  'number',
  'boolean',
  'product'
);

export type VariableTypeKey = Schema.Schema.Type<typeof variableTypeKeySchema>;
