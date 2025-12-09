/**
 * V3 Schema Library
 * A Zod-like schema definition library for type-safe property definitions.
 */

export {
  ArraySchema,
  ObjectSchema,
  RecordSchema,
  UnionSchema
} from './complex';

export {
  BooleanSchema,
  LiteralSchema,
  NumberSchema,
  type PrimitiveSchema,
  StringSchema
} from './primitives';
export type { Infer, InferOrType, Refinement, Schema } from './types';

export {
  getDefaults,
  hasDefault,
  isOptional,
  validate
} from './utils';

import {
  ArraySchema,
  ObjectSchema,
  RecordSchema,
  UnionSchema
} from './complex';
import {
  BooleanSchema,
  LiteralSchema,
  NumberSchema,
  StringSchema
} from './primitives';
import type { Schema } from './types';

/**
 * Schema builder object - provides a fluent API for creating schemas.
 *
 * @example
 * const personSchema = s.object({
 *   name: s.string(),
 *   age: s.number().default(0),
 *   active: s.boolean().default(true),
 * });
 */
export const s = {
  /**
   * Create a string schema.
   */
  string: () => new StringSchema(),

  /**
   * Create a number schema.
   */
  number: () => new NumberSchema(),

  /**
   * Create a boolean schema.
   */
  boolean: () => new BooleanSchema(),

  /**
   * Create a literal schema for exact value matching.
   * Supports string, number, boolean, and null literals.
   */
  literal: <T extends string | number | boolean | null>(value: T) =>
    new LiteralSchema(value),

  /**
   * Create an object schema with a defined shape.
   */
  object: <T extends Record<string, Schema<unknown>>>(shape: T) =>
    new ObjectSchema(shape),

  /**
   * Create an array schema with an item schema.
   */
  array: <T extends Schema<unknown>>(itemSchema: T) =>
    new ArraySchema(itemSchema),

  /**
   * Create a union schema that matches any of the provided schemas.
   */
  union: <T extends readonly Schema<unknown>[]>(schemas: T) =>
    new UnionSchema(schemas),

  /**
   * Create a record schema with dynamic string keys and a value schema.
   */
  record: <T extends Schema<unknown>>(valueSchema: T) =>
    new RecordSchema(valueSchema)
};
