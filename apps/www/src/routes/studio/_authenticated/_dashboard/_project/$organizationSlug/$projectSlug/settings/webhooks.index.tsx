import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/features/studio/components/auth-context";

import { SettingsCard, SettingsPage } from "@/features/studio/settings";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";
import { CreateWebhookModalButton } from "@/features/studio/webhooks/create-webhook-modal-button";
import { WebhookEndpointRecord } from "@/features/studio/webhooks/webhook-endpoint-record";
import { WebhookEndpointRecordSkeleton } from "@/features/studio/webhooks/webhook-endpoint-record-skeleton";
import { WebhooksPageEmptyState } from "@/features/studio/webhooks/webhooks-page-empty-state";
import { listWebhookEndpointsOptions } from "@/features/studio/lib/tanstack-query";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";

export const Route = createFileRoute(
  "/studio/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/settings/webhooks/",
)({
  component: ProjectWebhooksPage,
  errorComponent: ProjectWebhooksPageError,
  pendingComponent: ProjectWebhooksPageSkeleton,
});

function ProjectWebhooksPageError() {
  return (
    <VoidhashErrorCard
      error={{
        code: "INTERNAL_SERVER_ERROR",
        message: "An error occurred loading the webhooks",
      }}
    />
  );
}

function ProjectWebhooksPageSkeleton() {
  return (
    <SettingsPage description="Manage your webhook endpoints." title="Webhooks">
      <SettingsCard className="grid gap-0 divide-y">
        {Array.from({ length: 3 }).map((_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: just a skeleton
          <WebhookEndpointRecordSkeleton key={index} />
        ))}
      </SettingsCard>
    </SettingsPage>
  );
}

function ProjectWebhooksPage() {
  const { organizationSlug, projectSlug } = Route.useParams();
  const { user } = useAuth();
  const project = CurrentUser.getProjectBySlugs(
    user,
    organizationSlug as string,
    projectSlug as string,
  );

  if (!project) {
    throw new Error("Project not found");
  }

  const { data: webhooks } = useSuspenseQuery(
    listWebhookEndpointsOptions({ projectId: project.id }),
  );

  return (
    <SettingsPage
      actions={<CreateWebhookModalButton projectId={project.id} />}
      description="Manage your webhook endpoints."
      title="Webhooks"
    >
      {webhooks.length === 0 ? (
        <WebhooksPageEmptyState projectId={project.id} />
      ) : (
        <SettingsCard className="grid gap-0 divide-y">
          {webhooks.map((webhook) => (
            <WebhookEndpointRecord
              key={webhook.id}
              organizationSlug={organizationSlug}
              projectId={project.id}
              projectSlug={projectSlug}
              webhook={webhook}
            />
          ))}
        </SettingsCard>
      )}
    </SettingsPage>
  );
}
