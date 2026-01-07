import { Primitive } from "@voidhash/mimic";

import { stateSchema } from "../states/states";
import { variableSchema } from "../variables/variables";

export type Variable = Primitive.InferState<typeof variableSchema>;

/** Used for definition of variables that are local to the node */
export const localVariables = Primitive.Array(variableSchema).default([]);

export const states = Primitive.Array(stateSchema).default([]);

/** Linked variables for linking to other variables */
export const linkedVariables = Primitive.Array(
  Primitive.Struct({
    name: Primitive.String(),
    nodeId: Primitive.String(),
  })
).default([]);
