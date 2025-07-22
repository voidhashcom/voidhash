'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import type { Project } from '@voidhash/db';
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
import { useRouter } from 'next/navigation';
import { useAction } from 'next-safe-action/hooks';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useTRPC } from '@/features/trpc/react';
import { updateProjectAction } from '@/lib/nextjs/server-actions';

const updateProjectNameSchema = z.object({
  name: z
    .string()
    .min(1, 'Project name is required')
    .max(32, 'Project name must be less than 32 characters')
});

type UpdateProjectNameForm = z.infer<typeof updateProjectNameSchema>;

export function ProjectNameForm({ project }: { project: Project }) {
  const form = useForm<UpdateProjectNameForm>({
    resolver: zodResolver(updateProjectNameSchema),
    defaultValues: {
      name: project?.name
    }
  });

  const queryClient = useQueryClient();
  const trpc = useTRPC();

  const router = useRouter();

  const { execute: updateProjectName, isPending } = useAction(
    updateProjectAction,
    {
      onSuccess: () => {
        toast.success('Project name updated successfully');
        queryClient.invalidateQueries({
          queryKey: trpc.pathKey()
        });
        router.refresh();
      },
      onError: (error) => {
        toast.error(error.error.serverError);
      }
    }
  );

  const onSubmit = (data: UpdateProjectNameForm) => {
    if (!project) {
      return;
    }
    updateProjectName({
      id: project.id,
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
              <Button disabled={isPending} type="submit">
                {isPending ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
}
