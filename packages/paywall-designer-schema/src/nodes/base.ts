import { Primitive } from "@voidhash/mimic";

import { variableSchema } from "../variables/variables";

export type Variable = Primitive.InferState<typeof variableSchema>;

/** Used for definition of variables that are local to the node */
export const localVariables = Primitive.Array(variableSchema).default([]);

/** Linked variables for linking to other variables */
export const linkedVariables = Primitive.Array(
  Primitive.Struct({
    name: Primitive.String(),
    nodeId: Primitive.String(),
  })
).default([]);
