'use client';
import { useAtomSet } from '@effect-atom/atom-react';
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
import { VRpc } from 'atom/lib/rpc-client';
import { runtime } from 'atom/lib/runtime';
import { withToast } from 'atom/lib/with-toast';
import { queryKeys } from 'atom/query-keys';
import { Effect, Either } from 'effect';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const createProjectSchema = z.object({
  name: z
    .string()
    .min(1, 'Project name is required')
    .max(32, 'Project name must be less than 32 characters')
});

type CreateProjectForm = z.infer<typeof createProjectSchema>;

interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
  trigger: React.ReactNode;
  organizationId: string;
  organizationSlug: string;
}

export function CreateProjectModal({
  open,
  onClose,
  trigger,
  organizationId,
  organizationSlug
}: CreateProjectModalProps) {
  const router = useRouter();

  const form = useForm<CreateProjectForm>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      name: ''
    }
  });

  const [isCreatingProject, setIsCreatingProject] = useState(false);

  const createProject = useAtomSet(
    runtime.fn(
      Effect.fnUntraced(
        function* (payload: { name: string; organizationId: string }) {
          setIsCreatingProject(true);
          const vrpc = yield* VRpc;
          const result = yield* vrpc('CreateProject', payload).pipe(
            Effect.either
          );
          if (Either.isRight(result)) {
            setIsCreatingProject(false);
            router.push(`/${organizationSlug}/${result.right.slug}`);
            return yield* Effect.succeed(result.right);
          }
          setIsCreatingProject(false);
          return yield* Effect.fail(result.left);
        },
        withToast({
          onSuccess: 'Project created successfully',
          onFailure: 'Failed to create project',
          onWaiting: 'Creating project...'
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

  const onSubmit = (data: CreateProjectForm) => {
    createProject({
      name: data.name,
      organizationId
    });
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
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
                    <Input placeholder="My Awesome App" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                className="mt-4 w-full"
                disabled={isCreatingProject}
                type="submit"
              >
                {isCreatingProject ? 'Creating Project...' : 'Create Project'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
