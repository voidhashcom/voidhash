'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod/v3';
import { queryKeys } from '@/lib/tanstack-query';
import { createProjectOptions } from '@/lib/tanstack-query/projects';

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

  const queryClient = useQueryClient();
  const { mutate: createProject, status: createProjectStatus } = useMutation({
    ...createProjectOptions(),
    onSuccess: (data) => {
      toast.success('Project created successfully');
      queryClient.invalidateQueries({ queryKey: queryKeys.invalidateAll() });
      router.push(`/${organizationSlug}/${data.slug}`);
    },
    onError: () => {
      toast.error('Failed to create project');
    }
  });

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose?.();
      form.reset();
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
                disabled={createProjectStatus === 'pending'}
                type="submit"
              >
                {createProjectStatus === 'pending'
                  ? 'Creating Project...'
                  : 'Create Project'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
