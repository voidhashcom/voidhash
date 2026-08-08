/**
 * Core utilities for node actions.
 *
 * This module exports shared schemas and types used by node actions.
 */

import { Schema } from "effect";

/**
 * Schema for variable type keys.
 */
export const variableTypeKeySchema = Schema.Union([
  Schema.Literal("string"),
  Schema.Literal("number"),
  Schema.Literal("boolean"),
  Schema.Literal("product"),
]);

export type VariableTypeKey = Schema.Schema.Type<typeof variableTypeKeySchema>;
