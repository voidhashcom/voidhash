'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { VariableTypeKey } from '@voidhash/mimic-schema';
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

const addVariableSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(32, 'Name must be less than 32 characters')
});

type AddVariableForm = z.infer<typeof addVariableSchema>;

interface AddVariableModalProps {
  open: boolean;
  onClose: () => void;
  existingVariableNames: string[];
  onAdd: (name: string) => void;
  type: VariableTypeKey;
}

const getTypeLabel = (type: VariableTypeKey): string => {
  switch (type) {
    case 'string':
      return 'text';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'product':
      return 'product';
  }
};

export function AddVariableModal({
  open,
  onClose,
  existingVariableNames,
  onAdd,
  type
}: AddVariableModalProps) {
  const form = useForm<AddVariableForm>({
    resolver: zodResolver(addVariableSchema),
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

  const onSubmit = (data: AddVariableForm) => {
    // Check if variable name already exists
    if (existingVariableNames.includes(data.name)) {
      form.setError('name', {
        message: 'A variable with this name already exists'
      });
      return;
    }

    onAdd(data.name);
    handleOpenChange(false);
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add New Variable</DialogTitle>
          <DialogDescription>
            Enter a name for your {getTypeLabel(type)} variable.
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
                  <FormLabel>Variable Name</FormLabel>
                  <FormControl>
                    <Input placeholder="myVariable" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button className="mt-4 w-full" type="submit">
                Add Variable
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
