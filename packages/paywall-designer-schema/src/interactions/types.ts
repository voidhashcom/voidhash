import type { Primitive } from "@voidhash/mimic";

import type {
	actionSchema,
	actionValueSchema,
	actionValueSourceSchema,
	clickTriggerSchema,
	closePaywallActionSchema,
	interactionSchema,
	noneActionSchema,
	productSourceSchema,
	purchaseProductActionSchema,
	setVariableActionSchema,
	triggerSchema,
} from "./interactions";

// Trigger types
export type Trigger = Primitive.InferState<typeof triggerSchema>;
export type ClickTrigger = Primitive.InferState<typeof clickTriggerSchema>;
export type TriggerType = Trigger["type"];

// Action types
export type Action = Primitive.InferState<typeof actionSchema>;
export type ActionSnapshot = Primitive.InferSnapshot<typeof actionSchema>;
export type NoneAction = Primitive.InferState<typeof noneActionSchema>;
export type SetVariableAction = Primitive.InferState<
	typeof setVariableActionSchema
>;
export type ClosePaywallAction = Primitive.InferState<
	typeof closePaywallActionSchema
>;
export type PurchaseProductAction = Primitive.InferState<
	typeof purchaseProductActionSchema
>;
export type ActionType = Action["type"];

// Value types
export type ActionValue = Primitive.InferState<typeof actionValueSchema>;
export type ActionValueSnapshot = Primitive.InferSnapshot<
	typeof actionValueSchema
>;
export type ActionValueSource = Primitive.InferState<
	typeof actionValueSourceSchema
>;
export type ActionValueSourceSnapshot = Primitive.InferSnapshot<
	typeof actionValueSourceSchema
>;
export type ProductSource = Primitive.InferState<typeof productSourceSchema>;
export type ProductSourceSnapshot = Primitive.InferSnapshot<
	typeof productSourceSchema
>;

// Interaction type
export type Interaction = Primitive.InferState<typeof interactionSchema>;
export type InteractionSnapshot = Primitive.InferSnapshot<
	typeof interactionSchema
>;
