'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@voidhash/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { createPaywallOptions, queryKeys } from 'src/lib/tanstack-query';
import { z } from 'zod/v3';

const createPaywallSchema = z.object({
  name: z
    .string()
    .min(3, 'Name must be at least 3 characters long')
    .max(32, 'Name must be less than 32 characters'),
  slug: z
    .string()
    .min(3, 'Slug must be at least 3 characters long')
    .max(32, 'Slug must be less than 32 characters')
    .regex(
      /^[\da-z-]+$/,
      'Slug can only contain lowercase letters, numbers, and hyphens'
    )
});

type CreatePaywallForm = z.infer<typeof createPaywallSchema>;

interface CreatePaywallModalProps {
  open: boolean;
  onClose: () => void;
  trigger: React.ReactNode;
  projectId: string;
  onSuccess?: (paywall: { id: string }) => void;
}

export function CreatePaywallModal({
  open,
  onClose,
  trigger,
  projectId,
  onSuccess
}: CreatePaywallModalProps) {
  const form = useForm<CreatePaywallForm>({
    resolver: zodResolver(createPaywallSchema),
    defaultValues: {
      name: '',
      slug: ''
    }
  });

  const queryClient = useQueryClient();
  const { mutate: createPaywall, status: createPaywallStatus } = useMutation({
    ...createPaywallOptions(),
    onSuccess: (data) => {
      onSuccess?.(data);
      toast.success('Paywall created successfully');
      queryClient.invalidateQueries({
        queryKey: queryKeys.paywall.list({ projectId })
      });
      handleOpenChange(false);
    },
    onError: () => {
      toast.error('Failed to create paywall');
    }
  });

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose?.();
      form.reset();
    }
  };

  const onSubmit = (data: CreatePaywallForm) => {
    createPaywall({ ...data, projectId });
  };

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    const slug = name
      .toLowerCase()
      .replaceAll(/[^\da-z\s-]/g, '')
      .replaceAll(/\s+/g, '-')
      .replaceAll(/-+/g, '-')
      .replace(/^-|-$/g, '');
    form.setValue('slug', slug);
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Create New Paywall</DialogTitle>
          <DialogDescription>
            Create a new paywall for your project.
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
                  <FormLabel>Paywall Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="My Paywall"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        handleNameChange(e.target.value);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>Slug</FormLabel>
                  <FormControl>
                    <Input placeholder="my-paywall" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                className="mt-4 w-full"
                disabled={createPaywallStatus === 'pending'}
                type="submit"
              >
                {createPaywallStatus === 'pending'
                  ? 'Creating Paywall...'
                  : 'Create Paywall'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
