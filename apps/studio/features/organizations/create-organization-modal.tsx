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
import { VRpc } from 'atom/lib/rpc-client';
import { runtime } from 'atom/lib/runtime';
import { withToast } from 'atom/lib/with-toast';
import { queryKeys } from 'atom/query-keys';
import { Effect, Either, type Schema } from 'effect';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

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
  const [isCreatingOrganization, setIsCreatingOrganization] = useState(false);
  const router = useRouter();
  const form = useForm<CreateOrganizationForm>({
    resolver: effectTsResolver(CreateOrganizationBody),
    defaultValues: {
      name: ''
    }
  });

  // const createOrganization = useAtomSet(VRpc.mutation('CreateOrganization'), {
  //   mode: 'promiseExit'
  // });

  const createOrganization = useAtomSet(
    runtime.fn(
      Effect.fnUntraced(
        function* (payload: CreateOrganizationBody) {
          setIsCreatingOrganization(true);
          const vrpc = yield* VRpc;
          const result = yield* vrpc('CreateOrganization', payload).pipe(
            Effect.either
          );
          if (Either.isRight(result)) {
            router.push(`/${result.right.slug}`);
            setIsCreatingOrganization(false);
            return yield* Effect.succeed(result.right);
          }
          setIsCreatingOrganization(false);
          return yield* Effect.fail(result.left);
        },
        withToast({
          onSuccess: 'Organization created successfully',
          onFailure: 'Failed to create organization',
          onWaiting: 'Creating organization...'
        })
      ),
      {
        reactivityKeys: queryKeys.invalidateAll()
      }
    )
  );

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose?.();
    }
  };

  const onSubmit = (data: CreateOrganizationForm) =>
    createOrganization({ name: data.name });

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
