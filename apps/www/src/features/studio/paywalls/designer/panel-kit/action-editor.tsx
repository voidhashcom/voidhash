"use client";

import type { ComponentBoundAction, ComponentBoundActionType } from "@voidhash/mimic-schema";

import { SelectInput } from "@/features/studio/paywalls/designer/components/ui/select-input";
import type { LabeledVariable } from "@/features/studio/paywalls/designer/components/variables/types";
import { VARIABLE_TYPE_REGISTRY } from "@/features/studio/paywalls/designer/constants";

import { PurchaseProductPayloadEditor, SetVariablePayloadEditor } from "./action-payloads";

const ACTION_OPTIONS: { value: ComponentBoundActionType; label: string }[] = [
  { label: "None", value: "none" },
  { label: "Set variable", value: "set-variable" },
  { label: "Close paywall", value: "close-paywall" },
  { label: "Purchase product", value: "purchase-product" },
];

/** Display labels for action types, shared by interaction and component rows. */
export const ACTION_TYPE_LABELS: Record<ComponentBoundActionType, string> = {
  "close-paywall": "Close paywall",
  none: "None",
  "purchase-product": "Purchase product",
  "set-variable": "Set variable",
};

export interface ActionEditorProps {
  action: ComponentBoundAction;
  onChange: (action: ComponentBoundAction) => void;
  /** Variables offered to set-variable targets and value pickers. */
  variables: readonly LabeledVariable[];
  /** Product-typed subset of `variables`, offered to purchase-product. */
  productVariables: readonly LabeledVariable[];
  /** Payload field names of the emitting component action; enables "From action payload" sources. */
  payloadFields?: readonly string[];
}

/**
 * The reusable action editor core (action type select + per-type payload
 * editors). Works on the component-bound action vocabulary, which is a
 * superset of the visual interaction `Action`; callers without
 * `payloadFields` never receive action-payload sources.
 */
export function ActionEditor({
  action,
  onChange,
  variables,
  productVariables,
  payloadFields,
}: ActionEditorProps) {
  const handleActionTypeChange = (actionType: ComponentBoundActionType) => {
    switch (actionType) {
      case "none":
        onChange({ type: "none" });
        break;
      case "set-variable": {
        const firstVariable = variables[0];
        onChange({
          payload: {
            newValue: {
              type: "literal",
              value: VARIABLE_TYPE_REGISTRY[firstVariable?.value.key ?? "string"].defaultValue,
            },
            variableId: firstVariable?.id ?? "",
          },
          type: "set-variable",
        });
        break;
      }
      case "close-paywall":
        onChange({ type: "close-paywall" });
        break;
      case "purchase-product":
        onChange({
          payload: { productId: "", type: "literal" },
          type: "purchase-product",
        });
        break;
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-muted-foreground text-xs font-medium">Action</span>
      <SelectInput
        label="Action"
        onChange={handleActionTypeChange}
        options={ACTION_OPTIONS}
        value={action.type}
      />

      {action.type === "set-variable" && (
        <SetVariablePayloadEditor
          action={action}
          onActionChange={onChange}
          payloadFields={payloadFields}
          variables={variables}
        />
      )}

      {action.type === "purchase-product" && (
        <PurchaseProductPayloadEditor
          action={action}
          onActionChange={onChange}
          payloadFields={payloadFields}
          productVariables={productVariables}
        />
      )}
    </div>
  );
}
