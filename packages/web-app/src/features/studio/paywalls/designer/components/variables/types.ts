import type { Variable, VariableType } from "@voidhash/mimic-schema";

/**
 * Flat variable optionally annotated for picker UIs: `ownerLabel` marks
 * variables declared on an ancestor node (rendered as secondary "from …"
 * text), `aliasId` is an alternate id (array-entry vs internal) that stored
 * references may use instead of `id`.
 */
export interface LabeledVariable extends Variable {
  readonly ownerLabel?: string;
  readonly aliasId?: string;
}

/**
 * Finds a variable by a stored reference id, matching either the primary id
 * or the alias id (entry and internal ids both appear in stored references).
 */
export function findVariableByRef(
  variables: readonly LabeledVariable[],
  referenceId: string | null | undefined,
): LabeledVariable | undefined {
  if (!referenceId) {
    return undefined;
  }
  return variables.find((v) => v.id === referenceId || v.aliasId === referenceId);
}

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
  value: VariableInputValue,
): value is { type: "literal"; value: VariableType } {
  return value.type === "literal";
}

/**
 * Type guard to check if a VariableInputValue is a variable reference.
 */
export function isVariableReference(
  value: VariableInputValue,
): value is { type: "variable-reference"; value: { id: string } } {
  return value.type === "variable-reference";
}
