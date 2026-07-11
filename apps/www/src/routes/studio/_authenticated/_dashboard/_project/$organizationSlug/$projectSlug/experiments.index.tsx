import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { INTERNAL_FEATURE_FLAGS } from "@voidhash/rpc";
import { Card, Page, PageHeader, PageHeaderTitle } from "@voidhash/ui";
import { useAuth } from "@/features/studio/components/auth-context";

import { CreateExperimentModal } from "@/features/studio/experiments/create-experiment-modal";
import { ExperimentRecord } from "@/features/studio/experiments/experiment-record";
import { ExperimentsPageEmptyState } from "@/features/studio/experiments/experiments-page-empty-state";
import { ExperimentsPageSkeleton } from "@/features/studio/experiments/experiments-page-skeleton";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";
import { useInternalFeatureFlag } from "@/features/studio/lib/useInternalFeatureFlag";
import { listExperimentsOptions } from "@/features/studio/lib/tanstack-query";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";

export const Route = createFileRoute(
  "/studio/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/experiments/",
)({
  component: ExperimentsIndexRoute,
  errorComponent: ExperimentsIndexPageError,
  pendingComponent: ExperimentsPageSkeleton,
});

function ExperimentsIndexPageError() {
  return (
    <VoidhashErrorCard
      error={{
        code: "INTERNAL_SERVER_ERROR",
        message: "An error occurred loading A/B Tests",
      }}
    />
  );
}

/**
 * Gate the A/B Tests surface behind the `experimentation` internal feature flag,
 * matching the Feature Flags routes in the same suite.
 */
function ExperimentsIndexRoute() {
  const experimentationEnabled = useInternalFeatureFlag(
    INTERNAL_FEATURE_FLAGS.experimentation.key,
  );

  if (!experimentationEnabled) {
    return (
      <VoidhashErrorCard error={{ code: "NOT_FOUND", message: "This page is not available." }} />
    );
  }

  return <ExperimentsIndexPage />;
}

function ExperimentsIndexPage() {
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

  const { data: experiments } = useSuspenseQuery(listExperimentsOptions({ projectId: project.id }));

  return (
    <Page>
      <PageHeader
        rightActions={
          experiments.length > 0 ? <CreateExperimentModal projectId={project.id} /> : null
        }
      >
        <PageHeaderTitle>A/B Tests</PageHeaderTitle>
      </PageHeader>
      <div className="mx-auto w-full max-w-4xl px-4 pt-4">
        {experiments.length === 0 ? (
          <ExperimentsPageEmptyState projectId={project.id} />
        ) : (
          <Card className="grid gap-0 divide-y p-0">
            {experiments.map((experiment) => (
              <ExperimentRecord
                experiment={experiment}
                key={experiment.id}
                organizationSlug={organizationSlug as string}
                projectSlug={projectSlug as string}
              />
            ))}
          </Card>
        )}
      </div>
    </Page>
  );
}
