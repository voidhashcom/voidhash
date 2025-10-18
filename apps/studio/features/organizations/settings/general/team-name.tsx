'use client';

import { useAtomSet } from '@effect-atom/atom-react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  Input
} from '@voidhash/ui';
import { VRpc } from 'atom/lib/rpc-client';
import { runtime } from 'atom/lib/runtime';
import { withToast } from 'atom/lib/with-toast';
import { queryKeys } from 'atom/query-keys';
import { Effect, Either } from 'effect';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const updateTeamNameSchema = z.object({
  name: z
    .string()
    .min(1, 'Team name is required')
    .max(32, 'Team name must be less than 32 characters')
});

type UpdateTeamNameForm = z.infer<typeof updateTeamNameSchema>;

export function TeamNameForm({
  organization
}: {
  organization: {
    id: string;
    name: string;
  };
}) {
  const [isUpdatingTeamName, setIsUpdatingTeamName] = useState(false);
  const form = useForm<UpdateTeamNameForm>({
    resolver: zodResolver(updateTeamNameSchema),
    defaultValues: {
      name: organization?.name
    }
  });
  // const { execute: updateTeamName, isPending } = useAction(
  //   updateOrganizationAction,
  //   {
  //     onSuccess: () => {
  //       toast.success('Team name updated successfully');
  //       queryClient.invalidateQueries({
  //         queryKey: trpc.pathKey()
  //       });
  //       router.refresh();
  //     },
  //     onError: (error) => {
  //       toast.error(error.error.serverError);
  //     }
  //   }
  // );

  const updateTeamName = useAtomSet(
    runtime.fn(
      Effect.fnUntraced(
        function* (payload: { organizationId: string; name: string }) {
          const vrpc = yield* VRpc;
          setIsUpdatingTeamName(true);
          const result = yield* vrpc('UpdateOrganization', payload).pipe(
            Effect.either
          );
          if (Either.isRight(result)) {
            setIsUpdatingTeamName(false);
            return yield* Effect.succeed(undefined);
          }
          setIsUpdatingTeamName(false);
        },
        withToast({
          onSuccess: 'Team name updated successfully',
          onFailure: 'Failed to update team name',
          onWaiting: 'Updating team name...'
        })
      ),
      {
        reactivityKeys: queryKeys.invalidateAll()
      }
    )
  );

  const onSubmit = (data: UpdateTeamNameForm) => {
    if (!organization) {
      return;
    }
    updateTeamName({
      organizationId: organization.id,
      name: data.name
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Card className="mt-8 overflow-hidden pb-0">
          <CardHeader>
            <CardTitle>Team name</CardTitle>
            <CardDescription>
              This is your team&apos;s visible name within Voidhash. For
              example, the name of your company or department.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      className="max-w-64 text-foreground text-sm"
                      placeholder="Enter team name"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="flex items-baseline justify-between border-border border-t bg-background py-3 [.border-t]:pt-3">
            <div className="text-muted-foreground">
              Please use 32 characters at maximum.
            </div>
            <div>
              <Button disabled={isUpdatingTeamName} type="submit">
                {isUpdatingTeamName ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
}
