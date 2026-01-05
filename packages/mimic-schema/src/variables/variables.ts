import { Primitive } from "@voidhash/mimic";

export const stringVariableTypeSchema = Primitive.Struct({
	key: Primitive.Literal("string"),
	value: Primitive.String().default(""),
});

export const numberVariableTypeSchema = Primitive.Struct({
	key: Primitive.Literal("number"),
	value: Primitive.Number().default(0),
});

export const booleanVariableTypeSchema = Primitive.Struct({
	key: Primitive.Literal("boolean"),
	value: Primitive.Boolean().default(false),
});

export const productVariableTypeSchema = Primitive.Struct({
	key: Primitive.Literal("product"),
	value: Primitive.Struct({
		productId: Primitive.Either(
			Primitive.String(),
			Primitive.Literal(null),
		),
	}).default({
		productId: null,
	}),
});

export const variableTypeSchema = Primitive.Union({
	discriminator: "key",
	variants: {
		string: stringVariableTypeSchema,
		number: numberVariableTypeSchema,
		boolean: booleanVariableTypeSchema,
		product: productVariableTypeSchema,
	},
})

export const variableSchema = Primitive.Struct({
	id: Primitive.String(),
	name: Primitive.String(),
	value: variableTypeSchema,
});

export const variableReferenceSchema = Primitive.Struct({
	id: Primitive.String(),
});
