'use client';

import type {
  DNF,
  FlexNodeData,
  ScreenNodeData,
  TextNodeData
} from '@voidhash/mimic-schema';
import { MinusIcon, PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { PanelButton } from '@/features/designer/components/button';
import {
  PanelSection,
  PanelSectionContent,
  PanelSectionHeader,
  PanelSectionHeaderActions,
  PanelSectionTitle
} from '@/features/designer/components/panel-section';
import { NodeTextInput } from '../inputs/text-input';
import { AddStateModal } from './add-state-modal';

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

export function StatesSection({
  node,
  onAddState,
  onRemoveState,
  onUpdateState
}: StatesSectionProps) {
  const states = node.states ?? [];
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleAddState = (name: string, condition: DNF) => {
    onAddState(node.id, name, condition);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
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
            icon={<PlusIcon />}
            onClick={() => setIsModalOpen(true)}
            size="icon"
          />
          {isModalOpen && (
            <AddStateModal
              existingStateNames={states.map((s) => s.value.name)}
              onAdd={handleAddState}
              onClose={handleModalClose}
              open={isModalOpen}
            />
          )}
        </PanelSectionHeaderActions>
      </PanelSectionHeader>
      {states.length > 0 && (
        <PanelSectionContent>
          <div className="flex flex-col gap-2">
            {states.map((state) => {
              return (
                <div className="flex flex-row gap-2" key={state.id}>
                  <div className="flex flex-1 flex-col gap-2">
                    <NodeTextInput
                      className="flex-1"
                      label="Name"
                      node={state.value}
                      onNodeChange={(updatedState) =>
                        handleUpdateStateName(state.id, updatedState.name)
                      }
                      property="name"
                    />
                    <div className="rounded-md border border-dashed p-2 text-muted-foreground text-xs">
                      Condition editor coming soon
                    </div>
                  </div>
                  <PanelButton
                    icon={<MinusIcon />}
                    onClick={() => handleRemoveState(state.id)}
                    size="icon"
                  />
                </div>
              );
            })}
          </div>
        </PanelSectionContent>
      )}
    </PanelSection>
  );
}
