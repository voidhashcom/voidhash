import type { Primitive } from "@voidhash/mimic";

import type {
	actionOverrideSchema,
	conjunctionSchema,
	dnfSchema,
	operandSchema,
	predicateSchema,
} from "./states";

// Export DNF type for use in other files
export type DNF = Primitive.InferState<typeof dnfSchema>;
export type DNFSnapshot = Primitive.InferSnapshot<typeof dnfSchema>;
export type Conjunction = Primitive.InferState<typeof conjunctionSchema>;
export type ConjunctionSnapshot = Primitive.InferSnapshot<
	typeof conjunctionSchema
>;
export type Predicate = Primitive.InferState<typeof predicateSchema>;
export type PredicateSnapshot = Primitive.InferSnapshot<typeof predicateSchema>;
export type Operand = Primitive.InferState<typeof operandSchema>;
export type OperandSnapshot = Primitive.InferSnapshot<typeof operandSchema>;
export type ActionOverride = Primitive.InferState<typeof actionOverrideSchema>;
export type ActionOverrideSnapshot = Primitive.InferSnapshot<
	typeof actionOverrideSchema
>;
