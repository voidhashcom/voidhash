"use client";

import type { ComponentBoundAction } from "@voidhash/mimic-schema";

import type { LabeledVariable } from "@/features/studio/paywalls/designer/components/variables/types";

import { ActionEditor } from "./action-editor";

/**
 * Props for the `actionEditorField` wire node. A thin renaming of
 * {@link ActionEditor}'s props (`action` → `value`); every value is either
 * serializable plain JSON (`value`, `variables`, `productVariables`,
 * `payloadFields`) or a callback, so it maps 1:1 to the wire contract.
 */
export interface ActionEditorFieldProps {
  /** The component-bound action as plain JSON. */
  value: ComponentBoundAction;
  onChange: (action: ComponentBoundAction) => void;
  /** Variables offered to set-variable targets and value pickers. */
  variables: readonly LabeledVariable[];
  /** Product-typed subset of `variables`, offered to purchase-product. */
  productVariables: readonly LabeledVariable[];
  /** Payload field names of the emitting component action; enables "From action payload" sources. */
  payloadFields?: readonly string[];
}

/**
 * Host-side kit target for the `actionEditorField` wire node. Wraps the shared
 * {@link ActionEditor} controlled view, renaming its `action` prop to `value`
 * to match the wire surface.
 */
export function ActionEditorField({
  value,
  onChange,
  variables,
  productVariables,
  payloadFields,
}: ActionEditorFieldProps) {
  return (
    <ActionEditor
      action={value}
      onChange={onChange}
      payloadFields={payloadFields}
      productVariables={productVariables}
      variables={variables}
    />
  );
}
