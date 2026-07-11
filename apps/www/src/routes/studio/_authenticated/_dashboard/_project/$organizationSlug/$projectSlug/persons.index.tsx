import { createFileRoute } from "@tanstack/react-router";
import { Page, PageHeader, PageHeaderTitle } from "@voidhash/ui";
import { useAuth } from "@/features/studio/components/auth-context";

import { CreatePersonButton } from "@/features/studio/persons/create-person-button";
import { PersonsTable } from "@/features/studio/persons/persons-table";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";

export const Route = createFileRoute(
  "/studio/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/persons/",
)({
  component: PersonsIndexPage,
});

function PersonsIndexPage() {
  const { organizationSlug, projectSlug } = Route.useParams();
  const { user } = useAuth();

  const project = CurrentUser.getProjectBySlugs(
    user,
    organizationSlug as string,
    projectSlug as string,
  );

  if (!project) {
    return (
      <VoidhashErrorCard
        error={{
          code: "INTERNAL_SERVER_ERROR",
          message: "The project you are looking for does not exist.",
          title: "Project not found",
        }}
      />
    );
  }

  return (
    <Page className="flex h-[calc(100svh-var(--header-height))] flex-col overflow-hidden">
      <PageHeader rightActions={<CreatePersonButton projectId={project.id} />}>
        <PageHeaderTitle>People</PageHeaderTitle>
      </PageHeader>
      <div className="min-w-0 flex-1 overflow-y-auto px-4 pt-4">
        <PersonsTable
          organizationSlug={organizationSlug as string}
          projectId={project.id}
          projectSlug={projectSlug as string}
        />
      </div>
    </Page>
  );
}
