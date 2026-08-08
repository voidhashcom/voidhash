"use client";

import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voidhash/ui";
import { MinusIcon } from "lucide-react";
import { useMemo } from "react";

import { PREDICATE_LABELS, type PredicateType } from "../../constants";
import { createDefaultOperand } from "../variables/utils";
import { CRDTVariableSelector } from "./crdt-variable-selector";
import { OperandEditor } from "./operand-editor";
import type { CRDTVariable, LocalOperand, LocalPredicate } from "./types";
import { PREDICATES_BY_TYPE } from "./utils";

interface PredicateEditorProps {
  predicate: LocalPredicate;
  onChange: (predicate: LocalPredicate) => void;
  onRemove: () => void;
  canRemove: boolean;
  variables: readonly CRDTVariable[];
}

/**
 * Editor for a single predicate: [Variable] [Operator] [Value/Variable]
 */
export function PredicateEditor({
  predicate,
  onChange,
  onRemove,
  canRemove,
  variables,
}: PredicateEditorProps) {
  // Get the variable ID from the left operand (should always be a variable reference)
  const leftVariableId = useMemo(() => {
    if (predicate.value.left.type === "variable-reference") {
      return (predicate.value.left.value as { id: string }).id;
    }
    return null;
  }, [predicate.value.left]);

  // Get the type from the selected variable
  const leftVariable = useMemo(() => {
    if (!leftVariableId) {
      return null;
    }
    return variables.find((v) => v.id === leftVariableId) ?? null;
  }, [leftVariableId, variables]);

  const leftType = leftVariable?.value.value.key ?? "boolean";
  const availablePredicates = PREDICATES_BY_TYPE[leftType];

  const handleVariableChange = (newVariableId: string) => {
    const newVariable = variables.find((v) => v.id === newVariableId);
    if (!newVariable) {
      return;
    }

    const newType = newVariable.value.value.key;
    const currentPredicateType = predicate.type;

    // Check if current predicate type is valid for new variable type
    const validPredicates = PREDICATES_BY_TYPE[newType];
    let newPredicateType: PredicateType;
    if (validPredicates.includes(currentPredicateType)) {
      newPredicateType = currentPredicateType;
    } else {
      newPredicateType = validPredicates[0] ?? "equals";
    }

    // Reset right operand to match the new variable type
    const newRight = newType !== leftType ? createDefaultOperand(newType) : predicate.value.right;

    onChange({
      type: newPredicateType,
      value: {
        left: { type: "variable-reference", value: { id: newVariableId } },
        right: newRight,
      },
    });
  };

  const handlePredicateTypeChange = (type: PredicateType) => {
    onChange({
      ...predicate,
      type,
    });
  };

  const handleRightChange = (right: LocalOperand) => {
    onChange({
      ...predicate,
      value: { ...predicate.value, right },
    });
  };

  return (
    <div className="flex flex-row items-center gap-1 rounded-md bg-muted/50 p-2">
      {/* Left side: Variable selector */}
      <CRDTVariableSelector
        onChange={handleVariableChange}
        variableId={leftVariableId}
        variables={variables}
        className="flex-1"
      />

      {/* Predicate type selector */}
      <Select onValueChange={handlePredicateTypeChange} value={predicate.type}>
        <SelectTrigger className="h-7 text-xs" size="sm">
          <SelectValue>{PREDICATE_LABELS[predicate.type]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {availablePredicates.map((p) => (
            <SelectItem key={p} value={p}>
              {PREDICATE_LABELS[p]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Right operand: Value or Variable */}
      <OperandEditor
        expectedType={leftType}
        className="flex-1"
        onChange={handleRightChange}
        operand={predicate.value.right}
        variables={variables}
      />

      {/* Remove button */}
      {canRemove && (
        <Button onClick={onRemove} size="icon-sm" variant="ghost">
          <MinusIcon />
        </Button>
      )}
    </div>
  );
}
