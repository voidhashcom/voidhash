'use client';

import { useAtomSet } from '@effect-atom/atom-react';
import { effectTsResolver } from '@hookform/resolvers/effect-ts';
import { CreateOrganizationBody } from '@voidhash/api-spec';
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
import { ApiClient } from 'atom/lib/api-client';
import { queryKeys } from 'atom/query-keys';
import { Exit, type Schema } from 'effect';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

type CreateOrganizationForm = Schema.Schema.Type<typeof CreateOrganizationBody>;

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
  const form = useForm<CreateOrganizationForm>({
    resolver: effectTsResolver(CreateOrganizationBody),
    defaultValues: {
      name: ''
    }
  });

  const createOrganization = useAtomSet(
    ApiClient.mutation('organizations', 'createOrganization'),
    {
      mode: 'promiseExit'
    }
  );

  const [isCreatingOrganization, startCreatingOrganization] = useTransition();

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose?.();
    }
  };

  const onSubmit = (data: CreateOrganizationForm) => {
    startCreatingOrganization(async () => {
      const result = await createOrganization({
        payload: {
          name: data.name
        },
        reactivityKeys: queryKeys.invalidateAll()
      });

      if (Exit.isSuccess(result)) {
        router.push(`/${result.value.slug}`);
        onClose?.();
      }

      if (Exit.isFailure(result)) {
        toast.error('Failed to create organization');
      }
    });
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
                disabled={isCreatingOrganization}
                type="submit"
              >
                {isCreatingOrganization ? 'Creating Team...' : 'Create Team'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
