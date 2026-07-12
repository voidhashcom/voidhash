"use client";

import type { VariableType, VariableTypeKey } from "@voidhash/mimic-schema";

import { renderVariableInput } from "./variable-type-renderers";

export interface LiteralInputProps {
  value: VariableType;
  onChange: (value: VariableType) => void;
  /** If set, constrains to this type and hides type selector */
  expectedType?: VariableTypeKey;
  /** Custom literal renderer; defaults to the per-type input switch. */
  renderLiteral?: (value: VariableType, onChange: (value: VariableType) => void) => React.ReactNode;
  className?: string;
}

export function LiteralInput({ value, onChange, renderLiteral, className }: LiteralInputProps) {
  return (
    <div className={className ?? "flex flex-row gap-1"}>
      {renderLiteral
        ? renderLiteral(value, onChange)
        : renderVariableInput(value, onChange, "flex-1")}
    </div>
  );
}
