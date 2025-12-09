/**
 * Refinement function with optional error message.
 */
export interface Refinement<T> {
  fn: (value: T) => boolean;
  message?: string;
}

/**
 * Base interface for all schemas.
 * Provides type inference, defaults, validation, and optional fields.
 */
export interface Schema<T> {
  /** Phantom type for TypeScript inference */
  readonly _type: T;

  /** Default value if set */
  readonly _default?: T;

  /** Whether this field is optional */
  readonly _optional: boolean;

  /**
   * Set a default value for this schema.
   * Returns a new schema instance with the default set.
   */
  default(value: T): Schema<T>;

  /**
   * Make this field optional.
   * Returns a new schema instance marked as optional.
   */
  optional(): Schema<T | undefined>;

  /**
   * Add a custom validation refinement.
   * Returns a new schema instance with the refinement added.
   *
   * @param fn - Validation function that returns true if value is valid
   * @param message - Optional error message if validation fails
   */
  refine(
    fn: (value: T) => boolean,
    message?: string | { message: string }
  ): Schema<T>;

  /**
   * Get the default value for this schema.
   * Returns the default if set, otherwise throws.
   */
  getDefault(): T;

  /**
   * Validate a value against this schema.
   * Returns true if valid, false otherwise.
   */
  validate(value: unknown): value is T;
}

/**
 * Infer the TypeScript type from a schema.
 * Usage: type MyType = Infer<typeof mySchema>;
 */
export type Infer<S extends Schema<unknown>> = S['_type'];

/**
 * Helper type to extract the type from a schema or return the type directly.
 */
export type InferOrType<T> = T extends Schema<infer U> ? U : T;
