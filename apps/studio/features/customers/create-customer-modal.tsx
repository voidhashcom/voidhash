'use client';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { useRouter } from 'next/navigation';
import { useAction } from 'next-safe-action/hooks';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { createCustomerAction } from '@/lib/nextjs/server-actions';

// Extract the relevant parts from createCustomerInputSchema for the form
const createCustomerFormSchema = z.object({
  appUserId: z.string().min(1),
  name: z.string().optional(),
  email: z.string().email().optional()
});

type CreateCustomerForm = z.infer<typeof createCustomerFormSchema>;

interface CreateCustomerModalProps {
  trigger: React.ReactNode;
  open: boolean;
  onClose: () => void;
  projectId: string;
}

export function CreateCustomerModal({
  open,
  onClose,
  trigger,
  projectId
}: CreateCustomerModalProps) {
  const router = useRouter();
  const form = useForm<CreateCustomerForm>({
    resolver: zodResolver(createCustomerFormSchema),
    defaultValues: {
      appUserId: '',
      name: '',
      email: ''
    }
  });

  const { execute, isPending } = useAction(createCustomerAction, {
    onSuccess: () => {
      router.refresh();
      toast.success('Customer created successfully!');
      form.reset();
      onClose?.();
    },
    onError: (error) => {
      // Use the serverError field if available, otherwise fallback
      const errorMessage =
        error.error.serverError ||
        error.error.validationErrors?._errors?.join(', ') || // Combine top-level validation errors
        'Failed to create customer';
      toast.error(errorMessage);
    }
  });

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      form.reset(); // Reset form when closing
      onClose?.();
    }
  };

  const onSubmit = (data: CreateCustomerForm) => {
    execute({
      ...data,
      name: data.name ?? null,
      email: data.email ?? null,
      projectId // Add the projectId required by the action
    });
  };

  useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [form, open]);

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
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
                disabled={isPending}
                type="submit"
              >
                {isPending ? 'Creating Customer...' : 'Create Customer'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
