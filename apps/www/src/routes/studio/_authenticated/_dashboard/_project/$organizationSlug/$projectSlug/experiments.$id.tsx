import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { INTERNAL_FEATURE_FLAGS } from "@voidhash/rpc";
import {
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Page,
  PageBar,
  PageBarTab,
  PageBarTabs,
  PageHeader,
  PageTabs,
  TabsContent,
} from "@voidhash/ui";
import { useAuth } from "@/features/studio/components/auth-context";

import { EnterpriseAuditLogSlot } from "@/features/studio/enterprise/enterprise-audit-log-slot";
import { ExperimentDetailProperties } from "@/features/studio/experiments/components/experiment-detail-page/experiment-detail-properties";
import { ExperimentLifecycleControls } from "@/features/studio/experiments/components/experiment-detail-page/experiment-lifecycle-controls";
import { ExperimentSettingsForm } from "@/features/studio/experiments/components/experiment-detail-page/experiment-settings-form";
import { ExperimentSetupPanel } from "@/features/studio/experiments/components/experiment-detail-page/experiment-setup-panel";
import { ExperimentTreatmentsPanel } from "@/features/studio/experiments/components/experiment-detail-page/experiment-treatments-panel";
import { EXPERIMENT_STATUS } from "@/features/studio/experiments/lib/experiment-status";
import { getExperimentOptions } from "@/features/studio/lib/tanstack-query";
import { useInternalFeatureFlag } from "@/features/studio/lib/useInternalFeatureFlag";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";

export const Route = createFileRoute(
  "/studio/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/experiments/$id",
)({
  component: ExperimentDetailRoute,
  errorComponent: ExperimentDetailPageError,
});

/**
 * Gate the A/B test detail page behind the `experimentation` internal feature
 * flag, matching the A/B Tests list route.
 */
function ExperimentDetailRoute() {
  const experimentationEnabled = useInternalFeatureFlag(INTERNAL_FEATURE_FLAGS.experimentation.key);

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
        message: "An error occurred loading the A/B test",
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

  const isArchived = experiment.archivedAt !== null;
  const isRunning = experiment.status === EXPERIMENT_STATUS.running;
  const isConcluded = experiment.status === EXPERIMENT_STATUS.concluded;
  // Variants and weights are frozen once archived, while actively assigning,
  // or after the experiment has concluded.
  const setupLocked = isArchived || isRunning || isConcluded;

  return (
    <Page>
      <PageTabs defaultValue="setup">
        <PageHeader
          className="px-2"
          rightActions={
            <ExperimentLifecycleControls
              archivedAt={experiment.archivedAt}
              experimentId={experiment.id}
              status={experiment.status}
              variants={experiment.variants}
            />
          }
        >
          <div className="flex items-center gap-2">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link
                      params={{ organizationSlug, projectSlug }}
                      to="/studio/$organizationSlug/$projectSlug/experiments"
                    >
                      A/B Tests
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{experiment.name}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            {experiment.archivedAt && <Badge variant="secondary">Archived</Badge>}
          </div>
        </PageHeader>

        <PageBar className="border-b pl-4">
          <PageBarTabs>
            <PageBarTab value="setup">Setup</PageBarTab>
            <PageBarTab value="treatments">Treatments</PageBarTab>
            <PageBarTab value="settings">Settings</PageBarTab>
          </PageBarTabs>
        </PageBar>

        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
          <div className="max-w-4xl space-y-10">
            <div className="space-y-6">
              <div>
                <h1 className="font-semibold text-3xl tracking-tight">{experiment.name}</h1>
                <p className="mt-1 text-muted-foreground text-sm">
                  {experiment.description ||
                    (experiment.primaryMetricEventName
                      ? `Measure ${experiment.primaryMetricEventName} across ${experiment.variants.length} variants.`
                      : `Compare ${experiment.variants.length} variants against each other.`)}
                </p>
              </div>
              <ExperimentDetailProperties
                archivedAt={experiment.archivedAt}
                createdAt={experiment.createdAt}
                endedAt={experiment.endedAt}
                primaryMetricEventName={experiment.primaryMetricEventName}
                startedAt={experiment.startedAt}
                status={experiment.status}
                variantCount={experiment.variants.length}
                version={experiment.version}
              />
            </div>

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
                readOnly={isArchived || isConcluded}
                treatments={experiment.treatments}
                variants={experiment.variants}
              />
            </TabsContent>

            <TabsContent value="settings">
              <ExperimentSettingsForm
                experiment={experiment}
                readOnly={isArchived || isConcluded}
              />
            </TabsContent>

            <EnterpriseAuditLogSlot
              entityId={experiment.id}
              entityType="experiment"
              projectId={project.id}
            />
          </div>
        </div>
      </PageTabs>
    </Page>
  );
}
