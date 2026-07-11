import type { Primitive } from "@voidhash/mimic-core";

import type {
  booleanVariableTypeSchema,
  numberVariableTypeSchema,
  productVariableTypeSchema,
  stringVariableTypeSchema,
  variableTypeSchema,
} from "./variables.ts";

export type VariableType = NonNullable<Primitive.InferSnapshot<typeof variableTypeSchema>>;
export type VariableTypeSnapshot = VariableType;
export type VariableTypeKey = VariableType["key"];
export type VariableTypeKeySnapshot = VariableTypeKey;
export type StringVariableType = NonNullable<
  Primitive.InferSnapshot<typeof stringVariableTypeSchema>
>;
export type StringVariableTypeSnapshot = StringVariableType;
export type NumberVariableType = NonNullable<
  Primitive.InferSnapshot<typeof numberVariableTypeSchema>
>;
export type NumberVariableTypeSnapshot = NumberVariableType;
export type BooleanVariableType = NonNullable<
  Primitive.InferSnapshot<typeof booleanVariableTypeSchema>
>;
export type BooleanVariableTypeSnapshot = BooleanVariableType;
export type ProductVariableType = NonNullable<
  Primitive.InferSnapshot<typeof productVariableTypeSchema>
>;
export type ProductVariableTypeSnapshot = ProductVariableType;
