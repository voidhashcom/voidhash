import { Effect } from "effect";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { INTERNAL_FEATURE_FLAGS } from "@voidhash/rpc";
import { Card, Page, PageHeader, Skeleton } from "@voidhash/ui";
import { useAuth } from "@/features/studio/components/auth-context";

import { NotificationProviderDetailRouter } from "@/features/studio/projects/settings/notifications/notification-provider-detail-router";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";
import { useInternalFeatureFlag } from "@/features/studio/lib/useInternalFeatureFlag";
import { getPushNotificationConfigurationOptions } from "@/features/studio/lib/tanstack-query";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";

export const Route = createFileRoute(
  "/studio/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/settings/notifications/$providerConfigurationId",
)({
  component: NotificationProviderDetailPage,
  errorComponent: NotificationProviderDetailPageError,
  pendingComponent: NotificationProviderDetailPageSkeleton,
});

function NotificationProviderDetailPageError() {
  return (
    <VoidhashErrorCard
      error={{
        code: "INTERNAL_SERVER_ERROR",
        message: "An error occurred loading the notification provider configuration",
      }}
    />
  );
}

function NotificationProviderDetailPageSkeleton() {
  return (
    <Page className="flex min-h-[calc(100svh-var(--header-height))] flex-col">
      <PageHeader>
        <Skeleton className="h-4 w-48" />
      </PageHeader>
      <div className="mx-auto flex w-full max-w-5xl flex-1 gap-8 px-6 py-8">
        <Card className="min-w-0 flex-1 self-start p-6">
          <div className="flex flex-col gap-6">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
        </Card>
      </div>
    </Page>
  );
}

function NotificationProviderDetailPage() {
  const { organizationSlug, projectSlug, providerConfigurationId } = Route.useParams();
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
    return Effect.runSync(Effect.die(new Error("Project not found")));
  }

  const { data: pushNotificationConfiguration } = useSuspenseQuery(
    getPushNotificationConfigurationOptions({
      id: providerConfigurationId as string,
    }),
  );

  return (
    <NotificationProviderDetailRouter
      organizationSlug={organizationSlug}
      project={project}
      projectSlug={projectSlug}
      pushNotificationConfiguration={pushNotificationConfiguration}
    />
  );
}
