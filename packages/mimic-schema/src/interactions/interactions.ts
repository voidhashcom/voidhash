import { Primitive } from "@voidhash/mimic-core";

// =============================================================================
// Triggers
// =============================================================================

/**
 * Click trigger - fires when the element is clicked/tapped.
 * Simple trigger with no configuration needed.
 */
export const clickTriggerSchema = Primitive.Struct({
  type: Primitive.Literal("click").required(),
});

/**
 * Union of all trigger types.
 * Extensible for future triggers (hover, long-press, etc.)
 */
export const triggerSchema = Primitive.Union({
  click: clickTriggerSchema,
});

// =============================================================================
// Action Value Types
// =============================================================================

/**
 * Value types for the set-variable action.
 * Matches the variable types format (using "key" discriminator, including product).
 */
export const actionValueSchema = Primitive.Union(
  {
    boolean: Primitive.Struct({
      key: Primitive.Literal("boolean").required(),
      value: Primitive.Boolean().required(),
    }),
    number: Primitive.Struct({
      key: Primitive.Literal("number").required(),
      value: Primitive.Number().required(),
    }),
    string: Primitive.Struct({
      key: Primitive.Literal("string").required(),
      value: Primitive.String().required(),
    }),
    product: Primitive.Struct({
      key: Primitive.Literal("product").required(),
      value: Primitive.Struct({
        // Optional string — absence means "no product selected" (the former null)
        productId: Primitive.String(),
      }).required(),
    }),
  },
  { discriminator: "key" },
);

/**
 * Source for an action value - either a literal value or a reference to a variable.
 */
export const actionValueSourceSchema = Primitive.Union({
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
 * Source for a product - either a literal product ID or a reference to a product variable.
 */
export const productSourceSchema = Primitive.Union({
  literal: Primitive.Struct({
    type: Primitive.Literal("literal").required(),
    productId: Primitive.String().required(),
  }),
  "variable-reference": Primitive.Struct({
    type: Primitive.Literal("variable-reference").required(),
    variableId: Primitive.String().required(),
  }),
});

// =============================================================================
// Actions
// =============================================================================

/**
 * None action - placeholder when no action is selected.
 */
export const noneActionSchema = Primitive.Struct({
  type: Primitive.Literal("none").required(),
});

/**
 * Set Variable action - sets a local variable to a new value.
 * Supports both literal values and variable references.
 */
export const setVariableActionSchema = Primitive.Struct({
  type: Primitive.Literal("set-variable").required(),
  payload: Primitive.Struct({
    variableId: Primitive.String().required(),
    newValue: actionValueSourceSchema.required(),
  }).required(),
});

/**
 * Close Paywall action - closes the paywall.
 */
export const closePaywallActionSchema = Primitive.Struct({
  type: Primitive.Literal("close-paywall").required(),
});

/**
 * Purchase Product action - initiates a product purchase.
 * Supports both literal product IDs and product variable references.
 */
export const purchaseProductActionSchema = Primitive.Struct({
  type: Primitive.Literal("purchase-product").required(),
  payload: productSourceSchema.required(),
});

/**
 * Union of all action types.
 */
export const actionSchema = Primitive.Union({
  "close-paywall": closePaywallActionSchema,
  none: noneActionSchema,
  "purchase-product": purchaseProductActionSchema,
  "set-variable": setVariableActionSchema,
});

// =============================================================================
// Interaction
// =============================================================================

/**
 * An interaction combines a trigger with an action.
 */
export const interactionSchema = Primitive.Struct({
  id: Primitive.String().required(),
  trigger: triggerSchema.required(),
  action: actionSchema.required(),
});

/**
 * Array of interactions for a node.
 */
export const interactionsSchema = Primitive.Array(interactionSchema).default([]);
