'use client';

import type {
  BooleanVariableType,
  FlexNodeData,
  ScreenNodeData,
  TextNodeData,
  VariableType,
  VariableTypeKey
} from '@voidhash/mimic-schema';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@voidhash/ui';
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
import {
  PanelToggleGroup,
  PanelToggleGroupItem
} from '@/features/designer/components/toggle-group';
import { NodeTextInput } from '../inputs/text-input';
import { AddVariableModal } from './add-variable-modal';

type NodeWithVariables = FlexNodeData | ScreenNodeData | TextNodeData;

export interface VariablesSectionProps {
  node: NodeWithVariables;
  onAddVariable: (nodeId: string, type: VariableTypeKey, name: string) => void;
  onRemoveVariable: (nodeId: string, variableId: string) => void;
  onUpdateVariable: (
    nodeId: string,
    variableId: string,
    updates: { newName?: string; newValue?: VariableType }
  ) => void;
}

export function VariablesSection({
  node,
  onAddVariable,
  onRemoveVariable,
  onUpdateVariable
}: VariablesSectionProps) {
  const variables = node.localVariables ?? [];
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<VariableTypeKey | null>(
    null
  );

  const handleTypeSelect = (type: VariableTypeKey) => {
    setSelectedType(type);
    setIsModalOpen(true);
  };

  const handleAddVariable = (name: string) => {
    if (!selectedType) {
      return;
    }

    onAddVariable(node.id, selectedType, name);
    setSelectedType(null);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedType(null);
  };

  const handleRemoveVariable = (variableId: string) => {
    onRemoveVariable(node.id, variableId);
  };

  const handleUpdateVariableName = (variableId: string, newName: string) => {
    onUpdateVariable(node.id, variableId, { newName });
  };

  const handleUpdateVariableValue = (
    variableId: string,
    value: VariableType
  ) => {
    onUpdateVariable(node.id, variableId, { newValue: value });
  };

  return (
    <PanelSection>
      <PanelSectionHeader>
        <PanelSectionTitle>Variables</PanelSectionTitle>
        <PanelSectionHeaderActions>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <PanelButton icon={<PlusIcon />} size="icon" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleTypeSelect('string')}>
                Text
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleTypeSelect('number')}>
                Number
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleTypeSelect('boolean')}>
                Boolean (True / False)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleTypeSelect('product')}>
                Product
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {selectedType && (
            <AddVariableModal
              existingVariableNames={variables.map((v) => v.value.name)}
              onAdd={handleAddVariable}
              onClose={handleModalClose}
              open={isModalOpen}
              type={selectedType}
            />
          )}
        </PanelSectionHeaderActions>
      </PanelSectionHeader>
      {variables.length > 0 && (
        <PanelSectionContent>
          <div className="flex flex-col gap-2">
            {variables.map((variable) => {
              const varType = variable.value.value.key;
              return (
                <div className="flex flex-row gap-2" key={variable.id}>
                  <div className="flex flex-1 flex-row gap-2">
                    <NodeTextInput
                      className="flex-1"
                      label="Name"
                      node={variable.value}
                      onNodeChange={(updatedVar) =>
                        handleUpdateVariableName(variable.id, updatedVar.name)
                      }
                      property="name"
                    />
                    {varType === 'string' && (
                      <NodeTextInput
                        className="flex-1"
                        label="Value"
                        node={variable.value.value}
                        onNodeChange={(updatedVar) =>
                          handleUpdateVariableValue(variable.id, updatedVar)
                        }
                        property="value"
                      />
                    )}
                    {varType === 'number' && (
                      <NodeTextInput
                        className="flex-1"
                        label="Value"
                        node={variable.value.value}
                        onNodeChange={(updatedVar) =>
                          handleUpdateVariableValue(variable.id, updatedVar)
                        }
                        property="value"
                        stringToValue={(v) => Number(v) || 0}
                        type="number"
                        valueToString={(v) => String(v)}
                      />
                    )}
                    {varType === 'boolean' && (
                      <PanelToggleGroup
                        className="flex-1"
                        onValueChange={(value) =>
                          handleUpdateVariableValue(variable.id, {
                            key: 'boolean',
                            value: value === 'true'
                          } satisfies BooleanVariableType)
                        }
                        type="single"
                        value={variable.value.value ? 'true' : 'false'}
                      >
                        <PanelToggleGroupItem className="flex-1" value="true">
                          True
                        </PanelToggleGroupItem>
                        <PanelToggleGroupItem className="flex-1" value="false">
                          False
                        </PanelToggleGroupItem>
                      </PanelToggleGroup>
                    )}
                    {varType === 'product' && <div>TODO</div>}
                  </div>
                  <PanelButton
                    icon={<MinusIcon />}
                    onClick={() => handleRemoveVariable(variable.id)}
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
