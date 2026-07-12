import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from "@voidhash/ui";
import { RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";

import { Page } from "@/features/studio/shell";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";
import { WebhookDeliveryAttemptTimeline } from "@/features/studio/webhooks/webhook-delivery-attempt-timeline";
import { WebhookDeliverySidebar } from "@/features/studio/webhooks/webhook-delivery-sidebar";
import { getEventLabel } from "@/features/studio/webhooks/webhook-event-types";
import { WebhookPayloadViewer } from "@/features/studio/webhooks/webhook-payload-viewer";
import { WebhookStatusBadge } from "@/features/studio/webhooks/webhook-status-badge";
import {
  getWebhookDeliveryOptions,
  getWebhookEndpointOptions,
  queryKeys,
  retryWebhookDeliveryOptions,
} from "@/features/studio/lib/tanstack-query";

export const Route = createFileRoute(
  "/studio/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/settings/webhooks/$endpointId/$deliveryId",
)({
  component: WebhookDeliveryDetailPage,
  errorComponent: WebhookDeliveryDetailPageError,
  pendingComponent: WebhookDeliveryDetailPageSkeleton,
});

function WebhookDeliveryDetailPageError() {
  return (
    <VoidhashErrorCard
      error={{
        code: "INTERNAL_SERVER_ERROR",
        message: "An error occurred loading the delivery",
      }}
    />
  );
}

function WebhookDeliveryDetailPageSkeleton() {
  return (
    <Page className="p-0 py-8 pt-3">
      <div className="border-border border-b">
        <div className="mx-auto max-w-6xl pb-10 pt-4">
          <div className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-48" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="h-9 w-24" />
          </div>
          <Skeleton className="mt-3 h-5 w-48" />
        </div>
      </div>
      <div className="mx-auto mt-3 max-w-6xl">
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-9 space-y-8">
            <Card className="mt-8">
              <CardHeader>
                <Skeleton className="h-6 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-48 w-full" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-40" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="col-span-3 mt-8">
            <Skeleton className="h-6 w-20" />
            <div className="mt-4 space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        </div>
      </div>
    </Page>
  );
}

function WebhookDeliveryDetailPage() {
  const { deliveryId, endpointId, organizationSlug, projectSlug } = Route.useParams();
  const queryClient = useQueryClient();

  const { data: delivery } = useSuspenseQuery(getWebhookDeliveryOptions({ deliveryId }));

  const { data: endpoint } = useSuspenseQuery(getWebhookEndpointOptions({ endpointId }));

  const { mutate: retryDelivery, status: retryStatus } = useMutation({
    ...retryWebhookDeliveryOptions(),
    onError: () => {
      toast.error("Failed to retry delivery");
    },
    onSuccess: () => {
      toast.success("Delivery queued for retry");
      queryClient.invalidateQueries({
        queryKey: queryKeys.webhook.getDelivery(deliveryId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.webhook.deliveries({
          projectId: endpoint.projectId,
          endpointId,
        }),
      });
    },
  });

  const canRetry = delivery.status === "failed" || delivery.status === "exhausted";

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
        {
          title: getEventLabel(delivery.eventType),
          url: `/${organizationSlug}/${projectSlug}/settings/webhooks/${endpointId}/${deliveryId}`,
        },
      ]}
      className="p-0 py-8 pt-3"
    >
      <div className="border-border border-b">
        <div className="mx-auto max-w-6xl pb-10 pt-4">
          <div className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="font-normal text-3xl">{getEventLabel(delivery.eventType)}</h1>
              <WebhookStatusBadge status={delivery.status} />
            </div>
            {canRetry && (
              <Button
                disabled={retryStatus === "pending"}
                onClick={() => retryDelivery({ deliveryId })}
              >
                <RefreshCwIcon className="mr-2 h-4 w-4" />
                {retryStatus === "pending" ? "Retrying..." : "Retry"}
              </Button>
            )}
          </div>
          <p className="mt-3 text-muted-foreground">Delivered to {endpoint.name}</p>
        </div>
      </div>
      <div className="mx-auto mt-3 max-w-6xl">
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-9 space-y-8">
            <Card className="mt-8">
              <CardHeader>
                <CardTitle>Payload</CardTitle>
              </CardHeader>
              <CardContent>
                <WebhookPayloadViewer payload={delivery.payload} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Delivery Attempts</CardTitle>
              </CardHeader>
              <CardContent>
                <WebhookDeliveryAttemptTimeline attempts={[...delivery.attempts]} />
              </CardContent>
            </Card>
          </div>
          <div className="col-span-3 mt-8">
            <WebhookDeliverySidebar delivery={delivery} />
          </div>
        </div>
      </div>
    </Page>
  );
}
