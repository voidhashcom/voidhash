import { s } from '../schema';

// Variable types
export const stringVariableTypeSchema = s.object({
  key: s.literal('string'),
  value: s.string().default('')
});

export const numberVariableTypeSchema = s.object({
  key: s.literal('number'),
  value: s.number().default(0)
});

export const booleanVariableTypeSchema = s.object({
  key: s.literal('boolean'),
  value: s.boolean().default(false)
});

export const productVariableTypeSchema = s.object({
  key: s.literal('product'),
  value: s
    .object({
      productId: s.union([s.string(), s.literal(null)])
    })
    .default({
      productId: null
    })
});

export const variableTypeSchema = s.union([
  stringVariableTypeSchema,
  numberVariableTypeSchema,
  booleanVariableTypeSchema,
  productVariableTypeSchema
]);

// Variable
export const variableSchema = s.object({
  name: s.string(),
  value: variableTypeSchema
});

// Variable reference
export const variableReferenceSchema = s.object({
  nodeId: s.string(),
  name: s.string()
});
