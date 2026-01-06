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
import { InputGroup, InputGroupInput } from '@voidhash/ui/input-group';
import { MinusIcon, PlusIcon } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';

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

type NodeWithVariables = FlexNodeData | ScreenNodeData | TextNodeData;

interface PendingVariable {
  name: string;
  type: VariableTypeKey;
}

interface UsePendingVariableOptions {
  existingVariableNames: Set<string>;
  nodeId: string;
  onAddVariable: (nodeId: string, type: VariableTypeKey, name: string) => void;
}

const usePendingVariable = ({
  existingVariableNames,
  nodeId,
  onAddVariable
}: UsePendingVariableOptions) => {
  const [pendingVariable, setPendingVariable] =
    useState<PendingVariable | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const startAdding = useCallback((type: VariableTypeKey) => {
    setPendingVariable({ name: '', type });
    // Use setTimeout to ensure the input is rendered before focusing
    // This handles the timing issue when the dropdown menu closes
    setTimeout(() => {
      inputRef.current?.focus();
    }, 200);
  }, []);

  const cancel = useCallback(() => {
    setPendingVariable(null);
  }, []);

  const save = useCallback(() => {
    if (!pendingVariable) {
      return;
    }

    const trimmedName = pendingVariable.name.trim();

    // Silent cancellation for empty names
    if (!trimmedName) {
      setPendingVariable(null);
      return;
    }

    // Validate max length
    if (trimmedName.length > 32) {
      toast.error('Variable name must be less than 32 characters');
      setPendingVariable(null);
      return;
    }

    // Validate uniqueness
    if (existingVariableNames.has(trimmedName)) {
      toast.error('A variable with this name already exists');
      setPendingVariable(null);
      return;
    }

    onAddVariable(nodeId, pendingVariable.type, trimmedName);
    setPendingVariable(null);
  }, [pendingVariable, existingVariableNames, nodeId, onAddVariable]);

  const updateName = useCallback((name: string) => {
    setPendingVariable((prev) => (prev ? { ...prev, name } : null));
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        cancel();
      } else if (e.key === 'Enter') {
        save();
      }
    },
    [cancel, save]
  );

  return {
    cancel,
    handleKeyDown,
    inputRef,
    pendingVariable,
    save,
    startAdding,
    updateName
  };
};

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

export const VariablesSection = ({
  node,
  onAddVariable,
  onRemoveVariable,
  onUpdateVariable
}: VariablesSectionProps) => {
  const variables = node.localVariables ?? [];
  const existingVariableNames = new Set(variables.map((v) => v.value.name));

  const {
    cancel,
    handleKeyDown,
    inputRef,
    pendingVariable,
    save,
    startAdding,
    updateName
  } = usePendingVariable({
    existingVariableNames,
    nodeId: node.id,
    onAddVariable
  });

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
              <DropdownMenuItem onClick={() => startAdding('string')}>
                Text
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => startAdding('number')}>
                Number
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => startAdding('boolean')}>
                Boolean (True / False)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => startAdding('product')}>
                Product
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </PanelSectionHeaderActions>
      </PanelSectionHeader>
      {(variables.length > 0 || pendingVariable) && (
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
            {pendingVariable && (
              <div className="flex flex-row gap-2">
                <div className="flex flex-1 flex-row gap-2">
                  <InputGroup className="h-7 flex-1 rounded-sm border-none dark:bg-input/60">
                    <InputGroupInput
                      aria-label="Variable name"
                      className="h-7 px-1 py-0 pl-2 text-xs"
                      onBlur={save}
                      onChange={(e) => updateName(e.target.value)}
                      onKeyDown={handleKeyDown}
                      ref={inputRef}
                      value={pendingVariable.name}
                    />
                  </InputGroup>
                </div>
                <PanelButton
                  icon={<MinusIcon />}
                  onClick={cancel}
                  size="icon"
                />
              </div>
            )}
          </div>
        </PanelSectionContent>
      )}
    </PanelSection>
  );
};
