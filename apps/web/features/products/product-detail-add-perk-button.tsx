'use client';

import type { Perk } from '@voidhash/db';
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
import { useRouter } from 'next/navigation';
import { useAction } from 'next-safe-action/hooks';
import { useState } from 'react';
import { toast } from 'sonner';
import { createProductPerkAction } from '@/lib/nextjs/server-actions';

export function ProductDetailAddPerkButton({
  productId,
  perks,
  variant = 'default'
}: {
  productId: string;
  perks: Perk[];
  variant?: 'default' | 'secondary';
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const router = useRouter();

  const { execute } = useAction(createProductPerkAction, {
    onExecute: () => {
      toast.loading('Adding perk...');
    },
    onSuccess: () => {
      toast.dismiss();
      toast.success('Perk added');
      router.refresh();
    },
    onError: (error) => {
      toast.dismiss();
      toast.error(error.error.serverError ?? 'An error occurred');
    }
  });

  const handleSelect = (perkId: string) => {
    execute({
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
