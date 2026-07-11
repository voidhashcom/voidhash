import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { INTERNAL_FEATURE_FLAGS } from "@voidhash/rpc";
import { Card, Page, PageHeader, PageHeaderTitle } from "@voidhash/ui";
import { useAuth } from "@/features/studio/components/auth-context";

import { CreateFlagModal } from "@/features/studio/feature-flags/create-flag-modal";
import { FlagRecord } from "@/features/studio/feature-flags/flag-record";
import { FlagsPageEmptyState } from "@/features/studio/feature-flags/flags-page-empty-state";
import { FlagsPageSkeleton } from "@/features/studio/feature-flags/flags-page-skeleton";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";
import { useInternalFeatureFlag } from "@/features/studio/lib/useInternalFeatureFlag";
import { listFeatureFlagsOptions } from "@/features/studio/lib/tanstack-query";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";

export const Route = createFileRoute(
  "/studio/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/flags/",
)({
  component: FlagsIndexRoute,
  errorComponent: FlagsIndexPageError,
  pendingComponent: FlagsPageSkeleton,
});

/**
 * Gate the Feature Flags product behind the `experimentation` internal feature
 * flag so the page cannot be reached by direct URL for orgs that are not yet in
 * the tester rollout.
 */
function FlagsIndexRoute() {
  const experimentationEnabled = useInternalFeatureFlag(
    INTERNAL_FEATURE_FLAGS.experimentation.key,
  );

  if (!experimentationEnabled) {
    return (
      <VoidhashErrorCard error={{ code: "NOT_FOUND", message: "This page is not available." }} />
    );
  }

  return <FlagsIndexPage />;
}

function FlagsIndexPageError() {
  return (
    <VoidhashErrorCard
      error={{
        code: "INTERNAL_SERVER_ERROR",
        message: "An error occurred loading feature flags",
      }}
    />
  );
}

function FlagsIndexPage() {
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

  const { data: flags } = useSuspenseQuery(listFeatureFlagsOptions({ projectId: project.id }));

  return (
    <Page>
      <PageHeader
        rightActions={flags.length > 0 ? <CreateFlagModal projectId={project.id} /> : null}
      >
        <PageHeaderTitle>Feature Flags</PageHeaderTitle>
      </PageHeader>
      <div className="mx-auto w-full max-w-4xl px-4 pt-4">
        {flags.length === 0 ? (
          <FlagsPageEmptyState projectId={project.id} />
        ) : (
          <Card className="grid gap-0 divide-y p-0">
            {flags.map((flag) => (
              <FlagRecord
                flag={flag}
                key={flag.id}
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
