'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
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
import { useRouter } from 'next/navigation';
import { useAction } from 'next-safe-action/hooks';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { createOrganizationAction } from '@/lib/nextjs/server-actions';
import { useTRPC } from '../trpc/react';

const createOrganizationSchema = z.object({
  name: z
    .string()
    .min(1, 'Organization name is required')
    .max(32, 'Organization name must be less than 32 characters')
});

type CreateOrganizationForm = z.infer<typeof createOrganizationSchema>;

interface CreateOrganizationModalProps {
  open: boolean;
  onClose: () => void;
  trigger: React.ReactNode;
}

export function CreateOrganizationModal({
  open,
  onClose,
  trigger
}: CreateOrganizationModalProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  const form = useForm<CreateOrganizationForm>({
    resolver: zodResolver(createOrganizationSchema),
    defaultValues: {
      name: ''
    }
  });

  const { execute, isPending } = useAction(createOrganizationAction, {
    onSuccess: (res) => {
      if (res?.data?.id) {
        onClose?.();
        queryClient.invalidateQueries({
          queryKey: trpc.pathKey()
        });
        // Navigate to the new organization
        router.push(`/${res?.data?.slug}`);
      }
    },
    onError: (error) => {
      toast.error(error.error.serverError);
    }
  });

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose?.();
    }
  };

  const onSubmit = (data: CreateOrganizationForm) => {
    execute(data);
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Create New Team</DialogTitle>
          <DialogDescription>
            Create a new team to collaborate with your colleagues.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            className="space-y-4 pt-4"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>Team Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Inc." {...field} />
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
                {isPending ? 'Creating Team...' : 'Create Team'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
