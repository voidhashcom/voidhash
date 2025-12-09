import type { Refinement, Schema } from './types';

/**
 * Base class for primitive schemas.
 * Handles default values, optional flag, and refinements.
 */
export abstract class PrimitiveSchema<T> implements Schema<T> {
  readonly _type!: T;
  readonly _default?: T;
  readonly _optional: boolean = false;
  readonly _refinements: Refinement<T>[] = [];

  constructor(
    defaultValue?: T,
    optional = false,
    refinements: Refinement<T>[] = []
  ) {
    if (defaultValue !== undefined) {
      (this as { _default: T })._default = defaultValue;
    }
    (this as { _optional: boolean })._optional = optional;
    (this as { _refinements: Refinement<T>[] })._refinements = refinements;
  }

  abstract validateBase(value: unknown): value is T;

  validate(value: unknown): value is T {
    // If optional and undefined, handle it specially
    // (validateBase doesn't accept undefined, so we handle it here)
    if (this._optional && value === undefined) {
      // If no refinements, undefined is valid for optional schemas
      if (this._refinements.length === 0) {
        return true;
      }
      // Apply refinements - they can handle undefined
      for (const refinement of this._refinements) {
        if (!refinement.fn(value as T)) {
          return false;
        }
      }
      return true;
    }

    // First check base type validation
    if (!this.validateBase(value)) {
      return false;
    }

    // Apply all refinements
    for (const refinement of this._refinements) {
      if (!refinement.fn(value as T)) {
        return false;
      }
    }

    return true;
  }

  default(value: T): Schema<T> {
    return new (
      this.constructor as new (
        defaultValue?: T,
        optional?: boolean,
        refinements?: Refinement<T>[]
      ) => Schema<T>
    )(value, this._optional, this._refinements) as Schema<T>;
  }

  optional(): Schema<T | undefined> {
    return new (
      this.constructor as new (
        defaultValue?: T,
        optional?: boolean,
        refinements?: Refinement<T>[]
      ) => Schema<T | undefined>
    )(this._default, true, this._refinements) as Schema<T | undefined>;
  }

  refine(
    fn: (value: T) => boolean,
    message?: string | { message: string }
  ): Schema<T> {
    const refinement: Refinement<T> = {
      fn,
      message: typeof message === 'string' ? message : message?.message
    };
    const newRefinements = [...this._refinements, refinement];
    return new (
      this.constructor as new (
        defaultValue?: T,
        optional?: boolean,
        refinements?: Refinement<T>[]
      ) => Schema<T>
    )(this._default, this._optional, newRefinements) as Schema<T>;
  }

  getDefault(): T {
    if (this._default !== undefined) {
      return this._default;
    }
    if (this._optional) {
      return undefined as T;
    }
    throw new Error(`No default value set for schema ${this.constructor.name}`);
  }
}

/**
 * String schema - validates string values.
 */
export class StringSchema extends PrimitiveSchema<string> {
  validateBase(value: unknown): value is string {
    return typeof value === 'string';
  }
}

/**
 * Number schema - validates number values.
 */
export class NumberSchema extends PrimitiveSchema<number> {
  validateBase(value: unknown): value is number {
    return typeof value === 'number' && !Number.isNaN(value);
  }
}

/**
 * Boolean schema - validates boolean values.
 */
export class BooleanSchema extends PrimitiveSchema<boolean> {
  validateBase(value: unknown): value is boolean {
    return typeof value === 'boolean';
  }
}

/**
 * Literal schema - validates exact literal values.
 * Supports string, number, boolean, and null literals.
 */
export class LiteralSchema<
  T extends string | number | boolean | null
> extends PrimitiveSchema<T> {
  private readonly literalValue: T;

  constructor(
    value: T,
    defaultValue?: T,
    optional = false,
    refinements: Refinement<T>[] = []
  ) {
    super(defaultValue, optional, refinements);
    this.literalValue = value;
  }

  validateBase(value: unknown): value is T {
    return value === this.literalValue;
  }

  default(value: T): LiteralSchema<T> {
    return new LiteralSchema(
      this.literalValue,
      value,
      this._optional,
      this._refinements
    );
  }

  optional(): LiteralSchema<T> {
    return new LiteralSchema(
      this.literalValue,
      this._default,
      true,
      this._refinements
    );
  }

  refine(
    fn: (value: T) => boolean,
    message?: string | { message: string }
  ): LiteralSchema<T> {
    const refinement: Refinement<T> = {
      fn,
      message: typeof message === 'string' ? message : message?.message
    };
    const newRefinements = [...this._refinements, refinement];
    return new LiteralSchema(
      this.literalValue,
      this._default,
      this._optional,
      newRefinements
    );
  }
}
