import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Page, PageHeader, PageHeaderTitle } from "@voidhash/ui";
import { useAuth } from "@/features/studio/components/auth-context";

import { listPaywallDeploysOptions } from "@/features/studio/lib/tanstack-query";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";
import { PaywallDeployRecord } from "@/features/studio/paywall-deploys/paywall-deploy-record";
import { SettingsCard } from "@/features/studio/settings";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";

export const Route = createFileRoute(
  "/studio/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/deploys",
)({
  component: ProjectDeploysPage,
  errorComponent: ProjectDeploysPageError,
  pendingComponent: ProjectDeploysPageSkeleton,
});

function ProjectDeploysPageError() {
  return (
    <VoidhashErrorCard
      error={{
        code: "INTERNAL_SERVER_ERROR",
        message: "An error occurred loading deploys",
      }}
    />
  );
}

function ProjectDeploysPageSkeleton() {
  return (
    <Page>
      <PageHeader>
        <PageHeaderTitle>Deploys</PageHeaderTitle>
      </PageHeader>
      <div className="mx-auto w-full max-w-4xl px-4 pt-4">
        <SettingsCard>
          <div className="px-5 py-10 text-center text-[13px] text-muted-foreground">
            Loading deploys...
          </div>
        </SettingsCard>
      </div>
    </Page>
  );
}

function ProjectDeploysPage() {
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

  const { data: deploys } = useSuspenseQuery(listPaywallDeploysOptions({ projectId: project.id }));

  return (
    <Page>
      <PageHeader>
        <PageHeaderTitle>Deploys</PageHeaderTitle>
      </PageHeader>
      <div className="mx-auto w-full max-w-4xl px-4 pt-4 pb-16">
        {deploys.length === 0 ? (
          <SettingsCard>
            <div className="px-5 py-10 text-center text-[13px] text-muted-foreground">
              No code deploys yet. Run <span className="font-mono">voidhash deploy</span> from your
              project to push paywalls built in code.
            </div>
          </SettingsCard>
        ) : (
          <SettingsCard className="grid gap-0 divide-y">
            {deploys.map((deploy) => (
              <PaywallDeployRecord deploy={deploy} key={deploy.id} projectId={project.id} />
            ))}
          </SettingsCard>
        )}
      </div>
    </Page>
  );
}
