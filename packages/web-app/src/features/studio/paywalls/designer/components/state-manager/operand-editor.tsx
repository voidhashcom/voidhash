"use client";

import type { VariableTypeKey } from "@voidhash/mimic-schema";
import { useMemo } from "react";

import { VariableInput } from "../variables/variable-input";
import type { CRDTVariable, LocalOperand } from "./types";
import { toFlatVariables } from "./utils";

interface OperandEditorProps {
  operand: LocalOperand;
  onChange: (operand: LocalOperand) => void;
  variables: readonly CRDTVariable[];
  expectedType?: VariableTypeKey;
  className?: string;
}

/**
 * Operand editor that wraps VariableInput with CRDT variable conversion.
 * Converts CRDT variables to flat Variables for use with VariableInput.
 */
export function OperandEditor({
  operand,
  onChange,
  variables,
  expectedType,
  className,
}: OperandEditorProps) {
  // Convert CRDT variables to flat variables for VariableInput
  const flatVariables = useMemo(() => toFlatVariables(variables), [variables]);

  return (
    <VariableInput
      expectedType={expectedType}
      onChange={onChange}
      value={operand}
      variables={flatVariables}
      className={className}
    />
  );
}
