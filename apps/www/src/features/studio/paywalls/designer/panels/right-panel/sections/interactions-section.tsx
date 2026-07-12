"use client";

import type { Action, Trigger } from "@voidhash/mimic-schema";
import type {
  ScrollViewSnapshotNode,
  ViewSnapshotNode,
} from "@voidhash/paywall-renderer-web-core";
import { PlusIcon } from "lucide-react";
import { useMemo } from "react";
import { useStore } from "zustand/react";

import { Button } from "@voidhash/ui";
import {
  PanelSection,
  PanelSectionContent,
  PanelSectionHeader,
  PanelSectionHeaderActions,
  PanelSectionTitle,
} from "@/features/studio/paywalls/designer/components/ui/panel-section";
import {
  addInteraction,
  removeInteraction,
  updateInteraction,
  updateInteractionActionOverride,
} from "@/features/studio/paywalls/designer/state/actions";
import {
  usePaywallDesignerActions,
  usePaywallDesignerStore,
} from "@/features/studio/paywalls/designer/state/designer-store";
import {
  collectAncestorVariables,
  toLabeledVariables,
} from "@/features/studio/paywalls/designer/state/utils/ancestor-variables";
import { selectDocumentRoot } from "@/features/studio/paywalls/designer/state/utils/document-root";
import {
  getSelectedStateIdForNode,
  resolveEffectiveAction,
} from "@/features/studio/paywalls/designer/state/utils/state-overrides";

import { InteractionRow } from "./interaction-row";

export interface InteractionsSectionProps {
  nodes: (ViewSnapshotNode | ScrollViewSnapshotNode)[];
}

export function InteractionsSection({ nodes }: InteractionsSectionProps) {
  const store = usePaywallDesignerStore();
  const node = nodes[0]!;
  const dispatch = usePaywallDesignerActions();
  const interactions = node.data.interactions.flatMap((entry) =>
    entry.value === undefined ? [] : [{ id: entry.id, value: entry.value }],
  );
  const documentRoot = useStore(store, selectDocumentRoot);
  const stateOverrideSelection = useStore(store, (state) => state.stateOverrideSelection);
  const selectedStateId = getSelectedStateIdForNode(stateOverrideSelection, node.id);

  const allVariables = useMemo(
    () => toLabeledVariables(collectAncestorVariables(documentRoot, node.id), node.id),
    [documentRoot, node.id],
  );

  const productVariables = useMemo(
    () => allVariables.filter((v) => v.value.key === "product"),
    [allVariables],
  );

  const handleAddInteraction = () => {
    dispatch(addInteraction)({ nodeId: node.id });
  };

  const handleRemoveInteraction = (interactionId: string) => {
    dispatch(removeInteraction)({ interactionId, nodeId: node.id });
  };

  const handleUpdateTrigger = (interactionId: string, newTrigger: Trigger) => {
    dispatch(updateInteraction)({ interactionId, newTrigger, nodeId: node.id });
  };

  const handleUpdateAction = (interactionId: string, newAction: Action) => {
    if (selectedStateId) {
      dispatch(updateInteractionActionOverride)({
        interactionId,
        newAction,
        nodeId: node.id,
        stateId: selectedStateId,
      });
      return;
    }
    dispatch(updateInteraction)({ interactionId, newAction, nodeId: node.id });
  };

  return (
    <PanelSection>
      <PanelSectionHeader>
        <PanelSectionTitle>Interactions</PanelSectionTitle>
        <PanelSectionHeaderActions>
          <Button onClick={handleAddInteraction} size="icon-sm" variant="secondary">
            <PlusIcon />
          </Button>
        </PanelSectionHeaderActions>
      </PanelSectionHeader>
      {interactions.length > 0 && (
        <PanelSectionContent>
          <div className="flex flex-col gap-3">
            {interactions.map((interaction) => (
              <InteractionRow
                allVariables={allVariables}
                interaction={{
                  ...interaction.value,
                  action: resolveEffectiveAction(
                    node,
                    selectedStateId,
                    interaction.id,
                    interaction.value.action,
                  ),
                }}
                key={interaction.id}
                onRemove={() => handleRemoveInteraction(interaction.id)}
                onUpdateAction={(action) => handleUpdateAction(interaction.id, action)}
                onUpdateTrigger={(trigger) => handleUpdateTrigger(interaction.id, trigger)}
                productVariables={productVariables}
              />
            ))}
          </div>
        </PanelSectionContent>
      )}
    </PanelSection>
  );
}
