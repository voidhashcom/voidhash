import type { Primitive } from "@voidhash/mimic";

import type {
  conjunctionSchema,
  dnfSchema,
  operandSchema,
  predicateSchema,
} from "./states";

// Export DNF type for use in other files
export type DNF = Primitive.InferState<typeof dnfSchema>;
export type Conjunction = Primitive.InferState<typeof conjunctionSchema>;
export type Predicate = Primitive.InferState<typeof predicateSchema>;
export type Operand = Primitive.InferState<typeof operandSchema>;
