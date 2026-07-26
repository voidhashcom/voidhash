import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { INTERNAL_FEATURE_FLAGS } from "@voidhash/rpc";
import {
  Alert,
  AlertDescription,
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
import { InfoIcon } from "lucide-react";
import { useAuth } from "@/features/studio/components/auth-context";

import { EnterpriseAuditLogSlot } from "@/features/studio/enterprise/enterprise-audit-log-slot";
import { ExperimentDetailActionBar } from "@/features/studio/experiments/components/experiment-detail-page/experiment-detail-action-bar";
import { ExperimentDetailHeader } from "@/features/studio/experiments/components/experiment-detail-page/experiment-detail-header";
import { ExperimentDetailProperties } from "@/features/studio/experiments/components/experiment-detail-page/experiment-detail-properties";
import { ExperimentDraftProvider } from "@/features/studio/experiments/components/experiment-detail-page/experiment-draft-context";
import { ExperimentLifecycleControls } from "@/features/studio/experiments/components/experiment-detail-page/experiment-lifecycle-controls";
import { ExperimentMatrix } from "@/features/studio/experiments/components/experiment-detail-page/experiment-matrix";
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

  const isRunning = experiment.status === EXPERIMENT_STATUS.running;

  return (
    <ExperimentDraftProvider experiment={experiment}>
      <Page className="flex min-h-[calc(100svh-var(--header-height))] flex-col">
        {/* The tabs root sits between the page and the action bar, so it has to
            carry the flex column through for the bar's `mt-auto` to reach the
            bottom of the screen. */}
        <PageTabs className="flex flex-1 flex-col" defaultValue="overview">
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

          {/* A single tab for now — the bar stays so Results and friends can
              slot in beside Overview later. */}
          <PageBar className="border-b pl-4">
            <PageBarTabs>
              <PageBarTab value="overview">Overview</PageBarTab>
            </PageBarTabs>
          </PageBar>

          {/* Full-width container (unlike the max-w-6xl flag page): the matrix
              grows a column per location, so the main column takes all the
              room it can get while the properties rail stays fixed. */}
          <div className="w-full flex-1 px-8 py-12">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_19rem]">
              <div className="min-w-0 space-y-10">
                <ExperimentDetailHeader />

                <TabsContent value="overview">
                  <div className="space-y-4">
                    {isRunning && (
                      <Alert>
                        <InfoIcon className="size-4" />
                        <AlertDescription>
                          Variants and placements are locked while the A/B test is running. Pause
                          it to make changes.
                        </AlertDescription>
                      </Alert>
                    )}
                    <ExperimentMatrix projectId={project.id} />
                  </div>
                </TabsContent>

                <EnterpriseAuditLogSlot
                  entityId={experiment.id}
                  entityType="experiment"
                  projectId={project.id}
                />
              </div>

              <div>
                <div className="lg:sticky lg:top-24">
                  <ExperimentDetailProperties />
                </div>
              </div>
            </div>
          </div>

          <ExperimentDetailActionBar />
        </PageTabs>
      </Page>
    </ExperimentDraftProvider>
  );
}
