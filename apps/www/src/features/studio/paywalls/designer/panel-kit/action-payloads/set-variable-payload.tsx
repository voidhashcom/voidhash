"use client";

import type {
  ComponentActionValueSource,
  ComponentBoundAction,
  VariableTypeKey,
} from "@voidhash/mimic-schema";
import { useMemo } from "react";

import { SelectInput } from "@/features/studio/paywalls/designer/components/ui/select-input";
import { VariableSelector } from "@/features/studio/paywalls/designer/components/variables/variable-selector";
import { VariableInput } from "@/features/studio/paywalls/designer/components/variables/variable-input";
import {
  findVariableByRef,
  isLiteralValue,
} from "@/features/studio/paywalls/designer/components/variables/types";
import type {
  LabeledVariable,
  VariableInputValue,
} from "@/features/studio/paywalls/designer/components/variables/types";
import { VARIABLE_TYPE_REGISTRY } from "@/features/studio/paywalls/designer/constants";

import { ActionPayloadSourceHint } from "./action-payload-source-hint";

type SetVariableBoundAction = Extract<ComponentBoundAction, { type: "set-variable" }>;

export interface SetVariablePayloadEditorProps {
  action: SetVariableBoundAction;
  onActionChange: (action: SetVariableBoundAction) => void;
  variables: readonly LabeledVariable[];
  /** Payload field names of the emitting component action; enables the "From action payload" value source. */
  payloadFields?: readonly string[];
}

export function SetVariablePayloadEditor({
  action,
  onActionChange,
  variables,
  payloadFields,
}: SetVariablePayloadEditorProps) {
  const selectedVariable = useMemo(
    () => findVariableByRef(variables, action.payload.variableId) ?? null,
    [variables, action.payload.variableId],
  );

  const selectedVariableType = useMemo((): VariableTypeKey | undefined => {
    return selectedVariable?.value.key;
  }, [selectedVariable]);

  const newValue = action.payload.newValue;
  const isPayloadSource = newValue.type === "action-payload";
  const hasPayloadFields = (payloadFields?.length ?? 0) > 0;

  // Convert the value source to VariableInputValue (payload sources are
  // rendered by the dedicated field select instead)
  const inputValue = useMemo((): VariableInputValue => {
    if (newValue.type === "literal") {
      return {
        type: "literal",
        value: newValue.value,
      };
    }
    if (newValue.type === "variable-reference") {
      return {
        type: "variable-reference",
        value: { id: newValue.value.id },
      };
    }
    return {
      type: "literal",
      value: VARIABLE_TYPE_REGISTRY[selectedVariableType ?? "string"].defaultValue,
    };
  }, [newValue, selectedVariableType]);

  const handleVariableChange = (variableId: string) => {
    const variable = findVariableByRef(variables, variableId);
    if (!variable) {
      return;
    }

    // Reset the value to the new variable type's default, keeping a payload
    // source selection intact
    const nextValue: ComponentActionValueSource = isPayloadSource
      ? newValue
      : {
          type: "literal",
          value: VARIABLE_TYPE_REGISTRY[variable.value.key].defaultValue,
        };

    onActionChange({
      ...action,
      payload: {
        ...action.payload,
        newValue: nextValue,
        variableId: variable.id,
      },
    });
  };

  const handleValueChange = (newInputValue: VariableInputValue) => {
    let nextValue: ComponentActionValueSource;
    if (isLiteralValue(newInputValue)) {
      nextValue = {
        type: "literal",
        value: newInputValue.value,
      };
    } else {
      nextValue = {
        type: "variable-reference",
        value: { id: (newInputValue.value as { id: string }).id },
      };
    }

    onActionChange({
      ...action,
      payload: {
        ...action.payload,
        newValue: nextValue,
      },
    });
  };

  const handleSourceChange = (source: "custom" | "action-payload") => {
    if (source === "action-payload") {
      onActionChange({
        ...action,
        payload: {
          ...action.payload,
          newValue: {
            type: "action-payload",
            value: { field: payloadFields?.[0] ?? "" },
          },
        },
      });
      return;
    }
    onActionChange({
      ...action,
      payload: {
        ...action.payload,
        newValue: {
          type: "literal",
          value: VARIABLE_TYPE_REGISTRY[selectedVariableType ?? "string"].defaultValue,
        },
      },
    });
  };

  const handleFieldChange = (field: string) => {
    onActionChange({
      ...action,
      payload: {
        ...action.payload,
        newValue: { type: "action-payload", value: { field } },
      },
    });
  };

  if (variables.length === 0) {
    return (
      <div className="border-border/30 border-l-2 pl-2">
        <p className="text-muted-foreground text-xs">
          Add a variable to this element or an ancestor first
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 border-border/30 border-l-2 pl-2">
      <div className="flex flex-row items-center gap-2">
        <span className="min-w-16 text-muted-foreground text-xs">Variable</span>
        <VariableSelector
          className="h-7 min-w-24 flex-1 text-xs"
          onChange={handleVariableChange}
          placeholder="Select variable"
          variableId={action.payload.variableId}
          variables={variables}
        />
      </div>

      {hasPayloadFields && (
        <div className="flex flex-row items-center gap-2">
          <span className="min-w-16 text-muted-foreground text-xs">Source</span>
          <SelectInput
            className="flex-1"
            label="Value source"
            onChange={handleSourceChange}
            options={[
              { label: "Custom value", value: "custom" },
              { label: "From action payload", value: "action-payload" },
            ]}
            value={isPayloadSource ? "action-payload" : "custom"}
          />
        </div>
      )}

      {isPayloadSource ? (
        <>
          <div className="flex flex-row items-center gap-2">
            <span className="min-w-16 text-muted-foreground text-xs">Field</span>
            <SelectInput
              className="flex-1"
              label="Payload field"
              onChange={handleFieldChange}
              options={(payloadFields ?? []).map((field) => ({ label: field, value: field }))}
              placeholder="Select field"
              value={newValue.type === "action-payload" ? newValue.value.field : ""}
            />
          </div>
          <ActionPayloadSourceHint />
        </>
      ) : (
        selectedVariable && (
          <div className="flex flex-row items-center gap-2">
            <span className="min-w-16 text-muted-foreground text-xs">Value</span>
            <VariableInput
              className="flex-1"
              expectedType={selectedVariableType}
              onChange={handleValueChange}
              value={inputValue}
              variables={variables}
            />
          </div>
        )
      )}
    </div>
  );
}
