"use client";

/**
 * Built-in panel definition for node interactions and action editing.
 *
 * Structure (old JSX → wire nodes):
 * - `PanelSection` + header "Interactions" → `Panel.Section title="Interactions"`,
 *   with a `+` add `Panel.Button` in `Panel.SectionActions`.
 * - Each interaction → a `Panel.Row` with a controlled `Panel.Popover` (open when
 *   `openInteractionId === id`) over a trigger `Panel.SelectField` (the single
 *   "On click" option) + a `Panel.ActionEditorField`, plus a `−` remove
 *   `Panel.Button`.
 *
 * State-aware action resolution (identical to the old section):
 * - The editor's `value` is the EFFECTIVE action:
 *   `resolveEffectiveAction(node, selectedStateId, interaction.id, base)` — the
 *   state override wins when a state is selected.
 * - The editor's variable lists come from
 *   `toLabeledVariables(collectAncestorVariables(root, nodeId))`; `productVariables`
 *   is the `product`-typed subset. `payloadFields` is NOT passed (interactions
 *   never offer action-payload sources).
 * - `onChange` narrows the component-bound action back to the visual `Action`
 *   vocabulary via {@link toVisualAction} (dropping action-payload sources); if a
 *   state is selected it writes `updateInteractionActionOverride`, else
 *   `updateInteraction` — exact old branching. Add/remove use the old payloads.
 */
import type { Action, ComponentBoundAction, Trigger, TriggerType } from "@voidhash/mimic-schema";
import type { ScrollViewSnapshotNode, ViewSnapshotNode } from "@voidhash/paywall-renderer-web-core";
import type { PanelContext } from "@voidhash/paywalls/panel";
import { Panel } from "@voidhash/paywalls/panel";
import type { PanelJsonValue } from "@voidhash/paywalls/schema";
import { useMemo, useState } from "react";
import { useStore } from "zustand/react";

import {
  addInteraction,
  removeInteraction,
  updateInteraction,
  updateInteractionActionOverride,
} from "../../../state/actions";
import { usePaywallDesignerActions, usePaywallDesignerStore } from "../../../state/designer-store";
import {
  collectAncestorVariables,
  toLabeledVariables,
} from "../../../state/utils/ancestor-variables";
import { selectDocumentRoot } from "../../../state/utils/document-root";
import {
  getSelectedStateIdForNode,
  resolveEffectiveAction,
} from "../../../state/utils/state-overrides";
import { ACTION_TYPE_LABELS } from "../../../panel-kit/action-editor";
import { useDefinitionNodes } from "./use-definition-nodes";

/** A decoded interaction: its array-entry id + `{ trigger, action }`. */
interface Interaction {
  readonly id: string;
  readonly value: { readonly trigger: Trigger; readonly action: Action };
}

const TRIGGER_LABELS: Record<TriggerType, string> = { click: "On click" };

/**
 * Narrows a component-bound action back to the visual interaction `Action`
 * vocabulary. Returns `null` for action-payload sources, which interactions
 * cannot store (verbatim from the old `InteractionRow`).
 */
function toVisualAction(action: ComponentBoundAction): Action | null {
  switch (action.type) {
    case "none":
      return { type: "none" };
    case "close-paywall":
      return { type: "close-paywall" };
    case "set-variable": {
      const source = action.payload.newValue;
      if (source.type === "action-payload") return null;
      return {
        payload: { newValue: source, variableId: action.payload.variableId },
        type: "set-variable",
      };
    }
    case "purchase-product": {
      if (action.payload.type === "action-payload") return null;
      return { payload: action.payload, type: "purchase-product" };
    }
  }
}

/** Unwraps `node.data.interactions` (`{id,value}` envelope) into decoded interactions. */
function readInteractions(node: unknown): Interaction[] {
  const raw = (node as { data?: { interactions?: readonly unknown[] } }).data?.interactions;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    const e = entry as { id?: string; value?: { trigger: Trigger; action: Action } };
    if (e.value === undefined || typeof e.id !== "string") return [];
    return [{ id: e.id, value: { trigger: e.value.trigger, action: e.value.action } }];
  });
}

/** The `Interactions` panel definition. */
export function InteractionsPanel(_ctx: PanelContext) {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const { nodes } = useDefinitionNodes();
  const documentRoot = useStore(store, selectDocumentRoot);
  const stateOverrideSelection = useStore(store, (state) => state.stateOverrideSelection);

  const node = nodes[0] as ViewSnapshotNode | ScrollViewSnapshotNode | undefined;
  const nodeId = node?.id ?? "";
  const interactions = node ? readInteractions(node) : [];
  const selectedStateId = getSelectedStateIdForNode(stateOverrideSelection, nodeId);

  const allVariables = useMemo(
    () => toLabeledVariables(collectAncestorVariables(documentRoot, nodeId), nodeId),
    [documentRoot, nodeId],
  );
  const productVariables = useMemo(
    () => allVariables.filter((v) => v.value.key === "product"),
    [allVariables],
  );

  const [openInteractionId, setOpenInteractionId] = useState<string | null>(null);

  const handleAction = (interactionId: string, action: ComponentBoundAction) => {
    const visualAction = toVisualAction(action);
    if (!visualAction) return;
    if (selectedStateId) {
      dispatch(updateInteractionActionOverride)({
        interactionId,
        newAction: visualAction,
        nodeId,
        stateId: selectedStateId,
      });
      return;
    }
    dispatch(updateInteraction)({ interactionId, newAction: visualAction, nodeId });
  };

  if (!node) return null;

  return (
    <Panel>
      <Panel.Section title="Interactions">
        <Panel.SectionActions>
          <Panel.Button
            icon="plus"
            size="icon-sm"
            onClick={() => dispatch(addInteraction)({ nodeId })}
          />
        </Panel.SectionActions>
        {interactions.length > 0 && (
          <Panel.Column gap="md">
            {interactions.map((interaction) => {
              const effectiveAction = resolveEffectiveAction(
                node,
                selectedStateId,
                interaction.id,
                interaction.value.action,
              );
              return (
                <Panel.Row key={interaction.id} align="center">
                  <Panel.Popover
                    open={openInteractionId === interaction.id}
                    onOpenChange={(open) => setOpenInteractionId(open ? interaction.id : null)}
                  >
                    <Panel.PopoverTrigger>
                      {/* No `variant` → the host defaults to the outlined trigger look. */}
                      <Panel.Button
                        hint={ACTION_TYPE_LABELS[effectiveAction.type]}
                        label={TRIGGER_LABELS[interaction.value.trigger.type]}
                        size="sm"
                        width="full"
                      />
                    </Panel.PopoverTrigger>
                    <Panel.PopoverContent
                      align="start"
                      side="left"
                      title="Interaction"
                      onClose={() => setOpenInteractionId(null)}
                    >
                      <Panel.Field label="Trigger">
                        <Panel.SelectField
                          options={[{ value: "click", label: "On click" }]}
                          value={interaction.value.trigger.type}
                          onChange={(next) =>
                            dispatch(updateInteraction)({
                              interactionId: interaction.id,
                              newTrigger: { type: next as TriggerType },
                              nodeId,
                            })
                          }
                        />
                      </Panel.Field>
                      <Panel.ActionEditorField
                        value={effectiveAction as unknown as PanelJsonValue}
                        variables={allVariables as unknown as PanelJsonValue}
                        productVariables={productVariables as unknown as PanelJsonValue}
                        onChange={(action) =>
                          handleAction(interaction.id, action as unknown as ComponentBoundAction)
                        }
                      />
                    </Panel.PopoverContent>
                  </Panel.Popover>
                  <Panel.Button
                    icon="minus"
                    size="icon-sm"
                    onClick={() =>
                      dispatch(removeInteraction)({ interactionId: interaction.id, nodeId })
                    }
                  />
                </Panel.Row>
              );
            })}
          </Panel.Column>
        )}
      </Panel.Section>
    </Panel>
  );
}
