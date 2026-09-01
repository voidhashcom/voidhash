import type {
  ActionCallbacks,
  Interaction,
  NodeState,
  VariableValue,
} from "@voidhash/paywall-renderer-web-core";
import { executeAction, resolveActionOverride } from "@voidhash/paywall-renderer-web-core";
import * as Arr from "effect/Array";

import { usePaywallContext } from "../context/paywall-context";

export function useInteractions(
  nodeId: string,
  interactions: ReadonlyArray<{ id?: string; value?: Interaction }>,
  states: ReadonlyArray<{ value: NodeState }>,
) {
  const { getNodeVariables, setNodeVariable, callbacks } = usePaywallContext();
  const variables = getNodeVariables(nodeId);

  // Wrap onSetVariable to capture this node's ID
  const scopedCallbacks: ActionCallbacks = {
      ...callbacks,
      onSetVariable: (variableId: string, newValue: VariableValue) => {
        setNodeVariable(nodeId, variableId, newValue);
      },
    };

  const clickInteractions = interactions.filter((entry) => entry.value?.trigger?.type === "click");

  const handleClick = () => {
    clickInteractions.forEach((entry) => {
      const interaction = entry.value;
      if (!interaction?.action) {
        return;
      }
      // Action overrides are keyed by interaction array entry ID in snapshots.
      const interactionIdForOverrides = entry.id ?? interaction.id;
      if (!interactionIdForOverrides) {
        return;
      }
      const overriddenAction = resolveActionOverride(interactionIdForOverrides, states, variables);
      const action = overriddenAction ?? interaction.action;
      executeAction(action, variables, scopedCallbacks);
    });
  };

  if (Arr.isReadonlyArrayEmpty(clickInteractions)) {
    return undefined;
  }

  return handleClick;
}
