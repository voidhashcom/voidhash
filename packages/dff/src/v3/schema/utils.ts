import { ObjectSchema } from './complex';
import type { Infer, Schema } from './types';

/**
 * Get default values for an object schema.
 * Recursively resolves all defaults from the schema shape.
 * Fields without defaults are skipped (caller must provide them).
 */
export function getDefaults<S extends Schema<unknown>>(
  schema: S
): Partial<Infer<S>> {
  if (schema instanceof ObjectSchema) {
    // Handle optional object schemas
    if (schema._optional && schema._default === undefined) {
      return undefined as unknown as Partial<Infer<S>>;
    }

    const defaults = {} as Partial<Infer<S>>;
    for (const [key, childSchema] of Object.entries(schema.shape) as [
      keyof typeof schema.shape,
      Schema<unknown>
    ][]) {
      const childDefault = getDefaults(childSchema);
      // Skip undefined values (either optional fields or required fields without defaults)
      if (childDefault === undefined) {
        continue;
      }
      // Set the default value
      (defaults as Record<string, unknown>)[key as string] = childDefault;
    }
    return defaults;
  }

  // For other schemas, use their getDefault method
  // If no default is set, return undefined (caller must provide the value)
  try {
    return schema.getDefault() as Partial<Infer<S>>;
  } catch {
    // Schema has no default - return undefined to indicate caller must provide it
    return undefined as unknown as Partial<Infer<S>>;
  }
}

/**
 * Validate a value against a schema.
 * Returns true if valid, false otherwise.
 */
export function validate<S extends Schema<unknown>>(
  schema: S,
  value: unknown
): value is Infer<S> {
  return schema.validate(value);
}

/**
 * Check if a schema has a default value set.
 */
export function hasDefault<S extends Schema<unknown>>(schema: S): boolean {
  return '_default' in schema && schema._default !== undefined;
}

/**
 * Check if a schema is optional.
 */
export function isOptional<S extends Schema<unknown>>(schema: S): boolean {
  return '_optional' in schema && schema._optional === true;
}
