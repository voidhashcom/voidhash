import { createFileRoute } from "@tanstack/react-router";
import { Page, PageHeader, PageHeaderTitle } from "@voidhash/ui";
import { useAuth } from "@/features/studio/components/auth-context";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";
import { AssetLibrary } from "@/features/studio/paywall-assets/asset-library";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";

export const Route = createFileRoute(
  "/studio/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/assets/",
)({
  component: AssetsIndexPage,
  errorComponent: AssetsIndexPageError,
});

function AssetsIndexPageError() {
  return (
    <VoidhashErrorCard
      error={{
        code: "INTERNAL_SERVER_ERROR",
        message: "An error occurred loading assets",
      }}
    />
  );
}

/**
 * Organization-scoped image asset library, rendered full-page. Assets live at
 * the organization level but are surfaced under the project's Paywalls group,
 * since they are consumed as paywall backgrounds; the org id is resolved from
 * the current project.
 */
function AssetsIndexPage() {
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

  return (
    <Page>
      <PageHeader>
        <PageHeaderTitle>Assets</PageHeaderTitle>
      </PageHeader>
      <div className="mx-auto w-full max-w-6xl px-4 pt-4">
        <AssetLibrary organizationId={project.organizationId} />
      </div>
    </Page>
  );
}
