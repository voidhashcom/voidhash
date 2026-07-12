import { Primitive } from "@voidhash/mimic-core";

export const stringVariableTypeSchema = Primitive.Struct({
  key: Primitive.Literal("string").required(),
  value: Primitive.String().default(""),
});

export const numberVariableTypeSchema = Primitive.Struct({
  key: Primitive.Literal("number").required(),
  value: Primitive.Number().default(0),
});

export const booleanVariableTypeSchema = Primitive.Struct({
  key: Primitive.Literal("boolean").required(),
  value: Primitive.Boolean().default(false),
});

export const productVariableTypeSchema = Primitive.Struct({
  key: Primitive.Literal("product").required(),
  value: Primitive.Struct({
    // Optional string — absence means "no product selected" (the former null)
    productId: Primitive.String(),
  }).default({}),
});

export const variableTypeSchema = Primitive.Union(
  {
    boolean: booleanVariableTypeSchema,
    number: numberVariableTypeSchema,
    product: productVariableTypeSchema,
    string: stringVariableTypeSchema,
  },
  { discriminator: "key" },
);

export const variableSchema = Primitive.Struct({
  id: Primitive.String().required(),
  name: Primitive.String().required(),
  value: variableTypeSchema.required(),
});

export const variableReferenceSchema = Primitive.Struct({
  id: Primitive.String().required(),
});
