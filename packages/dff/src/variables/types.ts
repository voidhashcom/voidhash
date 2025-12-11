import type { Infer } from '../schema';
import type {
  booleanVariableTypeSchema,
  numberVariableTypeSchema,
  productVariableTypeSchema,
  stringVariableTypeSchema,
  variableTypeSchema
} from './variables';

export type VariableType = Infer<typeof variableTypeSchema>;
export type VariableTypeKey = VariableType['key'];
export type StringVariableType = Infer<typeof stringVariableTypeSchema>;
export type NumberVariableType = Infer<typeof numberVariableTypeSchema>;
export type BooleanVariableType = Infer<typeof booleanVariableTypeSchema>;
export type ProductVariableType = Infer<typeof productVariableTypeSchema>;
