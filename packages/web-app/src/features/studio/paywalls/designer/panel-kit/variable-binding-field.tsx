"use client";

import type { VariableType, VariableTypeKey } from "@voidhash/mimic-schema";
import { useMemo } from "react";

import type {
  LabeledVariable,
  VariableInputValue,
} from "@/features/studio/paywalls/designer/components/variables/types";
import { VariableInput } from "@/features/studio/paywalls/designer/components/variables/variable-input";

import {
  hexColorToRgbaString,
  rgbaStringToHexColor,
} from "../panels/right-panel/utils/component-color";
import { ColorInput } from "./color-input";
import { SelectInput } from "./select-input";

/**
 * Serializable selector for a built-in literal renderer, standing in for
 * {@link VariableInput}'s non-serializable `renderLiteral` render prop:
 *
 * - `color` → a {@link ColorInput} editing an `rgba`↔hex string literal.
 * - `select` → a {@link SelectInput} over `options` (a string literal).
 * - omitted → the default per-type literal input switch.
 */
export type LiteralKind =
  | { kind: "color" }
  | { kind: "select"; options: readonly string[] }
  | undefined;

export interface VariableBindingFieldProps {
  /** The literal-or-reference value as plain data (VariableInputValue-shaped). */
  value: VariableInputValue;
  onChange: (value: VariableInputValue) => void;
  /** Available variables that can be referenced. */
  variables: readonly LabeledVariable[];
  /** If set, only allows this type (filters variables, constrains literals). */
  expectedType?: VariableTypeKey;
  /** Serializable literal-renderer selector; replaces the render-prop path for the wire. */
  literalKind?: LiteralKind;
  /** Accessible label used by the `select` literal renderer. */
  label?: string;
  className?: string;
}

/**
 * Host-side kit target for the `variableField` wire node. Wraps the shared
 * {@link VariableInput} with a serializable surface: instead of a `renderLiteral`
 * render prop it takes a {@link LiteralKind} token and reconstructs the matching
 * literal editor host-side. `VariableInput` itself is unchanged — this is only a
 * wrapper, so existing render-prop consumers keep working.
 */
export function VariableBindingField({
  value,
  onChange,
  variables,
  expectedType,
  literalKind,
  label = "Value",
  className,
}: VariableBindingFieldProps) {
  const renderLiteral = useMemo(() => {
    if (literalKind?.kind === "color") {
      return (literal: VariableType, onLiteralChange: (value: VariableType) => void) => (
        <ColorInput
          className="flex-1"
          onChange={(rgba) => onLiteralChange({ key: "string", value: rgbaStringToHexColor(rgba) })}
          value={hexColorToRgbaString(literal.key === "string" ? literal.value : "")}
        />
      );
    }
    if (literalKind?.kind === "select") {
      const options = literalKind.options.map((option) => ({ label: option, value: option }));
      return (literal: VariableType, onLiteralChange: (value: VariableType) => void) => (
        <SelectInput
          className="flex-1"
          label={label}
          onChange={(option) => onLiteralChange({ key: "string", value: option })}
          options={options}
          placeholder="Select…"
          value={literal.key === "string" ? literal.value : ""}
        />
      );
    }
    return undefined;
  }, [literalKind, label]);

  return (
    <VariableInput
      className={className}
      expectedType={expectedType}
      onChange={onChange}
      renderLiteral={renderLiteral}
      value={value}
      variables={variables}
    />
  );
}
