import { s } from '../schema';

/** Parent reference for ordering children */
export const parentRefSchema = s.object({
  id: s.string(),
  /** Fractional index for ordering */
  index: s.string()
});

/** Used for definition of variables that are local to the node */
export const localVariables = s.array(
  s.object({
    name: s.string(),
    value: s.union([s.string(), s.number(), s.boolean()])
  })
);

/** Linked variables for linking to other variables */
export const linkedVariables = s.array(
  s.object({
    nodeId: s.string(),
    name: s.string()
  })
);
