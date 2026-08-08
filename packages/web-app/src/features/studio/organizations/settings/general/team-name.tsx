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
import { updateOrganizationOptions } from "@/features/studio/lib/tanstack-query/organizations";
import { z } from "zod/v3";

const updateTeamNameSchema = z.object({
  name: z
    .string()
    .min(1, "Team name is required")
    .max(32, "Team name must be less than 32 characters"),
});

type UpdateTeamNameForm = z.infer<typeof updateTeamNameSchema>;

export function TeamNameForm({
  organization,
}: {
  organization: {
    id: string;
    name: string;
  };
}) {
  const form = useForm<UpdateTeamNameForm>({
    defaultValues: {
      name: organization?.name,
    },
    resolver: zodResolver(updateTeamNameSchema),
  });

  const queryClient = useQueryClient();
  const { mutate: updateTeamName, status: updateTeamNameStatus } = useMutation({
    ...updateOrganizationOptions(),
    onSuccess: () => {
      toast.success("Team name updated successfully");
      void queryClient.invalidateQueries({ queryKey: queryKeys.invalidateAll() });
    },
    onError: () => {
      toast.error("Failed to update team name");
    },
  });

  const onSubmit = (data: UpdateTeamNameForm) => {
    if (!organization) {
      return;
    }
    updateTeamName({
      name: data.name,
      organizationId: organization.id,
    });
  };

  const isPending = updateTeamNameStatus === "pending";

  return (
    <SettingsSection title="Team">
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
                        <Input placeholder="Enter team name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              }
              title="Team name"
            />
          </SettingsCard>
        </form>
      </Form>
    </SettingsSection>
  );
}
