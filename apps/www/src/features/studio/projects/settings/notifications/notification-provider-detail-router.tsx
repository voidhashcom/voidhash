import type { PushNotificationConfiguration } from "@voidhash/rpc";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";

import { ApnsNotificationProviderDetailPage } from "./providers/apns-notification-provider-detail-page";
import { FcmNotificationProviderDetailPage } from "./providers/fcm-notification-provider-detail-page";

export function NotificationProviderDetailRouter({
  organizationSlug,
  projectSlug,
  project,
  pushNotificationConfiguration,
}: {
  organizationSlug: string;
  projectSlug: string;
  project: { id: string };
  pushNotificationConfiguration: typeof PushNotificationConfiguration.Type;
}) {
  switch (pushNotificationConfiguration.providerId) {
    case "fcm":
      return (
        <FcmNotificationProviderDetailPage
          organizationSlug={organizationSlug}
          project={project}
          projectSlug={projectSlug}
          pushNotificationConfiguration={pushNotificationConfiguration}
        />
      );
    case "apns":
      return (
        <ApnsNotificationProviderDetailPage
          organizationSlug={organizationSlug}
          project={project}
          projectSlug={projectSlug}
          pushNotificationConfiguration={pushNotificationConfiguration}
        />
      );
    default:
      return (
        <VoidhashErrorCard
          error={{
            code: "UNSUPPORTED_NOTIFICATION_PROVIDER",
            message: "Unsupported notification provider",
          }}
        />
      );
  }
}
