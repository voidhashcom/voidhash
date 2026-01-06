'use client';

import type { Variable } from '@voidhash/mimic-schema';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@voidhash/ui';
import { useMemo } from 'react';

export interface VariableSelectorProps {
  variableId: string | null;
  onChange: (variableId: string) => void;
  variables: readonly Variable[];
  placeholder?: string;
  className?: string;
}

export function VariableSelector({
  variableId,
  onChange,
  variables,
  placeholder = 'Select...',
  className
}: VariableSelectorProps) {
  const currentVariable = useMemo(() => {
    if (!variableId) {
      return null;
    }
    return variables.find((v) => v.id === variableId) ?? null;
  }, [variableId, variables]);

  return (
    <Select onValueChange={onChange} value={variableId ?? ''}>
      <SelectTrigger className={className ?? 'h-7 min-w-28 text-xs'} size="sm">
        <SelectValue placeholder={placeholder}>
          {currentVariable?.name ?? placeholder}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {variables.map((variable) => (
          <SelectItem key={variable.id} value={variable.id}>
            {variable.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
