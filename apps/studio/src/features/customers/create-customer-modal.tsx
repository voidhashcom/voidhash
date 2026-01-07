'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { InfoTooltip } from '@voidhash/ui';
import { Button } from '@voidhash/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
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
import { toast } from 'sonner';
import { createCustomerOptions, queryKeys } from 'src/lib/tanstack-query';
import { z } from 'zod/v3';

// Extract the relevant parts from createCustomerInputSchema for the form
const createCustomerFormSchema = z.object({
  appUserId: z.string().min(1),
  name: z.string().optional(),
  email: z.string().email().optional()
});

type CreateCustomerForm = z.infer<typeof createCustomerFormSchema>;

interface CreateCustomerModalProps {
  trigger: React.ReactNode;
  projectId: string;
  open: boolean;
  onClose: () => void;
}

export function CreateCustomerModal({
  open,
  onClose,
  trigger,
  projectId
}: CreateCustomerModalProps) {
  const form = useForm<CreateCustomerForm>({
    resolver: zodResolver(createCustomerFormSchema),
    defaultValues: {
      appUserId: '',
      name: '',
      email: ''
    }
  });

  const queryClient = useQueryClient();
  const { mutate: createCustomer, status: createCustomerStatus } = useMutation({
    ...createCustomerOptions(),
    onSuccess: () => {
      toast.success('Customer created successfully');
      queryClient.invalidateQueries({ queryKey: queryKeys.customer.all });
    },
    onError: () => {
      toast.error('Failed to create customer');
    }
  });

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose?.();
      form.reset();
    }
  };

  const onSubmit = (data: CreateCustomerForm) => {
    createCustomer({ ...data, projectId });
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      {/* @ts-expect-error React types version conflict between @types/react and @radix-ui */}
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Create Customer</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            className="space-y-6 pt-4"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <FormField
              control={form.control}
              name="appUserId"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>
                    App User ID{' '}
                    <InfoTooltip info="App User ID links your application's user identifier with its corresponding Voidhash customer profile." />
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="#######" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="john.doe@example.com"
                      type="email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                className="mt-4 w-full"
                disabled={createCustomerStatus === 'pending'}
                type="submit"
              >
                {createCustomerStatus === 'pending'
                  ? 'Creating Customer...'
                  : 'Create Customer'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
