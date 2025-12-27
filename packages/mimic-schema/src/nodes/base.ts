import { Primitive } from '@voidhash/mimic';
import { stateSchema } from '../states/states';
import { variableSchema } from '../variables/variables';

/** Parent reference for ordering children */
export const parentRefSchema = Primitive.Struct({
  id: Primitive.String(),
  /** Fractional index for ordering */
  index: Primitive.String()
});

export type Variable = Primitive.InferState<typeof variableSchema>;

/** Used for definition of variables that are local to the node */
export const localVariables = Primitive.Array(variableSchema).default([]);

export const states = Primitive.Array(stateSchema).default([]);

/** Linked variables for linking to other variables */
export const linkedVariables = Primitive.Array(
  Primitive.Struct({
    nodeId: Primitive.String(),
    name: Primitive.String()
  })
).default([]);

