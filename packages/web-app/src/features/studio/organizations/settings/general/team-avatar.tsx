"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AvatarUploader } from "@/features/studio/components/avatar-uploader";
import { queryKeys } from "@/features/studio/lib/tanstack-query";
import {
  removeOrganizationAvatarOptions,
  setOrganizationAvatarOptions,
} from "@/features/studio/lib/tanstack-query/organizations";
import { SettingsCard, SettingsRow, SettingsSection } from "@/features/studio/settings";

const errorMessage = (error: unknown, fallback: string): string =>
  error && typeof error === "object" && "message" in error && typeof error.message === "string"
    ? error.message
    : fallback;

export function TeamAvatarForm({
  organization,
}: {
  organization: { id: string; name: string; logo: string | null };
}) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.invalidateAll() });

  const setAvatar = useMutation({
    ...setOrganizationAvatarOptions(),
    onSuccess: () => {
      toast.success("Team avatar updated");
      void invalidate();
    },
    onError: (error) => toast.error(errorMessage(error, "Failed to update team avatar")),
  });

  const removeAvatar = useMutation({
    ...removeOrganizationAvatarOptions(),
    onSuccess: () => {
      toast.success("Team avatar removed");
      void invalidate();
    },
    onError: () => toast.error("Failed to remove team avatar"),
  });

  const isPending = setAvatar.status === "pending" || removeAvatar.status === "pending";

  return (
    <SettingsSection title="Team Avatar">
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
              fallback={organization.id}
              isPending={isPending}
              name={organization.name}
              onRemove={() => removeAvatar.mutate({ organizationId: organization.id })}
              onUpload={({ imageBase64, contentType }) =>
                setAvatar.mutate({ organizationId: organization.id, imageBase64, contentType })
              }
              src={organization.logo}
            />
          }
          description="Click on the avatar to upload a custom one from your files."
          title="This is your team's avatar."
        />
      </SettingsCard>
    </SettingsSection>
  );
}
