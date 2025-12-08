'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Perk } from '@voidhash/rpc';
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
import { toast } from 'sonner';
import { createProductPerkOptions, queryKeys } from 'src/lib/tanstack-query';

export function ProductDetailAddPerkButton({
  productId,
  perks,
  variant = 'default'
}: {
  productId: string;
  perks: (typeof Perk.Type)[];
  variant?: 'default' | 'secondary';
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');

  const queryClient = useQueryClient();
  const { mutate: createProductPerk } = useMutation({
    ...createProductPerkOptions(),
    onSuccess: () => {
      toast.success('Perk added');
      queryClient.invalidateQueries({
        queryKey: queryKeys.productPerk.listByProduct({ productId })
      });
    },
    onError: () => {
      toast.error('Failed to add perk');
    }
  });

  const handleSelect = (perkId: string) => {
    createProductPerk({
      productId,
      perkId
    });
    setValue(perkId);
    setOpen(false);
  };
  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        {/** biome-ignore lint/a11y/useSemanticElements: custom component */}
        <Button aria-expanded={open} role="combobox" variant={variant}>
          Add perk
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Search perks..." />
          <CommandList>
            <CommandEmpty>No perks found.</CommandEmpty>
            <CommandGroup>
              {perks.map((perk) => (
                <CommandItem
                  className="cursor-pointer"
                  key={perk.id}
                  onSelect={() => {
                    handleSelect(perk.id);
                    setValue('');
                    setOpen(false);
                  }}
                  value={perk.id}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === perk.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {perk.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
