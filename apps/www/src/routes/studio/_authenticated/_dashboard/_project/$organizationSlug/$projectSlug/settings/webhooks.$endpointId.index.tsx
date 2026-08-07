import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@voidhash/ui";
import { Effect } from "effect";
import { useAuth } from "@/features/studio/components/auth-context";

import { Page } from "@/features/studio/shell";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";
import { WebhookDeliveryRecord } from "@/features/studio/webhooks/webhook-delivery-record";
import { WebhookDeliveryRecordSkeleton } from "@/features/studio/webhooks/webhook-delivery-record-skeleton";
import { WebhookEndpointActionsDropdown } from "@/features/studio/webhooks/webhook-endpoint-actions-dropdown";
import { WebhookEndpointDetailSidebar } from "@/features/studio/webhooks/webhook-endpoint-detail-sidebar";
import { WebhookStatusBadge } from "@/features/studio/webhooks/webhook-status-badge";
import {
  getWebhookEndpointOptions,
  listWebhookDeliveriesOptions,
} from "@/features/studio/lib/tanstack-query";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";

export const Route = createFileRoute(
  "/studio/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/settings/webhooks/$endpointId/",
)({
  component: WebhookEndpointDetailPage,
  errorComponent: WebhookEndpointDetailPageError,
  pendingComponent: WebhookEndpointDetailPageSkeleton,
});

function WebhookEndpointDetailPageError() {
  return (
    <VoidhashErrorCard
      error={{
        code: "INTERNAL_SERVER_ERROR",
        message: "An error occurred loading the webhook",
      }}
    />
  );
}

function WebhookEndpointDetailPageSkeleton() {
  return (
    <Page className="p-0 py-8 pt-3">
      <div className="border-border border-b">
        <div className="mx-auto max-w-6xl pb-10 pt-4">
          <div className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-48" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="h-9 w-9" />
          </div>
          <Skeleton className="mt-3 h-5 w-64" />
        </div>
      </div>
      <div className="mx-auto mt-3 max-w-6xl">
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-9">
            <Card className="mt-8 gap-0 overflow-hidden pb-0">
              <CardHeader className="pb-4">
                <Skeleton className="h-6 w-40" />
              </CardHeader>
              <CardContent className="divide-y divide-border border-border border-t px-0">
                {Array.from({ length: 3 }).map((_, i) => (
                  <WebhookDeliveryRecordSkeleton key={i} />
                ))}
              </CardContent>
            </Card>
          </div>
          <div className="col-span-3 mt-8">
            <Skeleton className="h-6 w-20" />
            <div className="mt-4 space-y-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        </div>
      </div>
    </Page>
  );
}

function WebhookEndpointDetailPage() {
  const { endpointId, organizationSlug, projectSlug } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const project = CurrentUser.getProjectBySlugs(
    user,
    organizationSlug as string,
    projectSlug as string,
  );

  if (!project) {
    return Effect.runSync(Effect.die(new Error("Project not found")));
  }

  const { data: endpoint } = useSuspenseQuery(getWebhookEndpointOptions({ endpointId }));

  const { data: deliveries } = useSuspenseQuery(
    listWebhookDeliveriesOptions({ projectId: project.id, endpointId }),
  );

  const handleDeleted = () => {
    void navigate({
      params: { organizationSlug, projectSlug },
      to: "/studio/$organizationSlug/$projectSlug/settings/webhooks",
    });
  };

  return (
    <Page
      breadcrumbs={[
        {
          title: "Webhooks",
          url: `/${organizationSlug}/${projectSlug}/settings/webhooks`,
        },
        {
          title: endpoint.name,
          url: `/${organizationSlug}/${projectSlug}/settings/webhooks/${endpointId}`,
        },
      ]}
      className="p-0 py-8 pt-3"
    >
      <div className="border-border border-b">
        <div className="mx-auto max-w-6xl pb-10 pt-4">
          <div className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="font-normal text-3xl">{endpoint.name}</h1>
              <WebhookStatusBadge status={endpoint.status} />
            </div>
            <WebhookEndpointActionsDropdown
              onDeleted={handleDeleted}
              projectId={project.id}
              webhook={endpoint}
            />
          </div>
          <p className="mt-3 text-muted-foreground">{endpoint.url}</p>
        </div>
      </div>
      <div className="mx-auto mt-3 max-w-6xl">
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-9">
            <Card className="mt-8 gap-0 overflow-hidden pb-0">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-4">Recent Deliveries</CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-border border-border border-t px-0">
                {deliveries.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center py-6">
                    <div className="text-muted-foreground">
                      No deliveries yet. Send a test webhook to see delivery history.
                    </div>
                  </div>
                ) : (
                  deliveries.map((delivery) => (
                    <WebhookDeliveryRecord
                      delivery={delivery}
                      endpointId={endpointId}
                      key={delivery.id}
                      organizationSlug={organizationSlug as string}
                      projectSlug={projectSlug as string}
                    />
                  ))
                )}
              </CardContent>
            </Card>
          </div>
          <div className="col-span-3 mt-8">
            <WebhookEndpointDetailSidebar endpoint={endpoint} />
          </div>
        </div>
      </div>
    </Page>
  );
}
