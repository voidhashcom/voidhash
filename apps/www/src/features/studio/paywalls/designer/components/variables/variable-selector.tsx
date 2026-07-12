"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@voidhash/ui";
import { useMemo } from "react";

import { findVariableByRef } from "./types";
import type { LabeledVariable } from "./types";

export interface VariableSelectorProps {
  variableId: string | null;
  onChange: (variableId: string) => void;
  variables: readonly LabeledVariable[];
  placeholder?: string;
  className?: string;
}

export function VariableSelector({
  variableId,
  onChange,
  variables,
  placeholder = "Select...",
  className,
}: VariableSelectorProps) {
  const currentVariable = useMemo(
    () => findVariableByRef(variables, variableId) ?? null,
    [variableId, variables],
  );

  return (
    <Select onValueChange={onChange} value={currentVariable?.id ?? ""}>
      <SelectTrigger className={className ?? "h-7 min-w-28 text-xs"} size="sm">
        <SelectValue placeholder={placeholder}>
          {currentVariable ? (
            <>
              {currentVariable.name}
              {currentVariable.ownerLabel ? (
                <span className="ml-1 text-muted-foreground">
                  from {currentVariable.ownerLabel}
                </span>
              ) : null}
            </>
          ) : (
            placeholder
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {variables.map((variable) => (
          <SelectItem key={variable.id} value={variable.id}>
            <span>{variable.name}</span>
            {variable.ownerLabel ? (
              <span className="text-muted-foreground text-xs">from {variable.ownerLabel}</span>
            ) : null}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
