import { Primitive } from "@voidhash/mimic";

// =============================================================================
// Triggers
// =============================================================================

/**
 * Click trigger - fires when the element is clicked/tapped.
 * Simple trigger with no configuration needed.
 */
export const clickTriggerSchema = Primitive.Struct({
	type: Primitive.Literal("click"),
});

/**
 * Union of all trigger types.
 * Extensible for future triggers (hover, long-press, etc.)
 */
export const triggerSchema = Primitive.Union({
	discriminator: "type",
	variants: {
		click: clickTriggerSchema,
	},
});

// =============================================================================
// Action Value Types
// =============================================================================

/**
 * Value types for the set-variable action.
 * Matches the variable types format (using "key" discriminator, including product).
 */
export const actionValueSchema = Primitive.Union({
	discriminator: "key",
	variants: {
		boolean: Primitive.Struct({
			key: Primitive.Literal("boolean"),
			value: Primitive.Boolean(),
		}),
		number: Primitive.Struct({
			key: Primitive.Literal("number"),
			value: Primitive.Number(),
		}),
		string: Primitive.Struct({
			key: Primitive.Literal("string"),
			value: Primitive.String(),
		}),
		product: Primitive.Struct({
			key: Primitive.Literal("product"),
			value: Primitive.Struct({
				productId: Primitive.Either(
					Primitive.String(),
					Primitive.Literal(null),
				),
			}),
		}),
	},
});

/**
 * Source for an action value - either a literal value or a reference to a variable.
 */
export const actionValueSourceSchema = Primitive.Union({
	discriminator: "type",
	variants: {
		literal: Primitive.Struct({
			type: Primitive.Literal("literal"),
			value: actionValueSchema,
		}),
		"variable-reference": Primitive.Struct({
			type: Primitive.Literal("variable-reference"),
			value: Primitive.Struct({
				id: Primitive.String(),
			}),
		}),
	},
});

/**
 * Source for a product - either a literal product ID or a reference to a product variable.
 */
export const productSourceSchema = Primitive.Union({
	discriminator: "type",
	variants: {
		literal: Primitive.Struct({
			type: Primitive.Literal("literal"),
			productId: Primitive.String(),
		}),
		"variable-reference": Primitive.Struct({
			type: Primitive.Literal("variable-reference"),
			variableId: Primitive.String(),
		}),
	},
});

// =============================================================================
// Actions
// =============================================================================

/**
 * None action - placeholder when no action is selected.
 */
export const noneActionSchema = Primitive.Struct({
	type: Primitive.Literal("none"),
});

/**
 * Set Variable action - sets a local variable to a new value.
 * Supports both literal values and variable references.
 */
export const setVariableActionSchema = Primitive.Struct({
	type: Primitive.Literal("set-variable"),
	payload: Primitive.Struct({
		variableId: Primitive.String(),
		newValue: actionValueSourceSchema,
	}),
});

/**
 * Close Paywall action - closes the paywall.
 */
export const closePaywallActionSchema = Primitive.Struct({
	type: Primitive.Literal("close-paywall"),
});

/**
 * Purchase Product action - initiates a product purchase.
 * Supports both literal product IDs and product variable references.
 */
export const purchaseProductActionSchema = Primitive.Struct({
	type: Primitive.Literal("purchase-product"),
	payload: productSourceSchema,
});

/**
 * Union of all action types.
 */
export const actionSchema = Primitive.Union({
	discriminator: "type",
	variants: {
		"close-paywall": closePaywallActionSchema,
		none: noneActionSchema,
		"purchase-product": purchaseProductActionSchema,
		"set-variable": setVariableActionSchema,
	},
});

// =============================================================================
// Interaction
// =============================================================================

/**
 * An interaction combines a trigger with an action.
 */
export const interactionSchema = Primitive.Struct({
	id: Primitive.String(),
	trigger: triggerSchema,
	action: actionSchema,
});

/**
 * Array of interactions for a node.
 */
export const interactionsSchema = Primitive.Array(interactionSchema).default(
	[],
);
