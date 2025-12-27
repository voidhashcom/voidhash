'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { DNF } from '@voidhash/mimic-schema';
import { Button } from '@voidhash/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@voidhash/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@voidhash/ui/form';
import { Input } from '@voidhash/ui/input';
import { useForm } from 'react-hook-form';
import { z } from 'zod/v3';

const addStateSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(32, 'Name must be less than 32 characters')
});

type AddStateForm = z.infer<typeof addStateSchema>;

interface AddStateModalProps {
  open: boolean;
  onClose: () => void;
  existingStateNames: string[];
  onAdd: (name: string, condition: DNF) => void;
}

export function AddStateModal({
  open,
  onClose,
  existingStateNames,
  onAdd
}: AddStateModalProps) {
  const form = useForm<AddStateForm>({
    resolver: zodResolver(addStateSchema),
    defaultValues: {
      name: ''
    }
  });

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onClose?.();
      form.reset();
    }
  };

  const onSubmit = (data: AddStateForm) => {
    // Check if state name already exists
    if (existingStateNames.includes(data.name)) {
      form.setError('name', {
        message: 'A state with this name already exists'
      });
      return;
    }

    // Create default DNF condition (always true)
    const defaultCondition = {
      type: 'or' as const,
      value: [
        {
          type: 'and' as const,
          value: [
            {
              type: 'equals' as const,
              value: {
                left: {
                  type: 'literal' as const,
                  value: { key: 'boolean' as const, value: true }
                },
                right: {
                  type: 'literal' as const,
                  value: { key: 'boolean' as const, value: true }
                }
              }
            }
          ]
        }
      ]
    };

    onAdd(data.name, defaultCondition);
    handleOpenChange(false);
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add New State</DialogTitle>
          <DialogDescription>
            Enter a name for your state. The condition editor will be available
            soon.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            className="space-y-6 pt-4"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>State Name</FormLabel>
                  <FormControl>
                    <Input placeholder="myState" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Placeholder for condition editor */}
            <div className="rounded-md border border-dashed p-4 text-center text-muted-foreground text-sm">
              Condition editor coming soon
            </div>

            <DialogFooter>
              <Button className="mt-4 w-full" type="submit">
                Add State
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
