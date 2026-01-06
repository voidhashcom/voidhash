"use client";

import type {
  DNF,
  FlexNodeData,
  ScreenNodeData,
  TextNodeData,
} from "@voidhash/mimic-schema";
import { SettingsIcon } from "lucide-react";
import { useState } from "react";

import { PanelButton } from "@/features/designer/components/button";
import {
  PanelSection,
  PanelSectionContent,
  PanelSectionHeader,
  PanelSectionHeaderActions,
  PanelSectionTitle,
} from "@/features/designer/components/panel-section";

import { StateManagerSheet } from "./state-manager-sheet";

type NodeWithStates = FlexNodeData | ScreenNodeData | TextNodeData;

export interface StatesSectionProps {
  node: NodeWithStates;
  onAddState: (nodeId: string, name: string, condition: DNF) => void;
  onRemoveState: (nodeId: string, stateId: string) => void;
  onUpdateState: (
    nodeId: string,
    stateId: string,
    updates: {
      newName?: string;
      newCondition?: DNF;
    }
  ) => void;
}

export const StatesSection = ({
  node,
  onAddState,
  onRemoveState,
  onUpdateState,
}: StatesSectionProps) => {
  const states = node.states ?? [];
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const handleAddState = (name: string, condition: DNF) => {
    onAddState(node.id, name, condition);
  };

  const handleRemoveState = (stateId: string) => {
    onRemoveState(node.id, stateId);
  };

  const handleUpdateStateName = (stateId: string, newName: string) => {
    onUpdateState(node.id, stateId, { newName });
  };

  return (
    <PanelSection>
      <PanelSectionHeader>
        <PanelSectionTitle>States</PanelSectionTitle>
        <PanelSectionHeaderActions>
          <PanelButton
            icon={<SettingsIcon />}
            onClick={() => setIsSheetOpen(true)}
            size="icon"
            variant="ghost"
          />
        </PanelSectionHeaderActions>
      </PanelSectionHeader>
      {states.length > 0 && (
        <PanelSectionContent>
          <div className="flex flex-col gap-1">
            <div className="rounded-md border px-2 py-1.5 text-sm">Default</div>
            {states.map((state) => (
              <div
                className="rounded-md border px-2 py-1.5 text-sm"
                key={state.id}
              >
                {state.value.name}
              </div>
            ))}
          </div>
        </PanelSectionContent>
      )}
      <StateManagerSheet
        onAddState={handleAddState}
        onOpenChange={setIsSheetOpen}
        onRemoveState={handleRemoveState}
        onUpdateStateName={handleUpdateStateName}
        open={isSheetOpen}
        states={states}
      />
    </PanelSection>
  );
};
