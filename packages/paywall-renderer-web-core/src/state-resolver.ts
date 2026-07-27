import type { Action, NodeState } from "./snapshot-types";
import { evaluateDNF } from "./evaluator";
import type { VariableReader } from "./variables";

export function resolveStyle<TStyle extends Record<string, unknown>>(
  baseStyle: TStyle,
  states: ReadonlyArray<{ value: NodeState }>,
  variables: VariableReader,
): TStyle {
  const merged = { ...baseStyle };

  for (const stateEntry of states) {
    const state = stateEntry.value;
    if (!state?.condition || !state.overrides) {
      continue;
    }
    if (evaluateDNF(state.condition, variables)) {
      const overrides = state.overrides.style as Record<string, unknown>;
      if (overrides) {
        for (const key of Object.keys(overrides)) {
          if (overrides[key] !== undefined) {
            (merged as Record<string, unknown>)[key] = overrides[key];
          }
        }
      }
    }
  }

  return merged;
}

export function resolveActionOverride(
  interactionId: string,
  states: ReadonlyArray<{ value: NodeState }>,
  variables: VariableReader,
): Action | undefined {
  let overriddenAction: Action | undefined;

  for (const stateEntry of states) {
    const state = stateEntry.value;
    if (!state?.condition || !state.overrides) {
      continue;
    }
    if (evaluateDNF(state.condition, variables)) {
      const actionOverrides = "actions" in state.overrides ? state.overrides.actions : undefined;
      if (actionOverrides) {
        for (const overrideCandidate of actionOverrides) {
          const override =
            "value" in overrideCandidate ? overrideCandidate.value : overrideCandidate;
          if (!override) {
            continue;
          }
          if (override.interactionId === interactionId) {
            overriddenAction = override.action;
          }
        }
      }
    }
  }

  return overriddenAction;
}
