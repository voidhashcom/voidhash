"use client";

import type { VariableType, VariableTypeKey } from "@voidhash/mimic-schema";
import type {
  PathSnapshotNode,
  ScreenSnapshotNode,
  ScrollViewSnapshotNode,
  ShapeSnapshotNode,
  TextSnapshotNode,
  ViewSnapshotNode,
} from "@voidhash/paywall-renderer-web-core";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@voidhash/ui";
import { PlusIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  PanelSection,
  PanelSectionContent,
  PanelSectionHeader,
  PanelSectionHeaderActions,
  PanelSectionTitle,
} from "@/features/studio/paywalls/designer/components/ui/panel-section";
import { VARIABLE_TYPE_REGISTRY } from "@/features/studio/paywalls/designer/constants";
import {
  addVariable,
  removeVariable,
  updateVariable,
} from "@/features/studio/paywalls/designer/state/actions";
import { usePaywallDesignerActions } from "@/features/studio/paywalls/designer/state/designer-store";

import { PendingVariableRow } from "./pending-variable-row";
import { VariableRow } from "./variable-row";

type NodeWithVariables =
  | ViewSnapshotNode
  | ScrollViewSnapshotNode
  | ScreenSnapshotNode
  | TextSnapshotNode
  | ShapeSnapshotNode
  | PathSnapshotNode;

interface PendingVariable {
  type: VariableTypeKey;
  name: string;
  value: VariableType;
}

export interface VariablesSectionProps {
  nodes: NodeWithVariables[];
}

export const VariablesSection = ({ nodes }: VariablesSectionProps) => {
  const node = nodes[0]!;
  const dispatch = usePaywallDesignerActions();
  const nodeType = node.type;
  const variables = node.data.localVariables.flatMap((entry) =>
    entry.value === undefined ? [] : [{ id: entry.id, value: entry.value }],
  );
  const existingVariableNames = new Set(variables.map((v) => v.value.name));

  const [openVariableId, setOpenVariableId] = useState<string | null>(null);
  const [pendingVariable, setPendingVariable] = useState<PendingVariable | null>(null);
  const [isPendingPopoverOpen, setIsPendingPopoverOpen] = useState(false);

  useEffect(() => {
    if (pendingVariable && !isPendingPopoverOpen) {
      const timer = setTimeout(() => {
        setIsPendingPopoverOpen(true);
      }, 200);
      return () => clearTimeout(timer);
    }
    if (!pendingVariable) {
      setIsPendingPopoverOpen(false);
    }
  }, [pendingVariable, isPendingPopoverOpen]);

  const handleStartAdding = useCallback((type: VariableTypeKey) => {
    const defaultValue = VARIABLE_TYPE_REGISTRY[type].defaultValue;
    setPendingVariable({ type, name: "", value: defaultValue });
    setIsPendingPopoverOpen(false);
    setOpenVariableId(null);
  }, []);

  const handlePendingNameChange = useCallback((name: string) => {
    setPendingVariable((prev) => (prev ? { ...prev, name } : null));
  }, []);

  const handlePendingValueChange = useCallback((value: VariableType) => {
    setPendingVariable((prev) => (prev ? { ...prev, value } : null));
  }, []);

  const handlePendingOpenChange = useCallback(
    (open: boolean) => {
      if (!open && isPendingPopoverOpen && pendingVariable) {
        const trimmedName = pendingVariable.name.trim();

        if (!trimmedName) {
          setPendingVariable(null);
          return;
        }

        if (trimmedName.length > 32) {
          toast.error("Variable name must be less than 32 characters");
          setPendingVariable(null);
          return;
        }

        if (existingVariableNames.has(trimmedName)) {
          toast.error("A variable with this name already exists");
          setPendingVariable(null);
          return;
        }

        dispatch(addVariable)({
          name: trimmedName,
          nodeId: node.id,
          nodeType,
          type: pendingVariable.type,
        });
        setPendingVariable(null);
      }
    },
    [isPendingPopoverOpen, pendingVariable, existingVariableNames, node.id, nodeType, dispatch],
  );

  const handleVariableOpenChange = useCallback((variableId: string, open: boolean) => {
    if (open) {
      setPendingVariable(null);
      setOpenVariableId(variableId);
    } else {
      setOpenVariableId(null);
    }
  }, []);

  const handleRemoveVariable = (variableId: string) => {
    dispatch(removeVariable)({ nodeId: node.id, nodeType, variableId });
  };

  const handleUpdateVariableName = (variableId: string, newName: string) => {
    dispatch(updateVariable)({
      newName,
      nodeId: node.id,
      nodeType,
      variableId,
    });
  };

  const handleUpdateVariableValue = (variableId: string, value: VariableType) => {
    dispatch(updateVariable)({
      newValue: value,
      nodeId: node.id,
      nodeType,
      variableId,
    });
  };

  return (
    <PanelSection>
      <PanelSectionHeader>
        <PanelSectionTitle>Variables</PanelSectionTitle>
        <PanelSectionHeaderActions>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon-sm" variant="secondary">
                <PlusIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleStartAdding("string")}>Text</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStartAdding("number")}>
                Number
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStartAdding("boolean")}>
                Boolean (True / False)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleStartAdding("product")}>
                Product
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </PanelSectionHeaderActions>
      </PanelSectionHeader>
      {(variables.length > 0 || pendingVariable) && (
        <PanelSectionContent>
          <div className="flex flex-col gap-2">
            {variables.map((variable) => (
              <VariableRow
                isOpen={openVariableId === variable.id}
                key={variable.id}
                onOpenChange={(open) => handleVariableOpenChange(variable.id, open)}
                onRemove={() => handleRemoveVariable(variable.id)}
                onUpdateName={(newName) => handleUpdateVariableName(variable.id, newName)}
                onUpdateValue={(newValue) => handleUpdateVariableValue(variable.id, newValue)}
                variable={variable.value}
              />
            ))}
            {pendingVariable && (
              <PendingVariableRow
                isOpen={isPendingPopoverOpen}
                onOpenChange={handlePendingOpenChange}
                onRemove={() => setPendingVariable(null)}
                onUpdateName={handlePendingNameChange}
                onUpdateValue={handlePendingValueChange}
                pendingVariable={pendingVariable}
              />
            )}
          </div>
        </PanelSectionContent>
      )}
    </PanelSection>
  );
};
