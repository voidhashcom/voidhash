import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { INTERNAL_FEATURE_FLAGS } from "@voidhash/rpc";
import { Badge, Skeleton } from "@voidhash/ui";
import { ChevronRightIcon } from "lucide-react";
import { useAuth } from "@/features/studio/components/auth-context";

import { notificationProviders } from "@/features/studio/projects/settings/notifications/notification-providers";
import { SetupNotificationProviderButton } from "@/features/studio/projects/settings/notifications/setup-notification-provider-button";
import { SettingsCard, SettingsPage, SettingsSection } from "@/features/studio/settings";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";
import { useInternalFeatureFlag } from "@/features/studio/lib/useInternalFeatureFlag";
import { listPushNotificationConfigurationsOptions } from "@/features/studio/lib/tanstack-query";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";

export const Route = createFileRoute(
  "/studio/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/settings/notifications/",
)({
  component: NotificationsIndexPage,
  errorComponent: NotificationsIndexPageError,
  pendingComponent: NotificationsIndexPageSkeleton,
});

function NotificationsIndexPageError() {
  return (
    <VoidhashErrorCard
      error={{
        code: "INTERNAL_SERVER_ERROR",
        message: "An error occurred loading the notification providers",
      }}
    />
  );
}

function NotificationsIndexPageSkeleton() {
  return (
    <SettingsPage title="Notifications">
      <SettingsSection title="Providers">
        <SettingsCard>
          {notificationProviders.map((notificationProvider) => (
            <div
              className="flex items-center gap-3 border-border/60 border-t px-5 py-3.5 first:border-t-0"
              key={notificationProvider.id}
            >
              <Skeleton className="h-8 w-8 rounded-md" />
              <Skeleton className="h-4 w-48" />
            </div>
          ))}
        </SettingsCard>
      </SettingsSection>
    </SettingsPage>
  );
}

function NotificationsIndexPage() {
  const { organizationSlug, projectSlug } = Route.useParams();
  const enabled = useInternalFeatureFlag(INTERNAL_FEATURE_FLAGS.notifications.key);

  const { user } = useAuth();
  const project = CurrentUser.getProjectBySlugs(
    user,
    organizationSlug as string,
    projectSlug as string,
  );

  if (!enabled) {
    return <VoidhashErrorCard error={{ code: "NOT_FOUND", message: "Not found" }} />;
  }

  if (!project) {
    throw new Error("Project not found");
  }

  const { data: pushNotificationConfigurations } = useSuspenseQuery(
    listPushNotificationConfigurationsOptions({
      projectId: project.id,
    }),
  );

  const providersWithConfigurations = notificationProviders.map((notificationProvider) => {
    const pushNotificationConfiguration = pushNotificationConfigurations?.find(
      (p) => p.providerId === notificationProvider.id,
    );
    return {
      ...pushNotificationConfiguration,
      provider: notificationProvider,
    };
  });

  return (
    <SettingsPage
      description="Configure push-notification delivery providers."
      title="Notifications"
    >
      <SettingsSection title="Providers">
        <SettingsCard>
          {providersWithConfigurations.map((pushNotificationConfiguration) => (
            <div
              className="group relative isolate border-border/60 border-t px-5 py-3.5 transition-colors first:border-t-0 hover:bg-muted/40"
              key={pushNotificationConfiguration.id ?? pushNotificationConfiguration.provider.id}
            >
              {pushNotificationConfiguration.id ? (
                <Link
                  className="absolute inset-0 h-full w-full"
                  params={{
                    organizationSlug,
                    providerConfigurationId: pushNotificationConfiguration.id,
                    projectSlug,
                  }}
                  to="/studio/$organizationSlug/$projectSlug/settings/notifications/$providerConfigurationId"
                />
              ) : null}

              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="truncate font-medium text-foreground text-sm">
                    {pushNotificationConfiguration.provider.title}
                  </p>
                  <p className="truncate text-[13px] text-muted-foreground">
                    {pushNotificationConfiguration.provider.description}
                  </p>
                </div>

                {pushNotificationConfiguration.id ? (
                  <div className="flex shrink-0 items-center gap-2">
                    {pushNotificationConfiguration.enabled ? (
                      <Badge className="text-[11px]">Enabled</Badge>
                    ) : (
                      <Badge className="text-[11px]" variant="outline">
                        Disabled
                      </Badge>
                    )}
                    <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                ) : (
                  <div className="relative z-10 flex shrink-0 items-center gap-2">
                    <SetupNotificationProviderButton
                      organizationSlug={organizationSlug}
                      projectId={project.id}
                      projectSlug={projectSlug}
                      providerId={pushNotificationConfiguration.provider.id}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </SettingsCard>
      </SettingsSection>
    </SettingsPage>
  );
}
