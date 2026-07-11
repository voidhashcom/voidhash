"use client";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@voidhash/ui";
import { toast } from "sonner";
import { createPushNotificationConfigurationOptions } from "@/features/studio/lib/tanstack-query";

import { notificationProviders } from "./notification-providers";

export function SetupNotificationProviderButton({
  projectId,
  providerId,
  organizationSlug,
  projectSlug,
}: {
  projectId: string;
  providerId: string;
  organizationSlug: string;
  projectSlug: string;
}) {
  const navigate = useNavigate();
  const notificationProvider = notificationProviders.find((p) => p.id === providerId);

  const { mutate: createPushNotificationConfiguration, status } = useMutation({
    ...createPushNotificationConfigurationOptions(),
    onSuccess: (data) => {
      toast.success(`${notificationProvider?.title} configuration saved successfully`);
      if (data.id) {
        navigate({
          params: {
            organizationSlug,
            providerConfigurationId: data.id,
            projectSlug,
          },
          to: "/studio/$organizationSlug/$projectSlug/settings/notifications/$providerConfigurationId",
        });
      }
    },
    onError: () => {
      toast.error(`Failed to save ${notificationProvider?.title} configuration`);
    },
  });

  if (!notificationProvider) {
    return null;
  }

  return (
    <Button
      disabled={status === "pending"}
      onClick={() =>
        createPushNotificationConfiguration({
          projectId,
          providerId,
        })
      }
      size="sm"
      variant="outline"
    >
      Set up
    </Button>
  );
}
