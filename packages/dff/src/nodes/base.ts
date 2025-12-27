// import { z } from 'zod';
// import { stateSchema } from '../states/states';
// import { variableSchema } from '../variables/variables';

// /** Parent reference for ordering children */
// export const parentRefSchema = z.object({
//   id: z.string(),
//   /** Fractional index for ordering */
//   index: z.string()
// });
// export type Variable = z.infer<typeof variableSchema>;

// /** Used for definition of variables that are local to the node */
// export const localVariables = z.array(variableSchema).default([]);

// export const states = z.array(stateSchema).default([]);

// /** Linked variables for linking to other variables */
// export const linkedVariables = z
//   .array(
//     z.object({
//       nodeId: z.string(),
//       name: z.string()
//     })
//   )
//   .default([]);
