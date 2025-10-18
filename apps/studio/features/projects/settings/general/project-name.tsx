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

const updateProjectNameSchema = z.object({
  name: z
    .string()
    .min(1, 'Project name is required')
    .max(32, 'Project name must be less than 32 characters')
});

type UpdateProjectNameForm = z.infer<typeof updateProjectNameSchema>;

export function ProjectNameForm({
  projectId,
  projectName
}: {
  projectId: string;
  projectName: string;
}) {
  const form = useForm<UpdateProjectNameForm>({
    resolver: zodResolver(updateProjectNameSchema),
    defaultValues: {
      name: projectName
    }
  });

  const [isUpdatingProjectName, setIsUpdatingProjectName] = useState(false);

  const updateProjectName = useAtomSet(
    runtime.fn(
      Effect.fnUntraced(
        function* (payload: { id: string; name: string }) {
          const vrpc = yield* VRpc;
          setIsUpdatingProjectName(true);
          const result = yield* vrpc('UpdateProject', payload).pipe(
            Effect.either
          );
          if (Either.isRight(result)) {
            setIsUpdatingProjectName(false);
            return yield* Effect.succeed(undefined);
          }
          setIsUpdatingProjectName(false);
          return yield* Effect.fail(result.left);
        },
        withToast({
          onSuccess: 'Project name updated successfully',
          onFailure: 'Failed to update project name',
          onWaiting: 'Updating project name...'
        })
      ),
      {
        reactivityKeys: queryKeys.invalidateAll()
      }
    )
  );

  const onSubmit = (data: UpdateProjectNameForm) => {
    updateProjectName({
      id: projectId,
      name: data.name
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Card className="mt-8 overflow-hidden pb-0">
          <CardHeader>
            <CardTitle>Project Name</CardTitle>
            <CardDescription>
              This is your project&apos;s visible name within Voidhash.
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
                      placeholder="Enter project name"
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
              <Button disabled={isUpdatingProjectName} type="submit">
                {isUpdatingProjectName ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
}
