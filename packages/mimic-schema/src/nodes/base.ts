import { Primitive } from "@voidhash/mimic-core";

import { variableSchema } from "../variables/variables.ts";

export type Variable = NonNullable<Primitive.InferSnapshot<typeof variableSchema>>;

/** Used for definition of variables that are local to the node */
export const localVariables = Primitive.Array(variableSchema).default([]);

/** Linked variables for linking to other variables */
export const linkedVariables = Primitive.Array(
  Primitive.Struct({
    name: Primitive.String().required(),
    nodeId: Primitive.String().required(),
  }),
).default([]);
