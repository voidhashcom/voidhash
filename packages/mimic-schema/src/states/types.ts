import type { Primitive } from "@voidhash/mimic-core";

import type {
  actionOverrideSchema,
  conjunctionSchema,
  dnfSchema,
  operandSchema,
  predicateSchema,
} from "./states.ts";

// Export DNF type for use in other files
export type DNF = NonNullable<Primitive.InferSnapshot<typeof dnfSchema>>;
export type DNFSnapshot = DNF;
export type Conjunction = NonNullable<Primitive.InferSnapshot<typeof conjunctionSchema>>;
export type ConjunctionSnapshot = Conjunction;
export type Predicate = NonNullable<Primitive.InferSnapshot<typeof predicateSchema>>;
export type PredicateSnapshot = Predicate;
export type Operand = NonNullable<Primitive.InferSnapshot<typeof operandSchema>>;
export type OperandSnapshot = Operand;
export type ActionOverride = NonNullable<Primitive.InferSnapshot<typeof actionOverrideSchema>>;
export type ActionOverrideSnapshot = ActionOverride;
