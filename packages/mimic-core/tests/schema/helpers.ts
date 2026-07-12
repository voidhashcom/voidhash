import { expect } from "vitest";
import { CoreError, type ErrorCode, SchemaError, type SchemaErrorCode } from "../../src/index.js";

export const expectSchemaErrorCode = (
  operation: () => unknown,
  code: SchemaErrorCode,
): SchemaError => {
  try {
    operation();
  } catch (error) {
    expect(error).toBeInstanceOf(SchemaError);
    expect((error as SchemaError).code).toBe(code);
    return error as SchemaError;
  }

  throw new Error(`Expected SchemaError with code ${code}`);
};

export const expectCoreErrorCode = (operation: () => unknown, code: ErrorCode): CoreError => {
  try {
    operation();
  } catch (error) {
    expect(error).toBeInstanceOf(CoreError);
    expect((error as CoreError).code).toBe(code);
    return error as CoreError;
  }

  throw new Error(`Expected CoreError with code ${code}`);
};
