"use client";

import type { ComponentBoundAction, ComponentProductSource } from "@voidhash/mimic-schema";
import { Button, cn } from "@voidhash/ui";
import { DiamondIcon } from "lucide-react";
import { toast } from "sonner";

import { SelectInput } from "@/features/studio/paywalls/designer/components/ui/select-input";
import { TextInput } from "@/features/studio/paywalls/designer/components/ui/text-input";
import { VariableSelector } from "@/features/studio/paywalls/designer/components/variables/variable-selector";
import type { LabeledVariable } from "@/features/studio/paywalls/designer/components/variables/types";

import { ActionPayloadSourceHint } from "./action-payload-source-hint";

type PurchaseProductBoundAction = Extract<ComponentBoundAction, { type: "purchase-product" }>;

export interface PurchaseProductPayloadEditorProps {
  action: PurchaseProductBoundAction;
  onActionChange: (action: PurchaseProductBoundAction) => void;
  productVariables: readonly LabeledVariable[];
  /** Payload field names of the emitting component action; enables the "From action payload" product source. */
  payloadFields?: readonly string[];
}

export function PurchaseProductPayloadEditor({
  action,
  onActionChange,
  productVariables,
  payloadFields,
}: PurchaseProductPayloadEditorProps) {
  const payload = action.payload;
  const isLiteral = payload.type === "literal";
  const isPayloadSource = payload.type === "action-payload";
  const hasPayloadFields = (payloadFields?.length ?? 0) > 0;

  const setPayload = (newPayload: ComponentProductSource) => {
    onActionChange({
      ...action,
      payload: newPayload,
    });
  };

  const handleSourceToggle = () => {
    if (isLiteral) {
      const firstVariable = productVariables[0];
      if (firstVariable) {
        setPayload({ type: "variable-reference", variableId: firstVariable.id });
      } else {
        toast.error("No product variables available");
      }
      return;
    }
    setPayload({ productId: "", type: "literal" });
  };

  const handlePayloadSourceChange = (source: "custom" | "action-payload") => {
    if (source === "action-payload") {
      setPayload({ field: payloadFields?.[0] ?? "", type: "action-payload" });
      return;
    }
    setPayload({ productId: "", type: "literal" });
  };

  return (
    <div className="flex flex-col gap-2 border-border/30 border-l-2 pl-2">
      {hasPayloadFields && (
        <div className="flex flex-row items-center gap-2">
          <span className="min-w-16 text-muted-foreground text-xs">Source</span>
          <SelectInput
            className="flex-1"
            label="Product source"
            onChange={handlePayloadSourceChange}
            options={[
              { label: "Custom product", value: "custom" },
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
              onChange={(field) => setPayload({ field, type: "action-payload" })}
              options={(payloadFields ?? []).map((field) => ({ label: field, value: field }))}
              placeholder="Select field"
              value={payload.type === "action-payload" ? payload.field : ""}
            />
          </div>
          <ActionPayloadSourceHint />
        </>
      ) : (
        <div className="flex flex-row items-center gap-2">
          <span className="min-w-16 text-muted-foreground text-xs">Product</span>
          <div className="flex flex-1 flex-row items-center rounded-md ring-1 ring-border">
            {payload.type === "literal" ? (
              <TextInput
                className="h-7 flex-1 border-none text-xs shadow-none"
                label="Product ID"
                onChange={(productId) => setPayload({ productId, type: "literal" })}
                value={payload.productId}
              />
            ) : (
              <VariableSelector
                className="h-7 min-w-24 flex-1 border-none text-xs shadow-none"
                onChange={(variableId) => setPayload({ type: "variable-reference", variableId })}
                placeholder="Select product variable"
                variableId={payload.type === "variable-reference" ? payload.variableId : null}
                variables={productVariables}
              />
            )}

            <Button onClick={handleSourceToggle} size="icon-sm" variant="ghost">
              <DiamondIcon
                className={cn("text-muted-foreground", !isLiteral && "text-primary")}
                fill={isLiteral ? "transparent" : "currentColor"}
              />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
