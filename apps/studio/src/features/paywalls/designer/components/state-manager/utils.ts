import type {
  DNF,
  Variable,
  VariableType,
  VariableTypeKey,
} from "@voidhash/mimic-schema";

import { type PredicateType, VARIABLE_TYPE_REGISTRY } from "../../constants";
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
export const PREDICATES_BY_TYPE: Record<VariableTypeKey, PredicateType[]> =
  Object.fromEntries(
    Object.entries(VARIABLE_TYPE_REGISTRY).map(([key, config]) => [
      key,
      [...config.predicates],
    ])
  ) as Record<VariableTypeKey, PredicateType[]>;

/**
 * Converts a CRDT variable to the flat Variable type used by VariableInput.
 */
export function toFlatVariable(crdtVar: CRDTVariable): Variable {
  return {
    id: crdtVar.id,
    name: crdtVar.value.name,
    value: crdtVar.value.value,
  };
}

/**
 * Converts an array of CRDT variables to flat Variables.
 */
export function toFlatVariables(crdtVars: readonly CRDTVariable[]): Variable[] {
  return crdtVars.map(toFlatVariable);
}

/**
 * Gets the variable type key from a CRDT variable by ID.
 */
export function getCRDTVariableType(
  variableId: string,
  variables: readonly CRDTVariable[]
): VariableTypeKey {
  const variable = variables.find((v) => v.id === variableId);
  return variable?.value.value.key ?? "boolean";
}

/**
 * Creates a default DNF condition (always true: true === true).
 */
export function createDefaultCondition(): DNF {
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
  } as unknown as DNF;
}

/**
 * Creates a default predicate, using the first variable if available.
 */
export function createDefaultPredicate(
  variables: readonly CRDTVariable[]
): LocalPredicate {
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
export function createDefaultConjunction(
  variables: readonly CRDTVariable[]
): LocalConjunction {
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
  variables: readonly CRDTVariable[]
): VariableTypeKey {
  if (operand.type === "literal") {
    return (operand.value as VariableType).key;
  }
  const variableRef = operand.value as { id: string };
  return getCRDTVariableType(variableRef.id, variables);
}

/**
 * Converts a CRDT DNF to local editing format.
 */
export function dnfToLocal(dnf: DNF): LocalDNF {
  const conjunctions = Array.isArray(dnf.value) ? dnf.value : [];
  return {
    type: "or",
    value: conjunctions.map((conj) => {
      const predicates = Array.isArray(conj.value) ? conj.value : [];
      return {
        type: "and" as const,
        value: predicates.map((pred) => ({
          type: pred.type as LocalPredicate["type"],
          value: {
            left: {
              type: pred.value.left.type as "literal" | "variable-reference",
              value: pred.value.left.value,
            },
            right: {
              type: pred.value.right.type as "literal" | "variable-reference",
              value: pred.value.right.value,
            },
          },
        })),
      };
    }),
  };
}

/**
 * Converts local editing format back to CRDT-compatible DNF.
 */
export function localToDnf(local: LocalDNF): DNF {
  return {
    type: "or",
    value: local.value.map((conj) => ({
      type: "and" as const,
      value: conj.value.map((pred) => ({
        type: pred.type,
        value: {
          left: {
            type: pred.value.left.type,
            value: pred.value.left.value,
          },
          right: {
            type: pred.value.right.type,
            value: pred.value.right.value,
          },
        },
      })),
    })),
  } as unknown as DNF;
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
