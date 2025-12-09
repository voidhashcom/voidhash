import type { Infer, Refinement, Schema } from './types';

/**
 * Object schema - validates and infers object shapes.
 * Maps to Y.Map in storage.
 */
export class ObjectSchema<T extends Record<string, Schema<unknown>>>
  implements Schema<{ [K in keyof T]: Infer<T[K]> }>
{
  readonly _type!: { [K in keyof T]: Infer<T[K]> };
  readonly _default?: { [K in keyof T]: Infer<T[K]> };
  readonly _optional: boolean = false;
  readonly _refinements: Refinement<{ [K in keyof T]: Infer<T[K]> }>[] = [];

  constructor(
    // biome-ignore lint/style/noParameterProperties: OK
    // biome-ignore lint/style/useConsistentMemberAccessibility: OK
    public readonly shape: T,
    defaultValue?: { [K in keyof T]: Infer<T[K]> },
    optional = false,
    refinements: Refinement<{ [K in keyof T]: Infer<T[K]> }>[] = []
  ) {
    if (defaultValue !== undefined) {
      (this as { _default: { [K in keyof T]: Infer<T[K]> } })._default =
        defaultValue;
    }
    (this as { _optional: boolean })._optional = optional;
    (
      this as {
        _refinements: Refinement<{ [K in keyof T]: Infer<T[K]> }>[];
      }
    )._refinements = refinements;
  }

  validate(value: unknown): value is { [K in keyof T]: Infer<T[K]> } {
    if (this._optional && value === undefined) {
      return true;
    }

    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const obj = value as Record<string, unknown>;

    // Validate shape first
    for (const [key, schema] of Object.entries(this.shape)) {
      if (!(key in obj)) {
        // Check if schema is optional
        if ('_optional' in schema && schema._optional) {
          continue;
        }
        // If not optional, check if it has a default (then it's still valid)
        if ('_default' in schema && schema._default !== undefined) {
          continue;
        }
        return false;
      }

      if (!schema.validate(obj[key])) {
        return false;
      }
    }

    // Apply refinements after shape validation passes
    const typedValue = value as { [K in keyof T]: Infer<T[K]> };
    for (const refinement of this._refinements) {
      if (!refinement.fn(typedValue)) {
        return false;
      }
    }

    return true;
  }

  default(value: { [K in keyof T]: Infer<T[K]> }): ObjectSchema<T> {
    return new ObjectSchema(
      this.shape,
      value,
      this._optional,
      this._refinements
    );
  }

  optional(): ObjectSchema<T> {
    return new ObjectSchema(this.shape, this._default, true, this._refinements);
  }

  refine(
    fn: (value: { [K in keyof T]: Infer<T[K]> }) => boolean,
    message?: string | { message: string }
  ): ObjectSchema<T> {
    const refinement: Refinement<{ [K in keyof T]: Infer<T[K]> }> = {
      fn,
      message: typeof message === 'string' ? message : message?.message
    };
    const newRefinements = [...this._refinements, refinement];
    return new ObjectSchema(
      this.shape,
      this._default,
      this._optional,
      newRefinements
    );
  }

  getDefault(): { [K in keyof T]: Infer<T[K]> } {
    if (this._optional && this._default === undefined) {
      return undefined as unknown as { [K in keyof T]: Infer<T[K]> };
    }

    if (this._default !== undefined) {
      return this._default;
    }

    // Generate defaults from shape
    const defaults = {} as { [K in keyof T]: Infer<T[K]> };
    for (const [key, schema] of Object.entries(this.shape) as [
      keyof T,
      Schema<unknown>
    ][]) {
      try {
        const value = schema.getDefault() as Infer<T[typeof key]>;
        // Skip undefined values for optional fields
        if (value === undefined && '_optional' in schema && schema._optional) {
          continue;
        }
        defaults[key] = value;
      } catch {
        // If schema has no default and is optional, skip it
        if ('_optional' in schema && schema._optional) {
          continue;
        }
        throw new Error(`No default value for required field: ${String(key)}`);
      }
    }
    return defaults;
  }
}

/**
 * Array schema - validates arrays of items matching the item schema.
 * Maps to Y.Array in storage.
 */
export class ArraySchema<T extends Schema<unknown>>
  implements Schema<Infer<T>[]>
{
  readonly _type!: Infer<T>[];
  readonly _default?: Infer<T>[];
  readonly _optional: boolean = false;
  readonly _refinements: Refinement<Infer<T>[]>[] = [];

  constructor(
    // biome-ignore lint/style/noParameterProperties: OK
    // biome-ignore lint/style/useConsistentMemberAccessibility: OK
    public readonly itemSchema: T,
    defaultValue?: Infer<T>[],
    optional = false,
    refinements: Refinement<Infer<T>[]>[] = []
  ) {
    if (defaultValue !== undefined) {
      (this as { _default: Infer<T>[] })._default = defaultValue;
    }
    (this as { _optional: boolean })._optional = optional;
    (this as { _refinements: Refinement<Infer<T>[]>[] })._refinements =
      refinements;
  }

  validate(value: unknown): value is Infer<T>[] {
    if (this._optional && value === undefined) {
      return true;
    }

    if (!Array.isArray(value)) {
      return false;
    }

    // Check for sparse arrays (holes with undefined)
    // Sparse arrays have holes at missing indices
    // We need to check if the array has any holes by checking if all indices exist
    for (let i = 0; i < value.length; i++) {
      if (!(i in value)) {
        // This is a hole in a sparse array
        // Sparse arrays are only valid if item schema accepts undefined (is optional)
        const itemIsOptional =
          '_optional' in this.itemSchema && this.itemSchema._optional;
        if (!itemIsOptional) {
          return false;
        }
        // For optional item schemas, holes are treated as undefined
        // Continue to next iteration to check the rest
        continue;
      }
      // Validate the actual item
      if (!this.itemSchema.validate(value[i])) {
        return false;
      }
    }

    // Apply refinements after item validation passes
    const typedValue = value as Infer<T>[];
    for (const refinement of this._refinements) {
      if (!refinement.fn(typedValue)) {
        return false;
      }
    }

    return true;
  }

  default(value: Infer<T>[]): ArraySchema<T> {
    return new ArraySchema(
      this.itemSchema,
      value,
      this._optional,
      this._refinements
    );
  }

  optional(): ArraySchema<T> {
    return new ArraySchema(
      this.itemSchema,
      this._default,
      true,
      this._refinements
    );
  }

  refine(
    fn: (value: Infer<T>[]) => boolean,
    message?: string | { message: string }
  ): ArraySchema<T> {
    const refinement: Refinement<Infer<T>[]> = {
      fn,
      message: typeof message === 'string' ? message : message?.message
    };
    const newRefinements = [...this._refinements, refinement];
    return new ArraySchema(
      this.itemSchema,
      this._default,
      this._optional,
      newRefinements
    );
  }

  getDefault(): Infer<T>[] {
    if (this._optional && this._default === undefined) {
      return undefined as unknown as Infer<T>[];
    }

    if (this._default !== undefined) {
      return this._default;
    }
    return [];
  }
}

/**
 * Union schema - validates values matching any of the provided schemas.
 */
export class UnionSchema<T extends readonly Schema<unknown>[]>
  implements Schema<Infer<T[number]>>
{
  readonly _type!: Infer<T[number]>;
  readonly _default?: Infer<T[number]>;
  readonly _optional: boolean = false;
  readonly _refinements: Refinement<Infer<T[number]>>[] = [];

  constructor(
    // biome-ignore lint/style/noParameterProperties: OK
    // biome-ignore lint/style/useConsistentMemberAccessibility: OK
    public readonly schemas: T,
    defaultValue?: Infer<T[number]>,
    optional = false,
    refinements: Refinement<Infer<T[number]>>[] = []
  ) {
    if (defaultValue !== undefined) {
      (this as { _default: Infer<T[number]> })._default = defaultValue;
    }
    (this as { _optional: boolean })._optional = optional;
    (this as { _refinements: Refinement<Infer<T[number]>>[] })._refinements =
      refinements;
  }

  validate(value: unknown): value is Infer<T[number]> {
    // If union itself is optional, undefined is valid
    if (this._optional && value === undefined) {
      return true;
    }

    // If union is not optional, reject undefined even if schemas inside are optional
    // The optional flag on schemas inside a union means the field can be missing,
    // not that undefined is a valid value for the union itself
    if (value === undefined && !this._optional) {
      return false;
    }

    // Check if value matches any schema
    const matchesSchema = this.schemas.some((schema) => schema.validate(value));
    if (!matchesSchema) {
      return false;
    }

    // Apply refinements after schema matching passes
    const typedValue = value as Infer<T[number]>;
    for (const refinement of this._refinements) {
      if (!refinement.fn(typedValue)) {
        return false;
      }
    }

    return true;
  }

  default(value: Infer<T[number]>): UnionSchema<T> {
    return new UnionSchema(
      this.schemas,
      value,
      this._optional,
      this._refinements
    );
  }

  optional(): UnionSchema<T> {
    return new UnionSchema(
      this.schemas,
      this._default,
      true,
      this._refinements
    );
  }

  refine(
    fn: (value: Infer<T[number]>) => boolean,
    message?: string | { message: string }
  ): UnionSchema<T> {
    const refinement: Refinement<Infer<T[number]>> = {
      fn,
      message: typeof message === 'string' ? message : message?.message
    };
    const newRefinements = [...this._refinements, refinement];
    return new UnionSchema(
      this.schemas,
      this._default,
      this._optional,
      newRefinements
    );
  }

  getDefault(): Infer<T[number]> {
    if (this._optional && this._default === undefined) {
      return undefined as Infer<T[number]>;
    }

    if (this._default !== undefined) {
      return this._default;
    }
    // Try to get default from first schema
    try {
      return this.schemas[0]?.getDefault() as Infer<T[number]>;
    } catch {
      throw new Error('No default value set for union schema');
    }
  }
}

/**
 * Record schema - validates objects with dynamic string keys and a value schema.
 * Maps to Y.Map in storage.
 */
export class RecordSchema<T extends Schema<unknown>>
  implements Schema<Record<string, Infer<T>>>
{
  readonly _type!: Record<string, Infer<T>>;
  readonly _default?: Record<string, Infer<T>>;
  readonly _optional: boolean = false;
  readonly _refinements: Refinement<Record<string, Infer<T>>>[] = [];

  constructor(
    // biome-ignore lint/style/noParameterProperties: OK
    // biome-ignore lint/style/useConsistentMemberAccessibility: OK
    public readonly valueSchema: T,
    defaultValue?: Record<string, Infer<T>>,
    optional = false,
    refinements: Refinement<Record<string, Infer<T>>>[] = []
  ) {
    if (defaultValue !== undefined) {
      (this as { _default: Record<string, Infer<T>> })._default = defaultValue;
    }
    (this as { _optional: boolean })._optional = optional;
    (
      this as { _refinements: Refinement<Record<string, Infer<T>>>[] }
    )._refinements = refinements;
  }

  validate(value: unknown): value is Record<string, Infer<T>> {
    if (this._optional && value === undefined) {
      return true;
    }

    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return false;
    }

    const obj = value as Record<string, unknown>;

    // Validate all values match value schema
    if (!Object.values(obj).every((val) => this.valueSchema.validate(val))) {
      return false;
    }

    // Apply refinements after value validation passes
    const typedValue = value as Record<string, Infer<T>>;
    for (const refinement of this._refinements) {
      if (!refinement.fn(typedValue)) {
        return false;
      }
    }

    return true;
  }

  default(value: Record<string, Infer<T>>): RecordSchema<T> {
    return new RecordSchema(
      this.valueSchema,
      value,
      this._optional,
      this._refinements
    );
  }

  optional(): RecordSchema<T> {
    return new RecordSchema(
      this.valueSchema,
      this._default,
      true,
      this._refinements
    );
  }

  refine(
    fn: (value: Record<string, Infer<T>>) => boolean,
    message?: string | { message: string }
  ): RecordSchema<T> {
    const refinement: Refinement<Record<string, Infer<T>>> = {
      fn,
      message: typeof message === 'string' ? message : message?.message
    };
    const newRefinements = [...this._refinements, refinement];
    return new RecordSchema(
      this.valueSchema,
      this._default,
      this._optional,
      newRefinements
    );
  }

  getDefault(): Record<string, Infer<T>> {
    if (this._optional && this._default === undefined) {
      return undefined as unknown as Record<string, Infer<T>>;
    }

    if (this._default !== undefined) {
      return this._default;
    }
    return {};
  }
}
