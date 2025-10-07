'use client';

import { zodResolver } from '@hookform/resolvers/zod';
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
import type { InferSafeActionFnResult } from 'next-safe-action';
import { useAction } from 'next-safe-action/hooks';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { createPaywallAction } from '@/lib/nextjs/server-actions';

const createPaywallSchema = z.object({
  name: z
    .string()
    .min(3, 'Name must be at least 3 characters long')
    .max(32, 'Name must be less than 32 characters')
});

type CreatePaywallForm = z.infer<typeof createPaywallSchema>;
type Paywall = InferSafeActionFnResult<typeof createPaywallAction>['data'];

interface CreatePaywallModalProps {
  open: boolean;
  onClose: () => void;
  trigger: React.ReactNode;
  projectId: string;
  onSuccess?: (paywall: Paywall) => void;
}

export function CreatePaywallModal({
  open,
  onClose,
  trigger,
  projectId,
  onSuccess
}: CreatePaywallModalProps) {
  const router = useRouter();
  const form = useForm<CreatePaywallForm>({
    resolver: zodResolver(createPaywallSchema),
    defaultValues: {
      name: ''
    }
  });

  const { execute, isPending } = useAction(createPaywallAction, {
    onSuccess: (res) => {
      if (res.data) {
        toast.success('Paywall created successfully');
        onSuccess?.(res.data);
        router.refresh();
        handleOpenChange(false);
      }
    },
    onError: (error) => {
      toast.error(error.error.serverError || 'Failed to create paywall');
    }
  });

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose?.();
      form.reset();
    }
  };

  const onSubmit = (data: CreatePaywallForm) => {
    execute({ ...data, projectId });
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Create Paywall</DialogTitle>
          {/* <DialogDescription>
						Create a new paywall for your project.
					</DialogDescription> */}
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
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Default paywall" {...field} />
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
                {isPending ? 'Creating Paywall...' : 'Create Paywall'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
