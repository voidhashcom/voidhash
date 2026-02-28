import { Primitive } from "@voidhash/mimic";

import { actionSchema } from "../interactions/interactions";
import { variableTypeSchema } from "../variables";
import { variableReferenceSchema } from "../variables/variables";

export const operandSchema = Primitive.Union({
  discriminator: "type",
  variants: {
    literal: Primitive.Struct({
      type: Primitive.Literal("literal"),
      value: variableTypeSchema,
    }),
    variableReference: Primitive.Struct({
      type: Primitive.Literal("variable-reference"),
      value: variableReferenceSchema,
    }),
  },
});

export const equalsPredicateSchema = Primitive.Struct({
  type: Primitive.Literal("equals"),
  value: Primitive.Struct({
    left: operandSchema,
    right: operandSchema,
  }),
});

export const notEqualsPredicateSchema = Primitive.Struct({
  type: Primitive.Literal("not-equals"),
  value: Primitive.Struct({
    left: operandSchema,
    right: operandSchema,
  }),
});

export const greaterThanPredicateSchema = Primitive.Struct({
  type: Primitive.Literal("greater-than"),
  value: Primitive.Struct({
    left: operandSchema,
    right: operandSchema,
  }),
});

export const greaterThanOrEqualPredicateSchema = Primitive.Struct({
  type: Primitive.Literal("greater-than-or-equal"),
  value: Primitive.Struct({
    left: operandSchema,
    right: operandSchema,
  }),
});

export const lessThanPredicateSchema = Primitive.Struct({
  type: Primitive.Literal("less-than"),
  value: Primitive.Struct({
    left: operandSchema,
    right: operandSchema,
  }),
});

export const lessThanOrEqualPredicateSchema = Primitive.Struct({
  type: Primitive.Literal("less-than-or-equal"),
  value: Primitive.Struct({
    left: operandSchema,
    right: operandSchema,
  }),
});

export const predicateSchema = Primitive.Union({
  discriminator: "type",
  variants: {
    equals: equalsPredicateSchema,
    greaterThan: greaterThanPredicateSchema,
    greaterThanOrEqual: greaterThanOrEqualPredicateSchema,
    lessThan: lessThanPredicateSchema,
    lessThanOrEqual: lessThanOrEqualPredicateSchema,
    notEquals: notEqualsPredicateSchema,
  },
});

export const conjunctionSchema = Primitive.Struct({
  type: Primitive.Literal("and"),
  value: Primitive.Array(predicateSchema).minLength(1),
});

export const dnfSchema = Primitive.Struct({
  type: Primitive.Literal("or"),
  value: Primitive.Array(conjunctionSchema).minLength(1),
});

export const actionOverrideSchema = Primitive.Struct({
  action: actionSchema.required(),
  interactionId: Primitive.String().required(),
});

export function createStateSchemaWithStyleOverrides<
  TStyleOverridesSchema extends Primitive.AnyPrimitive,
>(
  styleOverridesSchema: TStyleOverridesSchema,
) {
  return Primitive.Struct({
    condition: dnfSchema,
    id: Primitive.String(),
    name: Primitive.String(),
    overrides: Primitive.Struct({
      style: styleOverridesSchema,
    }),
  });
}

export function createStateSchemaWithStyleAndActionOverrides<
  TStyleOverridesSchema extends Primitive.AnyPrimitive,
>(
  styleOverridesSchema: TStyleOverridesSchema,
) {
  return Primitive.Struct({
    condition: dnfSchema,
    id: Primitive.String(),
    name: Primitive.String(),
    overrides: Primitive.Struct({
      actions: Primitive.Array(actionOverrideSchema).default([]),
      style: styleOverridesSchema,
    }),
  });
}
