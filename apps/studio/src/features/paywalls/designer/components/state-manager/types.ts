import type { DNF, VariableType } from "@voidhash/mimic-schema";

import type { VariableInputValue } from "../variables/types";

/**
 * Variable with nested value structure (as stored in CRDT).
 * This differs from the mimic-schema Variable type which has a flat structure.
 */
export interface CRDTVariable {
  readonly id: string;
  readonly value: {
    readonly name: string;
    readonly value: VariableType;
  };
}

/**
 * State with nested value structure (as stored in CRDT).
 */
export interface CRDTState {
  readonly id: string;
  readonly value: {
    readonly name: string;
    readonly condition: DNF;
  };
}

/**
 * Props for the StateManagerSheet component.
 */
export interface StateManagerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  states: readonly CRDTState[];
  variables: readonly CRDTVariable[];
  onAddState: (name: string, condition: DNF) => void;
  onRemoveState: (stateId: string) => void;
  onUpdateStateName: (stateId: string, newName: string) => void;
  onUpdateStateCondition: (stateId: string, newCondition: DNF) => void;
}

/**
 * Local operand type for editing (same as VariableInputValue).
 */
export type LocalOperand = VariableInputValue;

/**
 * Local predicate type for editing DNF conditions.
 */
export interface LocalPredicate {
  type:
    | "equals"
    | "not-equals"
    | "greater-than"
    | "greater-than-or-equal"
    | "less-than"
    | "less-than-or-equal";
  value: {
    left: LocalOperand;
    right: LocalOperand;
  };
}

/**
 * Local conjunction (AND group) for editing.
 */
export interface LocalConjunction {
  type: "and";
  value: LocalPredicate[];
}

/**
 * Local DNF (Disjunctive Normal Form) for editing.
 */
export interface LocalDNF {
  type: "or";
  value: LocalConjunction[];
}
