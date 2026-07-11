import type {
  ActionCallbacks,
  Interaction,
  NodeState,
  VariableValue,
} from "@voidhash/paywall-renderer-web-core";
import { executeAction, resolveActionOverride } from "@voidhash/paywall-renderer-web-core";
import { useCallback, useMemo } from "preact/hooks";

import { usePaywallContext } from "../context/paywall-context";

export function useInteractions(
  nodeId: string,
  interactions: ReadonlyArray<{ id?: string; value: Interaction | undefined }>,
  states: ReadonlyArray<{ value: NodeState }>,
): (() => void) | undefined {
  const { getNodeVariables, setNodeVariable, callbacks } = usePaywallContext();
  const variables = getNodeVariables(nodeId);

  // Wrap onSetVariable to capture this node's ID
  const scopedCallbacks = useMemo<ActionCallbacks>(
    () => ({
      ...callbacks,
      onSetVariable: (variableId: string, newValue: VariableValue) => {
        setNodeVariable(nodeId, variableId, newValue);
      },
    }),
    [callbacks, nodeId, setNodeVariable],
  );

  const clickInteractions = useMemo(
    () => interactions.filter((entry) => entry.value?.trigger?.type === "click"),
    [interactions],
  );

  const handleClick = useCallback(() => {
    for (const entry of clickInteractions) {
      const interaction = entry.value;
      if (!interaction?.action) {
        continue;
      }
      // Action overrides are keyed by interaction array entry ID in snapshots.
      const interactionIdForOverrides = entry.id ?? interaction.id;
      if (!interactionIdForOverrides) {
        continue;
      }
      const overriddenAction = resolveActionOverride(interactionIdForOverrides, states, variables);
      const action = overriddenAction ?? interaction.action;
      executeAction(action, variables, scopedCallbacks);
    }
  }, [clickInteractions, states, variables, scopedCallbacks]);

  if (clickInteractions.length === 0) {
    return undefined;
  }

  return handleClick;
}
