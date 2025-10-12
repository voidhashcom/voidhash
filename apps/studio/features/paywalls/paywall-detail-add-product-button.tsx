'use client';

import type { Product } from '@voidhash/db';
import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  cn,
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@voidhash/ui';
import { Check } from 'lucide-react';
import { useState } from 'react';

export function PaywallDetailAddProductButton({
  products,
  variant = 'default',
  onAdd
}: {
  products: Product[];
  variant?: 'default' | 'secondary' | 'outline';
  onAdd: (productId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');

  const handleSelect = (productId: string) => {
    onAdd(productId);
    setValue(productId);
    setOpen(false);
  };

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        {/** biome-ignore lint/a11y/useSemanticElements: shadcn custom component */}
        <Button aria-expanded={open} role="combobox" variant={variant}>
          Add product
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Search product..." />
          <CommandList>
            <CommandEmpty>No products found.</CommandEmpty>
            <CommandGroup>
              {products.map((product) => (
                <CommandItem
                  className="cursor-pointer"
                  key={product.id}
                  onSelect={() => {
                    handleSelect(product.id);
                    setValue('');
                    setOpen(false);
                  }}
                  value={product.id}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === product.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {product.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
