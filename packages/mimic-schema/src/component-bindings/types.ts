import type { Primitive } from "@voidhash/mimic-core";

import type {
  componentActionValueSourceSchema,
  componentBoundActionSchema,
  componentProductSourceSchema,
  componentPropBindingSchema,
  componentPropValueSchema,
} from "./component-bindings.ts";

// Prop value types
export type ComponentPropValue = NonNullable<
  Primitive.InferSnapshot<typeof componentPropValueSchema>
>;

// Prop binding types
export type ComponentPropBinding = NonNullable<
  Primitive.InferSnapshot<typeof componentPropBindingSchema>
>;

// Action value source types
export type ComponentActionValueSource = NonNullable<
  Primitive.InferSnapshot<typeof componentActionValueSourceSchema>
>;

// Product source types
export type ComponentProductSource = NonNullable<
  Primitive.InferSnapshot<typeof componentProductSourceSchema>
>;

// Bound action types
export type ComponentBoundAction = NonNullable<
  Primitive.InferSnapshot<typeof componentBoundActionSchema>
>;
export type ComponentBoundActionType = ComponentBoundAction["type"];
