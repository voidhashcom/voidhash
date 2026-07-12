"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AvatarUploader } from "@/features/studio/components/avatar-uploader";
import { queryKeys } from "@/features/studio/lib/tanstack-query";
import {
  removeUserAvatarOptions,
  setUserAvatarOptions,
} from "@/features/studio/lib/tanstack-query/users";
import { SettingsCard, SettingsRow, SettingsSection } from "@/features/studio/settings";

const errorMessage = (error: unknown, fallback: string): string =>
  error && typeof error === "object" && "message" in error && typeof error.message === "string"
    ? error.message
    : fallback;

export function UserAvatarForm({
  user,
}: {
  user: { id: string; name: string; image: string | null };
}) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.invalidateAll() });

  const setAvatar = useMutation({
    ...setUserAvatarOptions(),
    onSuccess: () => {
      toast.success("Avatar updated");
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error, "Failed to update avatar")),
  });

  const removeAvatar = useMutation({
    ...removeUserAvatarOptions(),
    onSuccess: () => {
      toast.success("Avatar removed");
      invalidate();
    },
    onError: () => toast.error("Failed to remove avatar"),
  });

  const isPending = setAvatar.status === "pending" || removeAvatar.status === "pending";

  return (
    <SettingsSection title="Avatar">
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
              fallback={user.id}
              isPending={isPending}
              name={user.name}
              onRemove={() => removeAvatar.mutate()}
              onUpload={({ imageBase64, contentType }) =>
                setAvatar.mutate({ imageBase64, contentType })
              }
              src={user.image}
            />
          }
          description="Click on the avatar to upload a custom one from your files."
          title="This is your avatar."
        />
      </SettingsCard>
    </SettingsSection>
  );
}
