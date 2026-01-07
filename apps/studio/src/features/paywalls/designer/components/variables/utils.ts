import type {
  Variable,
  VariableType,
  VariableTypeKey,
} from "@voidhash/mimic-schema";

import { VARIABLE_TYPE_REGISTRY } from "../../constants";
import type { VariableInputValue } from "./types";

/**
 * Creates a default operand (literal value) for a given variable type.
 */
export function createDefaultOperand(
  type: VariableTypeKey = "boolean"
): VariableInputValue {
  return {
    type: "literal",
    value: VARIABLE_TYPE_REGISTRY[type].defaultValue,
  };
}

/**
 * Gets the variable type key from a variable input value.
 * For literals, returns the type from the value itself.
 * For variable references, looks up the variable and returns its type.
 */
export function getOperandType(
  operand: VariableInputValue,
  variables: readonly Variable[]
): VariableTypeKey {
  if (operand.type === "literal") {
    return (operand.value as VariableType).key;
  }
  const variableRef = operand.value as { id: string };
  const variable = variables.find((v) => v.id === variableRef.id);
  return variable?.value.key ?? "boolean";
}

/**
 * Creates a deep clone of an object using JSON serialization.
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Performs a deep equality check using JSON serialization.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
