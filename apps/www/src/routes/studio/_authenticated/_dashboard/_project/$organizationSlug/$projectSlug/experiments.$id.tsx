import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { INTERNAL_FEATURE_FLAGS } from "@voidhash/rpc";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@voidhash/ui";
import { useAuth } from "@/features/studio/components/auth-context";

import { EnterpriseAuditLogSlot } from "@/features/studio/enterprise/enterprise-audit-log-slot";
import { ExperimentLifecycleControls } from "@/features/studio/experiments/experiment-lifecycle-controls";
import { ExperimentSettingsForm } from "@/features/studio/experiments/experiment-settings-form";
import { ExperimentSetupPanel } from "@/features/studio/experiments/experiment-setup-panel";
import { EXPERIMENT_STATUS } from "@/features/studio/experiments/experiment-status";
import { ExperimentStatusBadge } from "@/features/studio/experiments/experiment-status-badge";
import { ExperimentTreatmentsPanel } from "@/features/studio/experiments/experiment-treatments-panel";
import { Page } from "@/features/studio/shell";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";
import { useInternalFeatureFlag } from "@/features/studio/lib/useInternalFeatureFlag";
import { getExperimentOptions } from "@/features/studio/lib/tanstack-query";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";

export const Route = createFileRoute(
  "/studio/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/experiments/$id",
)({
  component: ExperimentDetailRoute,
  errorComponent: ExperimentDetailPageError,
});

/**
 * Gate the experiment detail page behind the `experimentation` internal feature
 * flag, matching the A/B Tests list route.
 */
function ExperimentDetailRoute() {
  const experimentationEnabled = useInternalFeatureFlag(
    INTERNAL_FEATURE_FLAGS.experimentation.key,
  );

  if (!experimentationEnabled) {
    return (
      <VoidhashErrorCard error={{ code: "NOT_FOUND", message: "This page is not available." }} />
    );
  }

  return <ExperimentDetailPage />;
}

function ExperimentDetailPageError() {
  return (
    <VoidhashErrorCard
      error={{
        code: "INTERNAL_SERVER_ERROR",
        message: "An error occurred loading the experiment",
      }}
    />
  );
}

function ExperimentDetailPage() {
  const { id, organizationSlug, projectSlug } = Route.useParams();
  const { user } = useAuth();
  const project = CurrentUser.getProjectBySlugs(
    user,
    organizationSlug as string,
    projectSlug as string,
  );

  if (!project) {
    throw new Error("Project not found");
  }

  const { data: experiment } = useSuspenseQuery(getExperimentOptions({ id: id as string }));

  const isRunning = experiment.status === EXPERIMENT_STATUS.running;
  const isConcluded = experiment.status === EXPERIMENT_STATUS.concluded;
  // Variants and weights are frozen while the experiment is actively assigning
  // (running) or already concluded.
  const setupLocked = isRunning || isConcluded;

  return (
    <Page
      breadcrumbs={[
        {
          title: "A/B Tests",
          url: `/${organizationSlug}/${projectSlug}/experiments`,
        },
        {
          title: experiment.name,
          url: `/${organizationSlug}/${projectSlug}/experiments/${id}`,
        },
      ]}
      className="p-0 py-8"
    >
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-normal text-3xl tracking-right">{experiment.name}</h1>
            <div className="mt-1 flex items-center gap-2">
              <span className="font-mono text-muted-foreground text-sm">{experiment.key}</span>
              <ExperimentStatusBadge status={experiment.status} />
            </div>
          </div>
          <ExperimentLifecycleControls
            archivedAt={experiment.archivedAt}
            experimentId={experiment.id}
            status={experiment.status}
            variants={experiment.variants}
          />
        </div>

        <div className="mt-8 grid grid-cols-12 gap-6">
          <div className="col-span-9 space-y-6">
            <Tabs defaultValue="setup">
              <TabsList>
                <TabsTrigger value="setup">Setup</TabsTrigger>
                <TabsTrigger value="treatments">Treatments</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>

              <TabsContent value="setup">
                <ExperimentSetupPanel
                  experimentId={experiment.id}
                  readOnly={setupLocked}
                  variants={[...experiment.variants]}
                />
              </TabsContent>

              <TabsContent value="treatments">
                <ExperimentTreatmentsPanel
                  experimentId={experiment.id}
                  projectId={project.id}
                  readOnly={isConcluded}
                  treatments={experiment.treatments}
                  variants={experiment.variants}
                />
              </TabsContent>

              <TabsContent value="settings">
                <ExperimentSettingsForm experiment={experiment} readOnly={isConcluded} />
              </TabsContent>
            </Tabs>
          </div>
          <div className="col-span-3 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Primary metric</p>
                  <p className="font-mono text-xs">{experiment.primaryMetricEventName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Version</p>
                  <p>{experiment.version}</p>
                </div>
                {experiment.startedAt && (
                  <div>
                    <p className="text-muted-foreground">Started</p>
                    <p>{new Date(experiment.startedAt).toLocaleDateString()}</p>
                  </div>
                )}
                {experiment.endedAt && (
                  <div>
                    <p className="text-muted-foreground">Ended</p>
                    <p>{new Date(experiment.endedAt).toLocaleDateString()}</p>
                  </div>
                )}
                {experiment.createdAt && (
                  <div>
                    <p className="text-muted-foreground">Created</p>
                    <p>{new Date(experiment.createdAt).toLocaleDateString()}</p>
                  </div>
                )}
              </CardContent>
            </Card>
            <EnterpriseAuditLogSlot
              entityId={experiment.id}
              entityType="experiment"
              projectId={project.id}
            />
          </div>
        </div>
      </div>
    </Page>
  );
}
