import type { Primitive } from "@voidhash/mimic-core";

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
} from "./interactions.ts";

// Trigger types
export type Trigger = NonNullable<Primitive.InferSnapshot<typeof triggerSchema>>;
export type ClickTrigger = NonNullable<Primitive.InferSnapshot<typeof clickTriggerSchema>>;
export type TriggerType = Trigger["type"];

// Action types
export type Action = NonNullable<Primitive.InferSnapshot<typeof actionSchema>>;
export type ActionSnapshot = Action;
export type NoneAction = NonNullable<Primitive.InferSnapshot<typeof noneActionSchema>>;
export type SetVariableAction = NonNullable<
  Primitive.InferSnapshot<typeof setVariableActionSchema>
>;
export type ClosePaywallAction = NonNullable<
  Primitive.InferSnapshot<typeof closePaywallActionSchema>
>;
export type PurchaseProductAction = NonNullable<
  Primitive.InferSnapshot<typeof purchaseProductActionSchema>
>;
export type ActionType = Action["type"];

// Value types
export type ActionValue = NonNullable<Primitive.InferSnapshot<typeof actionValueSchema>>;
export type ActionValueSnapshot = ActionValue;
export type ActionValueSource = NonNullable<
  Primitive.InferSnapshot<typeof actionValueSourceSchema>
>;
export type ActionValueSourceSnapshot = ActionValueSource;
export type ProductSource = NonNullable<Primitive.InferSnapshot<typeof productSourceSchema>>;
export type ProductSourceSnapshot = ProductSource;

// Interaction type
export type Interaction = NonNullable<Primitive.InferSnapshot<typeof interactionSchema>>;
export type InteractionSnapshot = Interaction;
