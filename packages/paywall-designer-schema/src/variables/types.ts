import type { Primitive } from "@voidhash/mimic";

import type {
	booleanVariableTypeSchema,
	numberVariableTypeSchema,
	productVariableTypeSchema,
	stringVariableTypeSchema,
	variableTypeSchema,
} from "./variables";

export type VariableType = Primitive.InferState<typeof variableTypeSchema>;
export type VariableTypeSnapshot = Primitive.InferSnapshot<
	typeof variableTypeSchema
>;
export type VariableTypeKey = VariableType["key"];
export type VariableTypeKeySnapshot = VariableTypeKey;
export type StringVariableType = Primitive.InferState<
	typeof stringVariableTypeSchema
>;
export type StringVariableTypeSnapshot = Primitive.InferSnapshot<
	typeof stringVariableTypeSchema
>;
export type NumberVariableType = Primitive.InferState<
	typeof numberVariableTypeSchema
>;
export type NumberVariableTypeSnapshot = Primitive.InferSnapshot<
	typeof numberVariableTypeSchema
>;
export type BooleanVariableType = Primitive.InferState<
	typeof booleanVariableTypeSchema
>;
export type BooleanVariableTypeSnapshot = Primitive.InferSnapshot<
	typeof booleanVariableTypeSchema
>;
export type ProductVariableType = Primitive.InferState<
	typeof productVariableTypeSchema
>;
export type ProductVariableTypeSnapshot = Primitive.InferSnapshot<
	typeof productVariableTypeSchema
>;
