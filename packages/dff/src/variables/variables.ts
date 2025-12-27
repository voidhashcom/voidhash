// import { z } from 'zod';

// // Variable types
// export const stringVariableTypeSchema = z.object({
//   key: z.literal('string').default('string'),
//   value: z.string().default('')
// });

// export const numberVariableTypeSchema = z.object({
//   key: z.literal('number').default('number'),
//   value: z.number().default(0)
// });

// export const booleanVariableTypeSchema = z.object({
//   key: z.literal('boolean').default('boolean'),
//   value: z.boolean().default(false)
// });

// export const productVariableTypeSchema = z.object({
//   key: z.literal('product').default('product'),
//   value: z
//     .object({
//       productId: z.union([z.string(), z.literal(null)])
//     })
//     .default({
//       productId: null
//     })
// });

// export const variableTypeSchema = z.union([
//   stringVariableTypeSchema,
//   numberVariableTypeSchema,
//   booleanVariableTypeSchema,
//   productVariableTypeSchema
// ]);

// // Variable
// export const variableSchema = z.object({
//   id: z.string(),
//   name: z.string(),
//   value: variableTypeSchema
// });

// // Variable reference
// export const variableReferenceSchema = z.object({
//   id: z.string()
// });
