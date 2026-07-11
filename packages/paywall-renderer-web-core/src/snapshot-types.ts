import type {
  Action,
  ActionOverride,
  ActionValueSource,
  ComponentActionValueSource,
  ComponentBoundAction,
  ComponentProductSource,
  ComponentPropBinding,
  ComponentPropValue,
  ConjunctionSnapshot,
  DNFSnapshot,
  Interaction,
  OperandSnapshot,
  PathNodeData,
  PredicateSnapshot,
  ProductSource,
  ScreenNodeData,
  ShapeNodeData,
  TextNodeData,
  Variable,
  VariableType,
  VariableTypeKey,
  ViewNodeData,
} from "@voidhash/mimic-schema";

export type {
  Action,
  ActionOverride,
  ActionValueSource,
  ComponentActionValueSource,
  ComponentBoundAction,
  ComponentProductSource,
  ComponentPropBinding,
  ComponentPropValue,
  Interaction,
  ProductSource,
  Variable,
  VariableTypeKey as VariableValueKey,
};

export type Conjunction = NonNullable<ConjunctionSnapshot>;
export type DNF = NonNullable<DNFSnapshot>;
export type NodeState =
  | ViewNodeData["data"]["states"][number]["value"]
  | PathNodeData["data"]["states"][number]["value"]
  | ScreenNodeData["data"]["states"][number]["value"]
  | ShapeNodeData["data"]["states"][number]["value"]
  | TextNodeData["data"]["states"][number]["value"];
export type Operand = NonNullable<OperandSnapshot>;
export type Predicate = NonNullable<PredicateSnapshot>;
export type VariableValue = VariableType;

export type PredicateType = Predicate["type"];
