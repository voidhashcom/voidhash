"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useConfirmDialog } from "@voidhash/ui";
import { toast } from "sonner";
import {
  deletePushNotificationConfigurationOptions,
  queryKeys,
  updatePushNotificationConfigurationOptions,
} from "@/features/studio/lib/tanstack-query";

export function useNotificationConfigurationMutations({
  organizationSlug,
  projectSlug,
  providerTitle,
}: {
  organizationSlug: string;
  projectSlug: string;
  providerTitle: string;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { ConfirmationDialog, openDialog } = useConfirmDialog();

  // Invalidate every cached push-config query (list + detail) so the enable/disable
  // Switch, the Enabled/Disabled badge, and the "Configured" presence indicators —
  // all read from the server row, not local form state — reflect the save at once.
  const invalidateConfigurations = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.pushNotificationConfiguration.all });

  const { mutate: updateConfiguration, status: updateStatus } = useMutation({
    ...updatePushNotificationConfigurationOptions(),
    onSuccess: () => {
      void invalidateConfigurations();
      toast.success(`${providerTitle} configuration saved successfully`);
    },
    onError: () => {
      toast.error(`Failed to save ${providerTitle} configuration`);
    },
  });

  const { mutateAsync: deletePushNotificationConfiguration, status: deleteStatus } = useMutation({
    ...deletePushNotificationConfigurationOptions(),
    onSuccess: () => {
      void invalidateConfigurations();
      toast.success(`${providerTitle} configuration deleted successfully`);
      navigate({
        params: {
          organizationSlug,
          projectSlug,
        },
        to: "/studio/$organizationSlug/$projectSlug/settings/notifications",
      });
    },
    onError: () => {
      toast.error(`Failed to delete ${providerTitle} configuration`);
    },
  });

  const deleteConfiguration = async (id: string) => {
    const confirmed = await openDialog({
      description: "Are you sure you want to delete this notification provider?",
      title: "Delete notification provider",
    });

    if (!confirmed) {
      return;
    }

    await deletePushNotificationConfiguration({
      pushNotificationConfigurationId: id,
    });
  };

  return {
    ConfirmationDialog,
    deleteConfiguration,
    isDeleting: deleteStatus === "pending",
    isSaving: updateStatus === "pending",
    openDialog,
    updateConfiguration,
  };
}
