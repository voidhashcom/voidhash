"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AvatarUploader } from "@/features/studio/components/avatar-uploader";
import { queryKeys } from "@/features/studio/lib/tanstack-query";
import {
  removeProjectAvatarOptions,
  setProjectAvatarOptions,
} from "@/features/studio/lib/tanstack-query/projects";
import { SettingsCard, SettingsRow, SettingsSection } from "@/features/studio/settings";

const errorMessage = (error: unknown, fallback: string): string =>
  error && typeof error === "object" && "message" in error && typeof error.message === "string"
    ? error.message
    : fallback;

export function ProjectAvatarForm({
  project,
}: {
  project: { id: string; name: string; logo: string | null };
}) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.invalidateAll() });

  const setAvatar = useMutation({
    ...setProjectAvatarOptions(),
    onSuccess: () => {
      toast.success("Project avatar updated");
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error, "Failed to update project avatar")),
  });

  const removeAvatar = useMutation({
    ...removeProjectAvatarOptions(),
    onSuccess: () => {
      toast.success("Project avatar removed");
      invalidate();
    },
    onError: () => toast.error("Failed to remove project avatar"),
  });

  const isPending = setAvatar.status === "pending" || removeAvatar.status === "pending";

  return (
    <SettingsSection title="Project Avatar">
      <SettingsCard
        footer={
          <span className="text-[12px] text-muted-foreground">
            An avatar is optional but strongly recommended.
          </span>
        }
      >
        <SettingsRow
          control={
            <AvatarUploader
              fallback={project.id}
              isPending={isPending}
              name={project.name}
              onRemove={() => removeAvatar.mutate({ id: project.id })}
              onUpload={({ imageBase64, contentType }) =>
                setAvatar.mutate({ id: project.id, imageBase64, contentType })
              }
              src={project.logo}
            />
          }
          description="Click on the avatar to upload a custom one from your files."
          title="This is your project's avatar."
        />
      </SettingsCard>
    </SettingsSection>
  );
}
