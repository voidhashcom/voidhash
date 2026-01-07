'use client';

import { cn } from '@voidhash/ui';
import { InputGroup, InputGroupInput } from '@voidhash/ui/input-group';

export interface ProductInputProps {
  value: { productId: string | null };
  onChange: (value: { productId: string | null }) => void;
  className?: string;
}

/**
 * Input for product variable type.
 * Currently a simple text input for product ID.
 * TODO: Replace with product picker component in the future.
 */
export function ProductInput({ value, onChange, className }: ProductInputProps) {
  return (
    <InputGroup
      className={cn(
        'h-7 min-w-24 flex-1 rounded-sm border-none dark:bg-input/60',
        className
      )}
    >
      <InputGroupInput
        className="h-7 px-1 py-0 pl-2 text-xs"
        onChange={(e) =>
          onChange({ productId: e.target.value || null })
        }
        placeholder="Product ID..."
        value={value.productId ?? ''}
      />
    </InputGroup>
  );
}
