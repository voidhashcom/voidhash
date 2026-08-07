import { expect } from "vitest";
import { CoreError, type ErrorCode, SchemaError, type SchemaErrorCode } from "../../src/index.js";

/**
 * Literal-preserving identity function — the assertion-free replacement for
 * `x as const` in `it.each` tables.
 */
export const constant = <const T>(value: T): T => value;

export const expectSchemaErrorCode = (
  operation: () => unknown,
  code: SchemaErrorCode,
): SchemaError => {
  try {
    operation();
  } catch (error) {
    expect(error).toBeInstanceOf(SchemaError);
    if (error instanceof SchemaError) {
      expect(error.code).toBe(code);
      return error;
    }
  }

  return expect.unreachable(`Expected SchemaError with code ${code}`);
};

export const expectCoreErrorCode = (operation: () => unknown, code: ErrorCode): CoreError => {
  try {
    operation();
  } catch (error) {
    expect(error).toBeInstanceOf(CoreError);
    if (error instanceof CoreError) {
      expect(error.code).toBe(code);
      return error;
    }
  }

  return expect.unreachable(`Expected CoreError with code ${code}`);
};
