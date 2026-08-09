"use client";

/**
 * Built-in panel definition for state selection and state-manager access.
 *
 * Structure (old JSX → wire nodes):
 * - `PanelSection` + header "States" → `Panel.Section title="States"`.
 * - A header `Settings` button (old `PanelSectionHeaderActions` > `Button`) →
 *   `Panel.SectionActions` > `Panel.Button icon="settings"`; its `onClick` opens
 *   the host State Manager sheet via `usePanelHostServices().openStateManager`
 *   (the sheet itself stays host-rendered in {@link ../panel-host-services-host}).
 * - When the node has states, a vertical "Default" + one-per-state selector →
 *   a `Panel.Column` of `Panel.Button`s. The selected entry renders `variant`
 *   `default` (the old accent highlight), the rest `ghost`; every button is
 *   `disabled` unless the selection is a single node (old
 *   `disabled={!isSingleNodeSelection}`).
 *
 * Behavior (identical to the old section):
 * - Selecting "Default" writes `setStateOverrideSelection({nodeId, stateId:null})`;
 *   selecting a state writes `{nodeId, stateId}` — both no-ops unless single-node.
 * - A stale-selection cleanup effect clears `stateOverrideSelection` when the
 *   selected state id no longer exists on the node (same condition, same dispatch).
 * - `setStateOverrideSelection` is a plain (non-undoable) commander action, so
 *   selecting a state never touches the undo stack — matching the old section.
 */
import type { PanelContext } from "@voidhash/paywalls/panel";
import { Panel } from "@voidhash/paywalls/panel";
import { useEffect } from "react";
import { useStore } from "zustand/react";

import { setStateOverrideSelection } from "../../../state/actions";
import { usePaywallDesignerActions, usePaywallDesignerStore } from "../../../state/designer-store";
import { getSelectedStateIdForNode } from "../../../state/utils/state-overrides";
import { usePanelHostServices } from "../../../panel-runtime/panel-host-services";
import { useDefinitionNodes } from "./use-definition-nodes";
import { useDefinitionSelection } from "./definition-selection";

/** A node state's array-entry id + its decoded `{ name }` value. */
interface NodeState {
  readonly id: string;
  readonly value: { readonly name: string };
}

/** Reads a stateful node's decoded state entries (unwrapping the `{id,value}` envelope). */
function readStates(node: unknown): NodeState[] {
  const states = (node as { data?: { states?: readonly unknown[] } }).data?.states;
  if (!Array.isArray(states)) return [];
  return states.flatMap((entry) => {
    const e = entry as { id?: string; value?: { name?: string } };
    if (e.value === undefined || typeof e.id !== "string") return [];
    return [{ id: e.id, value: { name: e.value.name ?? "" } }];
  });
}

/** The `States` panel definition. */
export function StatesPanel(_ctx: PanelContext) {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const services = usePanelHostServices();
  const { nodes } = useDefinitionNodes();
  const { nodeIds } = useDefinitionSelection();
  const stateOverrideSelection = useStore(store, (state) => state.stateOverrideSelection);

  const node = nodes[0];
  const nodeId = node?.id ?? "";
  const states = node ? readStates(node) : [];
  const selectedStateId = getSelectedStateIdForNode(stateOverrideSelection, nodeId);
  const isSingleNodeSelection = nodeIds.length === 1;

  // Stale-selection cleanup: clear the override selection when the selected state
  // id no longer exists on the node — verbatim from the old section's effect.
  useEffect(() => {
    if (!node || !selectedStateId) return;
    const hasSelectedState = states.some((state) => state.id === selectedStateId);
    if (!hasSelectedState) {
      dispatch(setStateOverrideSelection)({ nodeId, stateId: null });
    }
  }, [dispatch, node, nodeId, selectedStateId, states]);

  if (!node) return null;

  const selectDefault = () => {
    if (!isSingleNodeSelection) return;
    dispatch(setStateOverrideSelection)({ nodeId, stateId: null });
  };
  const selectState = (stateId: string) => {
    if (!isSingleNodeSelection) return;
    dispatch(setStateOverrideSelection)({ nodeId, stateId });
  };

  return (
    <Panel>
      <Panel.Section title="States">
        <Panel.SectionActions>
          <Panel.Button
            icon="settings"
            size="icon-sm"
            onClick={() => services.openStateManager(nodeId)}
          />
        </Panel.SectionActions>
        {states.length > 0 && (
          <Panel.Column gap="none">
            <Panel.Button
              label="Default"
              size="sm"
              variant={selectedStateId === null ? "default" : "ghost"}
              disabled={!isSingleNodeSelection}
              onClick={selectDefault}
            />
            {states.map((state) => (
              <Panel.Button
                key={state.id}
                label={state.value.name}
                size="sm"
                variant={selectedStateId === state.id ? "default" : "ghost"}
                disabled={!isSingleNodeSelection}
                onClick={() => selectState(state.id)}
              />
            ))}
          </Panel.Column>
        )}
      </Panel.Section>
    </Panel>
  );
}
