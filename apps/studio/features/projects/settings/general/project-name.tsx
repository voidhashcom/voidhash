'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod/v3';
import { queryKeys } from '@/lib/tanstack-query';
import { updateProjectOptions } from '@/lib/tanstack-query/projects';

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

  const queryClient = useQueryClient();
  const { mutate: updateProjectName, status: updateProjectNameStatus } =
    useMutation({
      ...updateProjectOptions(),
      onSuccess: () => {
        toast.success('Project name updated successfully');
        queryClient.invalidateQueries({ queryKey: queryKeys.invalidateAll() });
      },
      onError: () => {
        toast.error('Failed to update project name');
      }
    });

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
              <Button
                disabled={updateProjectNameStatus === 'pending'}
                type="submit"
              >
                {updateProjectNameStatus === 'pending' ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
}
