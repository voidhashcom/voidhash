"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@voidhash/ui";
import { useMemo } from "react";

import type { CRDTVariable } from "./types";

interface CRDTVariableSelectorProps {
  variableId: string | null;
  onChange: (variableId: string) => void;
  variables: readonly CRDTVariable[];
  placeholder?: string;
  className?: string;
}

/**
 * Variable selector that works with CRDT variable format.
 * Used for the left side of predicates (always a variable reference).
 */
export function CRDTVariableSelector({
  variableId,
  onChange,
  variables,
  placeholder = "Select...",
  className,
}: CRDTVariableSelectorProps) {
  const currentVariable = useMemo(() => {
    if (!variableId) {
      return null;
    }
    return variables.find((v) => v.id === variableId) ?? null;
  }, [variableId, variables]);

  return (
    <Select onValueChange={onChange} value={variableId ?? ""}>
      <SelectTrigger className={className ?? "h-7 min-w-28 text-xs"} size="sm">
        <SelectValue placeholder={placeholder}>
          {currentVariable ? (
            <>
              {currentVariable.value.name}
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
            <span>{variable.value.name}</span>
            {variable.ownerLabel ? (
              <span className="text-muted-foreground text-xs">from {variable.ownerLabel}</span>
            ) : null}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
