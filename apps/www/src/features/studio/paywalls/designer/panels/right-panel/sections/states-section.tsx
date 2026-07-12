"use client";

import type {
  PathSnapshotNode,
  ScreenSnapshotNode,
  ScrollViewSnapshotNode,
  ShapeSnapshotNode,
  TextSnapshotNode,
  ViewSnapshotNode,
} from "@voidhash/paywall-renderer-web-core";
import { Button, cn } from "@voidhash/ui";
import { SettingsIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "zustand/react";

import { StateManagerSheet } from "@/features/studio/paywalls/designer/components/state-manager";
import type {
  CRDTState,
  CRDTVariable,
} from "@/features/studio/paywalls/designer/components/state-manager/types";
import {
  PanelSection,
  PanelSectionContent,
  PanelSectionHeader,
  PanelSectionHeaderActions,
  PanelSectionTitle,
} from "@/features/studio/paywalls/designer/components/ui/panel-section";
import {
  addNodeState,
  removeNodeState,
  setStateOverrideSelection,
  updateNodeState,
} from "@/features/studio/paywalls/designer/state/actions";
import {
  usePaywallDesignerActions,
  usePaywallDesignerStore,
} from "@/features/studio/paywalls/designer/state/designer-store";
import { collectAncestorVariables } from "@/features/studio/paywalls/designer/state/utils/ancestor-variables";
import { selectDocumentRoot } from "@/features/studio/paywalls/designer/state/utils/document-root";
import type { DnfInput } from "@/features/studio/paywalls/designer/state/utils/replay";
import { getSelectedStateIdForNode } from "@/features/studio/paywalls/designer/state/utils/state-overrides";

type NodeWithStates =
  | ViewSnapshotNode
  | ScrollViewSnapshotNode
  | ScreenSnapshotNode
  | TextSnapshotNode
  | ShapeSnapshotNode
  | PathSnapshotNode;

export interface StatesSectionProps {
  nodes: NodeWithStates[];
}

export const StatesSection = ({ nodes }: StatesSectionProps) => {
  const store = usePaywallDesignerStore();
  const node = nodes[0]!;
  const dispatch = usePaywallDesignerActions();
  const nodeType = node.type;
  const states: readonly CRDTState[] = node.data.states.flatMap((entry) =>
    entry.value === undefined ? [] : [{ id: entry.id, value: entry.value }],
  );
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const isSingleNodeSelection = nodes.length === 1;
  const stateOverrideSelection = useStore(store, (state) => state.stateOverrideSelection);
  const documentRoot = useStore(store, selectDocumentRoot);

  const variables = useMemo((): readonly CRDTVariable[] => {
    return collectAncestorVariables(documentRoot, node.id).map((variable) => ({
      id: variable.id,
      ownerLabel: variable.ownerNodeId === node.id ? undefined : variable.ownerName,
      value: { name: variable.name, value: variable.value },
    }));
  }, [documentRoot, node.id]);

  const selectedStateId = getSelectedStateIdForNode(stateOverrideSelection, node.id);

  useEffect(() => {
    if (!selectedStateId) {
      return;
    }
    const hasSelectedState = states.some((state) => state.id === selectedStateId);
    if (!hasSelectedState) {
      dispatch(setStateOverrideSelection)({
        nodeId: node.id,
        stateId: null,
      });
    }
  }, [dispatch, node.id, selectedStateId, states]);

  const handleAddState = (name: string, condition: DnfInput) => {
    dispatch(addNodeState)({ condition, name, nodeId: node.id, nodeType });
  };

  const handleRemoveState = (stateId: string) => {
    dispatch(removeNodeState)({ nodeId: node.id, nodeType, stateId });
  };

  const handleUpdateStateName = (stateId: string, newName: string) => {
    dispatch(updateNodeState)({ newName, nodeId: node.id, nodeType, stateId });
  };

  const handleUpdateStateCondition = (stateId: string, newCondition: DnfInput) => {
    dispatch(updateNodeState)({
      newCondition,
      nodeId: node.id,
      nodeType,
      stateId,
    });
  };

  const handleSelectDefault = () => {
    if (!isSingleNodeSelection) return;
    dispatch(setStateOverrideSelection)({
      nodeId: node.id,
      stateId: null,
    });
  };

  const handleSelectState = (stateId: string) => {
    if (!isSingleNodeSelection) return;
    dispatch(setStateOverrideSelection)({
      nodeId: node.id,
      stateId,
    });
  };

  return (
    <PanelSection>
      <PanelSectionHeader>
        <PanelSectionTitle>States</PanelSectionTitle>
        <PanelSectionHeaderActions>
          <Button onClick={() => setIsSheetOpen(true)} size="icon-sm" variant="secondary">
            <SettingsIcon />
          </Button>
        </PanelSectionHeaderActions>
      </PanelSectionHeader>
      {states.length > 0 && (
        <PanelSectionContent>
          <div className="flex flex-col">
            <button
              className={cn(
                "flex h-7 w-full items-center rounded-sm px-2 text-left font-medium text-xs",
                selectedStateId === null
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground",
                states.length > 0 && "rounded-b-none",
              )}
              disabled={!isSingleNodeSelection}
              onClick={handleSelectDefault}
              type="button"
            >
              Default
            </button>
            {states.map((state, index) => (
              <button
                className={cn(
                  "flex h-7 w-full items-center rounded-sm px-2 text-left font-medium text-xs",
                  selectedStateId === state.id
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground",
                  index === 0 && "rounded-t-none",
                )}
                disabled={!isSingleNodeSelection}
                key={state.id}
                onClick={() => handleSelectState(state.id)}
                type="button"
              >
                {state.value.name}
              </button>
            ))}
          </div>
        </PanelSectionContent>
      )}
      <StateManagerSheet
        onAddState={handleAddState}
        onOpenChange={setIsSheetOpen}
        onRemoveState={handleRemoveState}
        onUpdateStateCondition={handleUpdateStateCondition}
        onUpdateStateName={handleUpdateStateName}
        open={isSheetOpen}
        states={states}
        variables={variables}
      />
    </PanelSection>
  );
};
