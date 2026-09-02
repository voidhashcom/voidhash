"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Input } from "@voidhash/ui";
import { Button } from "@voidhash/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@voidhash/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@voidhash/ui/form";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { queryKeys } from "@/features/studio/lib/tanstack-query";
import {
  addCreatedProjectToCurrentUserCache,
  createProjectOptions,
} from "@/features/studio/lib/tanstack-query/projects";
import { z } from "zod/v3";

const createProjectSchema = z.object({
  name: z
    .string()
    .min(1, "Project name is required")
    .max(32, "Project name must be less than 32 characters"),
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
  organizationSlug,
}: CreateProjectModalProps) {
  const navigate = useNavigate();

  const form = useForm<CreateProjectForm>({
    defaultValues: {
      name: "",
    },
    resolver: zodResolver(createProjectSchema),
  });

  const queryClient = useQueryClient();
  const { mutate: createProject, status: createProjectStatus } = useMutation({
    ...createProjectOptions(),
    onSuccess: (data, variables) => {
      toast.success("Project created successfully");
      addCreatedProjectToCurrentUserCache(queryClient, {
        ...data,
        organizationId: variables.organizationId,
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.invalidateAll() });
      void navigate({
        params: {
          organizationSlug,
          projectSlug: data.slug,
        },
        to: "/studio/$organizationSlug/$projectSlug",
      });
    },
    onError: () => {
      toast.error("Failed to create project");
    },
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
      organizationId,
    });
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm" hideCloseButton>
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form className="space-y-4 pt-4" onSubmit={form.handleSubmit(onSubmit)}>
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
            <DialogFooter className="flex sm:justify-between gap-2">
              <Button
                className="hidden md:block"
                disabled={createProjectStatus === "pending"}
                type="button"
                variant="outline"
                onClick={() => onClose?.()}
              >
                Cancel
              </Button>
              <Button disabled={createProjectStatus === "pending"} type="submit">
                {createProjectStatus === "pending" ? "Creating Project..." : "Create Project"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
