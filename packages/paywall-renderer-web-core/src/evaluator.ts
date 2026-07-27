import type { ArrayEntry } from "@voidhash/mimic-schema";

import type { Conjunction, DNF, Operand, Predicate, VariableValue } from "./snapshot-types";
import type { VariableReader } from "./variables";

/**
 * Unwraps an ordered-array entry (`{id, pos, value}`) to its value. Legacy
 * embedded payloads carry bare values (and pos-less `{id, value}` entries),
 * so the runtime check stays permissive: anything with `id` + `value` and no
 * `type` discriminator is treated as an entry.
 */
function unwrapValue<T>(candidate: T | ArrayEntry<T | undefined> | undefined): T | undefined {
  if (!candidate) {
    return undefined;
  }
  if (
    typeof candidate === "object" &&
    candidate !== null &&
    "id" in candidate &&
    "value" in candidate &&
    !("type" in candidate)
  ) {
    return candidate.value as T;
  }
  return candidate as T;
}

export function evaluateDNF(dnf: DNF, variables: VariableReader): boolean {
  if (!dnf?.value || !Array.isArray(dnf.value)) {
    return false;
  }
  return dnf.value.some((conjunctionEntry) => {
    const conjunction = unwrapValue<Conjunction>(conjunctionEntry);
    if (!conjunction) {
      return false;
    }
    return evaluateConjunction(conjunction, variables);
  });
}

function evaluateConjunction(conjunction: Conjunction, variables: VariableReader): boolean {
  if (!conjunction?.value || !Array.isArray(conjunction.value)) {
    return false;
  }
  return conjunction.value.every((predicateEntry) => {
    const predicate = unwrapValue<Predicate>(predicateEntry);
    if (!predicate) {
      return false;
    }
    return evaluatePredicate(predicate, variables);
  });
}

function resolveOperand(operand: Operand, variables: VariableReader): VariableValue | undefined {
  if (operand.type === "literal") {
    return operand.value;
  }
  if (!operand.value || !("id" in operand.value) || !operand.value.id) {
    return undefined;
  }
  return variables.get(operand.value.id);
}

function toComparable(v: VariableValue): string | number | boolean {
  switch (v.key) {
    case "boolean":
      return v.value ?? false;
    case "number":
      return v.value ?? 0;
    case "string":
      return v.value ?? "";
    case "product":
      return v.value?.productId ?? "";
    default:
      return "";
  }
}

function evaluatePredicate(predicate: Predicate, variables: VariableReader): boolean {
  if (!predicate?.value?.left || !predicate?.value?.right) {
    return false;
  }
  const left = resolveOperand(predicate.value.left, variables);
  const right = resolveOperand(predicate.value.right, variables);

  if (left === undefined || right === undefined) {
    return false;
  }

  const l = toComparable(left);
  const r = toComparable(right);

  switch (predicate.type) {
    case "equals":
      return l === r;
    case "not-equals":
      return l !== r;
    case "greater-than":
      return l > r;
    case "greater-than-or-equal":
      return l >= r;
    case "less-than":
      return l < r;
    case "less-than-or-equal":
      return l <= r;
    default:
      return false;
  }
}
