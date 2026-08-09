"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  Input,
} from "@voidhash/ui";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { SettingsCard, SettingsRow, SettingsSection } from "@/features/studio/settings";
import { queryKeys } from "@/features/studio/lib/tanstack-query";
import { updateProjectOptions } from "@/features/studio/lib/tanstack-query/projects";
import { z } from "zod/v3";

const updateProjectNameSchema = z.object({
  name: z
    .string()
    .min(1, "Project name is required")
    .max(32, "Project name must be less than 32 characters"),
});

type UpdateProjectNameForm = z.infer<typeof updateProjectNameSchema>;

export function ProjectNameForm({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const form = useForm<UpdateProjectNameForm>({
    defaultValues: {
      name: projectName,
    },
    resolver: zodResolver(updateProjectNameSchema),
  });

  const queryClient = useQueryClient();
  const { mutate: updateProjectName, status: updateProjectNameStatus } = useMutation({
    ...updateProjectOptions(),
    onSuccess: () => {
      toast.success("Project name updated successfully");
      void queryClient.invalidateQueries({ queryKey: queryKeys.invalidateAll() });
    },
    onError: () => {
      toast.error("Failed to update project name");
    },
  });

  const onSubmit = (data: UpdateProjectNameForm) => {
    updateProjectName({
      id: projectId,
      name: data.name,
    });
  };

  const isPending = updateProjectNameStatus === "pending";

  return (
    <SettingsSection title="Project">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsCard
            footer={
              <>
                <span className="text-[12px] text-muted-foreground">
                  Use up to 32 characters.
                </span>
                <Button disabled={isPending} size="sm" type="submit">
                  {isPending ? "Saving..." : "Save"}
                </Button>
              </>
            }
          >
            <SettingsRow
              control={
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="w-full sm:w-64">
                      <FormControl>
                        <Input placeholder="Enter project name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              }
              title="Project name"
            />
          </SettingsCard>
        </form>
      </Form>
    </SettingsSection>
  );
}
