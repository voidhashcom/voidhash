'use client';

import {
  type BooleanVariableType,
  booleanVariableTypeSchema,
  type FlexNodeData,
  numberVariableTypeSchema,
  productVariableTypeSchema,
  type ScreenNodeData,
  stringVariableTypeSchema,
  type TextNodeData,
  type Variable,
  type VariableType,
  type VariableTypeKey
} from '@voidhash/dff';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@voidhash/ui';
import { MinusIcon, PlusIcon } from 'lucide-react';
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

export interface VariablesSectionProps {
  node: NodeWithVariables;
  onNodeChange: (node: NodeWithVariables) => void;
}

const variableTypeKeySchemas = {
  string: stringVariableTypeSchema,
  number: numberVariableTypeSchema,
  boolean: booleanVariableTypeSchema,
  product: productVariableTypeSchema
};

export function VariablesSection({
  node,
  onNodeChange
}: VariablesSectionProps) {
  const variables = node.localVariables ?? [];

  const getDefaultValue = (type: VariableTypeKey): VariableType => {
    if (variableTypeKeySchemas[type]) {
      return variableTypeKeySchemas[type].getDefault();
    }
    throw new Error(`Invalid variable type: ${type}`);
  };

  const handleAddVariable = (type: VariableTypeKey) => {
    const newVariable: Variable = {
      name: `variable${variables.length + 1}`,
      value: getDefaultValue(type)
    };
    onNodeChange({
      ...node,
      localVariables: [...variables, newVariable]
    });
  };

  const handleRemoveVariable = (variableName: string) => {
    const newVariables = variables.filter((v) => v.name !== variableName);
    onNodeChange({
      ...node,
      localVariables: newVariables
    });
  };

  const handleUpdateVariableName = (oldName: string, newName: string) => {
    const newVariables = variables.map((v) =>
      v.name === oldName ? { ...v, name: newName } : v
    );
    onNodeChange({
      ...node,
      localVariables: newVariables
    });
  };

  const handleUpdateVariableValue = (
    variableName: string,
    value: VariableType
  ) => {
    const newVariables = variables.map((v) =>
      v.name === variableName ? { ...v, value } : v
    );
    onNodeChange({
      ...node,
      localVariables: newVariables
    });
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
              <DropdownMenuItem onClick={() => handleAddVariable('string')}>
                Text
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAddVariable('number')}>
                Number
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAddVariable('boolean')}>
                Boolean (True / False)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleAddVariable('product')}>
                Product
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </PanelSectionHeaderActions>
      </PanelSectionHeader>
      {variables.length > 0 && (
        <PanelSectionContent>
          <div className="flex flex-col gap-2">
            {variables.map((variable) => {
              const varType = variable.value.key;
              return (
                <div className="flex flex-row gap-2" key={variable.name}>
                  <div className="flex flex-1 flex-row gap-2">
                    <NodeTextInput
                      className="flex-1"
                      label="Name"
                      node={variable}
                      onNodeChange={(updatedVar) =>
                        handleUpdateVariableName(variable.name, updatedVar.name)
                      }
                      property="name"
                    />
                    {varType === 'string' && (
                      <NodeTextInput
                        className="flex-1"
                        label="Value"
                        node={variable.value}
                        onNodeChange={(updatedVar) =>
                          handleUpdateVariableValue(variable.name, updatedVar)
                        }
                        property="value"
                      />
                    )}
                    {varType === 'number' && (
                      <NodeTextInput
                        className="flex-1"
                        label="Value"
                        node={variable.value}
                        onNodeChange={(updatedVar) =>
                          handleUpdateVariableValue(variable.name, updatedVar)
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
                          handleUpdateVariableValue(variable.name, {
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
                    onClick={() => handleRemoveVariable(variable.name)}
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
