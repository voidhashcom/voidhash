import { Primitive } from "@voidhash/mimic-core";

import { actionValueSchema } from "../interactions/interactions.ts";
import { variableReferenceSchema } from "../variables/variables.ts";

/**
 * Literal value stored for a component prop binding.
 * Scalar keys mirror the variable type system (`select`/`image` manifest kinds
 * collapse to `string`); the `*-array` variants cover manifest `array` prop
 * kinds with scalar items.
 */
export const componentPropValueSchema = Primitive.Union(
  {
    boolean: Primitive.Struct({
      key: Primitive.Literal("boolean").required(),
      value: Primitive.Boolean().required(),
    }),
    "boolean-array": Primitive.Struct({
      key: Primitive.Literal("boolean-array").required(),
      value: Primitive.Array(Primitive.Boolean()).required(),
    }),
    number: Primitive.Struct({
      key: Primitive.Literal("number").required(),
      value: Primitive.Number().required(),
    }),
    "number-array": Primitive.Struct({
      key: Primitive.Literal("number-array").required(),
      value: Primitive.Array(Primitive.Number()).required(),
    }),
    product: Primitive.Struct({
      key: Primitive.Literal("product").required(),
      value: Primitive.Struct({
        // Optional string — absence means "no product selected" (the former null)
        productId: Primitive.String(),
      }).required(),
    }),
    string: Primitive.Struct({
      key: Primitive.Literal("string").required(),
      value: Primitive.String().required(),
    }),
    "string-array": Primitive.Struct({
      key: Primitive.Literal("string-array").required(),
      value: Primitive.Array(Primitive.String()).required(),
    }),
  },
  { discriminator: "key" },
);

/**
 * Binding stored for a component prop — either a literal value or a reference
 * to a variable declared on the node or one of its ancestors.
 */
export const componentPropBindingSchema = Primitive.Union({
  literal: Primitive.Struct({
    type: Primitive.Literal("literal").required(),
    value: componentPropValueSchema.required(),
  }),
  "variable-reference": Primitive.Struct({
    type: Primitive.Literal("variable-reference").required(),
    value: variableReferenceSchema.required(),
  }),
});

/**
 * Source of a value used by a component bound action. Mirrors
 * `actionValueSourceSchema` plus the `action-payload` variant, which reads a
 * field of the payload emitted by the component action at runtime.
 */
export const componentActionValueSourceSchema = Primitive.Union({
  "action-payload": Primitive.Struct({
    type: Primitive.Literal("action-payload").required(),
    value: Primitive.Struct({
      field: Primitive.String().required(),
    }).required(),
  }),
  literal: Primitive.Struct({
    type: Primitive.Literal("literal").required(),
    value: actionValueSchema.required(),
  }),
  "variable-reference": Primitive.Struct({
    type: Primitive.Literal("variable-reference").required(),
    value: Primitive.Struct({
      id: Primitive.String().required(),
    }).required(),
  }),
});

/**
 * Source for the product purchased by a component bound `purchase-product`
 * action. Mirrors `productSourceSchema` plus the `action-payload` variant.
 */
export const componentProductSourceSchema = Primitive.Union({
  "action-payload": Primitive.Struct({
    type: Primitive.Literal("action-payload").required(),
    field: Primitive.String().required(),
  }),
  literal: Primitive.Struct({
    type: Primitive.Literal("literal").required(),
    productId: Primitive.String().required(),
  }),
  "variable-reference": Primitive.Struct({
    type: Primitive.Literal("variable-reference").required(),
    variableId: Primitive.String().required(),
  }),
});

/**
 * Action bound to a named component action. Mirrors `actionSchema`, with
 * value sources extended to support the component's emitted action payload.
 */
export const componentBoundActionSchema = Primitive.Union({
  "close-paywall": Primitive.Struct({
    type: Primitive.Literal("close-paywall").required(),
  }),
  none: Primitive.Struct({
    type: Primitive.Literal("none").required(),
  }),
  "purchase-product": Primitive.Struct({
    type: Primitive.Literal("purchase-product").required(),
    payload: componentProductSourceSchema.required(),
  }),
  "set-variable": Primitive.Struct({
    type: Primitive.Literal("set-variable").required(),
    payload: Primitive.Struct({
      variableId: Primitive.String().required(),
      newValue: componentActionValueSourceSchema.required(),
    }).required(),
  }),
});
