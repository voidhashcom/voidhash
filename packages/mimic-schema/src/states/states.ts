import { Primitive } from "@voidhash/mimic-core";

import { actionSchema } from "../interactions/interactions.ts";
import { variableTypeSchema } from "../variables/index.ts";
import { variableReferenceSchema } from "../variables/variables.ts";

// Union variant keys must equal the wire discriminator values in this engine.
export const operandSchema = Primitive.Union({
  literal: Primitive.Struct({
    type: Primitive.Literal("literal").required(),
    value: variableTypeSchema.required(),
  }),
  "variable-reference": Primitive.Struct({
    type: Primitive.Literal("variable-reference").required(),
    value: variableReferenceSchema.required(),
  }),
});

export const equalsPredicateSchema = Primitive.Struct({
  type: Primitive.Literal("equals").required(),
  value: Primitive.Struct({
    left: operandSchema.required(),
    right: operandSchema.required(),
  }).required(),
});

export const notEqualsPredicateSchema = Primitive.Struct({
  type: Primitive.Literal("not-equals").required(),
  value: Primitive.Struct({
    left: operandSchema.required(),
    right: operandSchema.required(),
  }).required(),
});

export const greaterThanPredicateSchema = Primitive.Struct({
  type: Primitive.Literal("greater-than").required(),
  value: Primitive.Struct({
    left: operandSchema.required(),
    right: operandSchema.required(),
  }).required(),
});

export const greaterThanOrEqualPredicateSchema = Primitive.Struct({
  type: Primitive.Literal("greater-than-or-equal").required(),
  value: Primitive.Struct({
    left: operandSchema.required(),
    right: operandSchema.required(),
  }).required(),
});

export const lessThanPredicateSchema = Primitive.Struct({
  type: Primitive.Literal("less-than").required(),
  value: Primitive.Struct({
    left: operandSchema.required(),
    right: operandSchema.required(),
  }).required(),
});

export const lessThanOrEqualPredicateSchema = Primitive.Struct({
  type: Primitive.Literal("less-than-or-equal").required(),
  value: Primitive.Struct({
    left: operandSchema.required(),
    right: operandSchema.required(),
  }).required(),
});

export const predicateSchema = Primitive.Union({
  equals: equalsPredicateSchema,
  "greater-than": greaterThanPredicateSchema,
  "greater-than-or-equal": greaterThanOrEqualPredicateSchema,
  "less-than": lessThanPredicateSchema,
  "less-than-or-equal": lessThanOrEqualPredicateSchema,
  "not-equals": notEqualsPredicateSchema,
});

export const conjunctionSchema = Primitive.Struct({
  type: Primitive.Literal("and").required(),
  value: Primitive.Array(predicateSchema).minLength(1).required(),
});

export const dnfSchema = Primitive.Struct({
  type: Primitive.Literal("or").required(),
  value: Primitive.Array(conjunctionSchema).minLength(1).required(),
});

export const actionOverrideSchema = Primitive.Struct({
  action: actionSchema.required(),
  interactionId: Primitive.String().required(),
});

export function createStateSchemaWithStyleOverrides<
  TStyleOverridesSchema extends Primitive.AnyPrimitive,
>(styleOverridesSchema: TStyleOverridesSchema) {
  return Primitive.Struct({
    condition: dnfSchema.required(),
    id: Primitive.String().required(),
    name: Primitive.String().required(),
    overrides: Primitive.Struct({
      style: styleOverridesSchema,
    }).default({}),
  });
}

export function createStateSchemaWithStyleAndActionOverrides<
  TStyleOverridesSchema extends Primitive.AnyPrimitive,
>(styleOverridesSchema: TStyleOverridesSchema) {
  return Primitive.Struct({
    condition: dnfSchema.required(),
    id: Primitive.String().required(),
    name: Primitive.String().required(),
    overrides: Primitive.Struct({
      actions: Primitive.Array(actionOverrideSchema).default([]),
      style: styleOverridesSchema,
    }).default({}),
  });
}
