import { type Infer, s } from '../schema';
import { variableTypeSchema } from '../variables';

/** Parent reference for ordering children */
export const parentRefSchema = s.object({
  id: s.string(),
  /** Fractional index for ordering */
  index: s.string()
});

const variableSchema = s.object({
  name: s.string(),
  value: variableTypeSchema
});

export type Variable = Infer<typeof variableSchema>;

/** Used for definition of variables that are local to the node */
export const localVariables = s.array(variableSchema).default([]);

/** Linked variables for linking to other variables */
export const linkedVariables = s
  .array(
    s.object({
      nodeId: s.string(),
      name: s.string()
    })
  )
  .default([]);
