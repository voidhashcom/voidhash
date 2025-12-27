// /**
//  * Schema Library - Re-exporting Zod
//  * Migration from custom schema library to Zod.
//  */

// import { z } from 'zod';

// // Re-export zod as z
// export { z };

// // Re-export zod types
// export type { z as Zod } from 'zod';

// // Compatibility: Export z as s for backward compatibility during migration
// // All code should migrate to use z directly
// export const s = z;

// // Type inference helpers
// export type Infer<T extends z.ZodTypeAny> = z.infer<T>;

// // Helper type for backward compatibility
// export type InferOrType<T> = T extends z.ZodTypeAny ? z.infer<T> : T;

// // Legacy type exports for compatibility
// export type Schema<T> = z.ZodType<T>;
// export type Refinement<_T> = never; // Not used in Zod

// // Utility functions that wrap Zod functionality
// export function validate<T extends z.ZodTypeAny>(
//   schema: T,
//   value: unknown
// ): value is z.infer<T> {
//   return schema.safeParse(value).success;
// }

// /**
//  * Get default values from a Zod schema.
//  * For object schemas, recursively extracts defaults from each field.
//  */
// export function getDefaults<T extends z.ZodTypeAny>(
//   schema: T
// ): Partial<z.infer<T>> {
//   if (schema instanceof z.ZodObject) {
//     const shape = schema.shape;
//     const defaults: Record<string, unknown> = {};

//     for (const [key, fieldSchema] of Object.entries(shape)) {
//       const fieldDefault = getDefaults(fieldSchema as z.ZodTypeAny);
//       // Include the default if it's not undefined
//       if (fieldDefault !== undefined) {
//         defaults[key] = fieldDefault;
//       }
//     }

//     return defaults as Partial<z.infer<T>>;
//   }

//   // For optional schemas, unwrap and get defaults from inner schema
//   if (schema instanceof z.ZodOptional) {
//     return getDefaults(schema._def.innerType) as Partial<z.infer<T>>;
//   }

//   // For nullable schemas, unwrap and get defaults from inner schema
//   if (schema instanceof z.ZodNullable) {
//     return getDefaults(schema._def.innerType) as Partial<z.infer<T>>;
//   }

//   // For non-object schemas, check if there's a default value

//   if (schema._def.defaultValue !== undefined) {
//     const defaultValue = schema._def.defaultValue;
//     if (typeof defaultValue === 'function') {
//       return defaultValue() as Partial<z.infer<T>>;
//     }
//     return defaultValue as Partial<z.infer<T>>;
//   }

//   // For arrays, return empty array as default
//   if (schema instanceof z.ZodArray) {
//     return [] as unknown as Partial<z.infer<T>>;
//   }

//   // No default available
//   return {} as Partial<z.infer<T>>;
// }

// /**
//  * Check if a schema has a default value.
//  * In Zod, we check if the schema has a _def.defaultValue set.
//  */
// export function hasDefault<T extends z.ZodTypeAny>(schema: T): boolean {
//   return schema._def.defaultValue !== undefined;
// }

// /**
//  * Check if a schema is optional.
//  */
// export function isOptional<T extends z.ZodTypeAny>(schema: T): boolean {
//   return schema instanceof z.ZodOptional || schema instanceof z.ZodNullable;
// }

// // Re-export Zod schema classes for type compatibility
// export type ObjectSchema<T extends z.ZodRawShape = z.ZodRawShape> =
//   z.ZodObject<T>;
// export type ArraySchema<T extends z.ZodTypeAny = z.ZodTypeAny> = z.ZodArray<T>;
// export type UnionSchema<T extends readonly z.ZodTypeAny[] = z.ZodTypeAny[]> =
//   z.ZodUnion<T>;
// export type RecordSchema<T extends z.ZodTypeAny = z.ZodTypeAny> = z.ZodRecord<
//   z.ZodString,
//   T
// >;
// export type StringSchema = z.ZodString;
// export type NumberSchema = z.ZodNumber;
// export type BooleanSchema = z.ZodBoolean;
// export type LiteralSchema<
//   T extends string | number | boolean | null = string | number | boolean | null
// > = z.ZodLiteral<T>;
