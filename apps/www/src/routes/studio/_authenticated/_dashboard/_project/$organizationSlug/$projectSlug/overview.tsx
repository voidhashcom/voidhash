import { createFileRoute } from "@tanstack/react-router";

import { ProjectOverview } from "@/features/studio/projects/overview/project-overview";
import { Page } from "@/features/studio/shell";

export const Route = createFileRoute(
  "/studio/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/overview",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { organizationSlug, projectSlug } = Route.useParams();

  return (
    <Page className="px-0 pt-4">
      <ProjectOverview organizationSlug={organizationSlug} projectSlug={projectSlug} />
    </Page>
  );
}
