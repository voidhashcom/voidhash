import type { VariableType } from "@voidhash/mimic-schema";

/**
 * Represents either a literal value or a reference to a variable.
 * This is the core type for the VariableInput component.
 */
export interface VariableInputValue {
  type: "literal" | "variable-reference";
  value: VariableType | { id: string };
}

/**
 * Type guard to check if a VariableInputValue is a literal.
 */
export function isLiteralValue(
  value: VariableInputValue
): value is { type: "literal"; value: VariableType } {
  return value.type === "literal";
}

/**
 * Type guard to check if a VariableInputValue is a variable reference.
 */
export function isVariableReference(
  value: VariableInputValue
): value is { type: "variable-reference"; value: { id: string } } {
  return value.type === "variable-reference";
}
