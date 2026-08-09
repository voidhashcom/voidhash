"use client";

import type { VariableType, VariableTypeKey } from "@voidhash/mimic-schema";
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from "@voidhash/ui";
import { DiamondIcon } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

import { VARIABLE_TYPE_REGISTRY } from "../../constants";
import { LiteralInput } from "./literal-input";
import { findVariableByRef } from "./types";
import type { LabeledVariable, VariableInputValue } from "./types";

export interface VariableInputProps {
  value: VariableInputValue;
  onChange: (value: VariableInputValue) => void;
  /** Available variables that can be referenced */
  variables: readonly LabeledVariable[];
  /** If set, only allows this type (filters variables, constrains literals) */
  expectedType?: VariableTypeKey;
  /** Custom literal renderer; defaults to the per-type input switch. */
  renderLiteral?: (value: VariableType, onChange: (value: VariableType) => void) => React.ReactNode;
  className?: string;
}

export function VariableInput({
  value,
  onChange,
  variables,
  expectedType,
  renderLiteral,
  className,
}: VariableInputProps) {
  const isLiteral = value.type === "literal";

  // Filter variables by expected type
  const compatibleVariables = useMemo(() => {
    if (!expectedType) {
      return variables;
    }
    return variables.filter((v) => v.value.key === expectedType);
  }, [variables, expectedType]);

  // Get current variable info for display
  const currentVariableId = useMemo(() => {
    if (value.type !== "variable-reference") {
      return null;
    }
    return (value.value as { id: string }).id;
  }, [value]);

  const currentVariable = useMemo(
    () => findVariableByRef(variables, currentVariableId),
    [currentVariableId, variables],
  );

  // Get current type from value
  const currentType = useMemo((): VariableTypeKey => {
    if (value.type === "literal") {
      return (value.value as VariableType).key;
    }
    return currentVariable?.value.key ?? "boolean";
  }, [value, currentVariable]);

  const handleSourceChange = (source: "literal" | "variable") => {
    if (source === "literal") {
      onChange({
        type: "literal",
        value: VARIABLE_TYPE_REGISTRY[expectedType ?? currentType].defaultValue,
      });
    } else {
      // Find first compatible variable
      const firstVariable = compatibleVariables[0];
      if (firstVariable) {
        onChange({
          type: "variable-reference",
          value: { id: firstVariable.id },
        });
      } else {
        toast.error("No compatible variables available");
      }
    }
  };

  const handleVariableChange = (variableId: string) => {
    onChange({
      type: "variable-reference",
      value: { id: variableId },
    });
  };

  const handleLiteralChange = (literalValue: VariableType) => {
    onChange({
      type: "literal",
      value: literalValue,
    });
  };

  return (
    <div className={cn("flex flex-row ring-1 ring-border rounded-md items-center", className)}>
      {/* Value/Variable input */}
      {isLiteral ? (
        <LiteralInput
          className="flex-1"
          expectedType={expectedType}
          onChange={handleLiteralChange}
          renderLiteral={renderLiteral}
          value={value.value as VariableType}
        />
      ) : (
        <Select onValueChange={handleVariableChange} value={currentVariable?.id ?? ""}>
          <SelectTrigger className="h-7 min-w-24 text-xs flex-1" size="sm">
            <SelectValue placeholder="Select variable">
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
                "Unknown"
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {compatibleVariables.map((variable) => (
              <SelectItem key={variable.id} value={variable.id}>
                <span>{variable.name}</span>
                {variable.ownerLabel ? (
                  <span className="text-muted-foreground text-xs">from {variable.ownerLabel}</span>
                ) : null}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Toggle between literal and variable */}
      <Button
        onClick={() => {
          if (isLiteral) {
            handleSourceChange("variable");
            return;
          }
          handleSourceChange("literal");
        }}
        size="icon-sm"
        variant="ghost"
      >
        <DiamondIcon
          className={cn("text-muted-foreground", !isLiteral && "text-primary")}
          fill={isLiteral ? "transparent" : "currentColor"}
        />
      </Button>
    </div>
  );
}
