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
import type { InferSafeActionFnResult } from 'next-safe-action';
import { useAction } from 'next-safe-action/hooks';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { createPerkAction } from '@/lib/nextjs/server-actions';

const createPerkSchema = z.object({
  name: z
    .string()
    .min(3, 'Name must be at least 3 characters long')
    .max(32, 'Name must be less than 32 characters'),
  slug: z
    .string()
    .min(3, 'Slug must be at least 3 characters long')
    .max(32, 'Slug must be less than 32 characters')
    .regex(
      /^[a-z0-9_-]+$/,
      'Slug must contain only lowercase letters, numbers, underscores, and hyphens'
    )
});

type CreatePerkForm = z.infer<typeof createPerkSchema>;
type Perk = InferSafeActionFnResult<typeof createPerkAction>['data'];

interface CreatePerkModalProps {
  open: boolean;
  onClose: () => void;
  trigger: React.ReactNode;
  projectId: string;
  onSuccess?: (perk: Perk) => void;
}

export function CreatePerkModal({
  open,
  onClose,
  trigger,
  projectId,
  onSuccess
}: CreatePerkModalProps) {
  const router = useRouter();
  const form = useForm<CreatePerkForm>({
    resolver: zodResolver(createPerkSchema),
    defaultValues: {
      name: '',
      slug: ''
    }
  });

  const { execute, isPending } = useAction(createPerkAction, {
    onSuccess: (res) => {
      if (res.data) {
        toast.success('Perk created successfully');
        onSuccess?.(res.data);
        router.refresh();
        handleOpenChange(false);
      }
    },
    onError: (error) => {
      toast.error(error.error.serverError || 'Failed to create perk');
    }
  });

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose?.();
      form.reset();
    }
  };

  const onSubmit = (data: CreatePerkForm) => {
    execute({ ...data, projectId });
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Create Perk</DialogTitle>
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
                    <Input
                      placeholder="All-Access, AI-features, etc."
                      {...field}
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
                  <FormLabel>
                    <span>Slug (ID)</span>
                    <InfoTooltip
                      info={
                        'Slugs are unique identifiers used to reference the perk in code.'
                      }
                    />
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="all-access, ai-features, etc."
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
                {isPending ? 'Creating Perk...' : 'Create Perk'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
