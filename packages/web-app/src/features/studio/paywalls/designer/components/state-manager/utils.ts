import type { DNF, VariableType, VariableTypeKey } from "@voidhash/mimic-schema";

import { type PredicateType, VARIABLE_TYPE_REGISTRY } from "../../constants";
import type { DnfInput } from "../../state/utils/replay";
import { isLiteralValue, isVariableReference, type LabeledVariable } from "../variables/types";
import { createDefaultOperand } from "../variables/utils";
import type {
  CRDTVariable,
  LocalConjunction,
  LocalDNF,
  LocalOperand,
  LocalPredicate,
} from "./types";

/**
 * Derive PREDICATES_BY_TYPE from VARIABLE_TYPE_REGISTRY.
 * This provides the available predicates for each variable type.
 */
export const PREDICATES_BY_TYPE: Record<VariableTypeKey, PredicateType[]> = Object.fromEntries(
  Object.entries(VARIABLE_TYPE_REGISTRY).map(([key, config]) => [key, [...config.predicates]]),
) as Record<VariableTypeKey, PredicateType[]>;

/**
 * Converts a CRDT variable to the flat Variable type used by VariableInput,
 * propagating the owner label when present.
 */
export function toFlatVariable(crdtVar: CRDTVariable): LabeledVariable {
  return {
    id: crdtVar.id,
    name: crdtVar.value.name,
    ownerLabel: crdtVar.ownerLabel,
    value: crdtVar.value.value,
  };
}

/**
 * Converts an array of CRDT variables to flat Variables.
 */
export function toFlatVariables(crdtVars: readonly CRDTVariable[]): LabeledVariable[] {
  return crdtVars.map(toFlatVariable);
}

/**
 * Gets the variable type key from a CRDT variable by ID.
 */
export function getCRDTVariableType(
  variableId: string,
  variables: readonly CRDTVariable[],
): VariableTypeKey {
  const variable = variables.find((v) => v.id === variableId);
  return variable?.value.value.key ?? "boolean";
}

/**
 * Creates a default DNF condition (always true: true === true) in write-input
 * shape.
 */
export function createDefaultCondition(): DnfInput {
  return {
    type: "or",
    value: [
      {
        type: "and",
        value: [
          {
            type: "equals",
            value: {
              left: {
                type: "literal",
                value: { key: "boolean", value: true },
              },
              right: {
                type: "literal",
                value: { key: "boolean", value: true },
              },
            },
          },
        ],
      },
    ],
  };
}

/**
 * Creates a default predicate, using the first variable if available.
 */
export function createDefaultPredicate(variables: readonly CRDTVariable[]): LocalPredicate {
  const firstVariable = variables[0];
  if (firstVariable) {
    const varType = firstVariable.value.value.key;
    return {
      type: "equals",
      value: {
        left: { type: "variable-reference", value: { id: firstVariable.id } },
        right: createDefaultOperand(varType),
      },
    };
  }
  // Fallback when no variables exist
  return {
    type: "equals",
    value: {
      left: createDefaultOperand("boolean"),
      right: createDefaultOperand("boolean"),
    },
  };
}

/**
 * Creates a default conjunction (AND group) with one predicate.
 */
export function createDefaultConjunction(variables: readonly CRDTVariable[]): LocalConjunction {
  return {
    type: "and",
    value: [createDefaultPredicate(variables)],
  };
}

/**
 * Gets the operand type from a local operand.
 */
export function getOperandType(
  operand: LocalOperand,
  variables: readonly CRDTVariable[],
): VariableTypeKey {
  if (operand.type === "literal") {
    return (operand.value as VariableType).key;
  }
  const variableRef = operand.value as { id: string };
  return getCRDTVariableType(variableRef.id, variables);
}

/**
 * Converts a decoded DNF snapshot (conjunction/predicate levels are
 * `{id, pos, value}` entry-wrapped) to the local editing format.
 */
export function dnfToLocal(dnf: DNF): LocalDNF {
  return {
    type: "or",
    value: dnf.value.flatMap((conjunctionEntry) => {
      const conjunction = conjunctionEntry.value;
      if (conjunction === undefined) {
        return [];
      }
      return [
        {
          type: "and" as const,
          value: conjunction.value.flatMap((predicateEntry) => {
            const predicate = predicateEntry.value;
            if (predicate === undefined) {
              return [];
            }
            return [
              {
                type: predicate.type,
                value: {
                  left: predicate.value.left,
                  right: predicate.value.right,
                },
              },
            ];
          }),
        },
      ];
    }),
  };
}

function operandToInput(operand: LocalOperand) {
  if (isLiteralValue(operand)) {
    return { type: "literal" as const, value: operand.value };
  }
  if (isVariableReference(operand)) {
    return { type: "variable-reference" as const, value: operand.value };
  }
  // oxlint-disable-next-line effect/noThrowStatement -- unreachable exhaustiveness guard over the `LocalOperand` union, reached only if the union gains a variant. `operandToInput` is a synchronous mapper called from React event handlers throughout this module; returning an Effect would force every call site into a runtime.
  throw new Error(`Unknown operand type: ${operand.type}`);
}

/**
 * Converts the local editing format back into condition write input (plain
 * arrays, unlike the entry-wrapped snapshot).
 */
export function localToDnfInput(local: LocalDNF): DnfInput {
  return {
    type: "or",
    value: local.value.map((conj) => ({
      type: "and" as const,
      value: conj.value.map((pred) => ({
        type: pred.type,
        value: {
          left: operandToInput(pred.value.left),
          right: operandToInput(pred.value.right),
        },
      })),
    })),
  };
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
