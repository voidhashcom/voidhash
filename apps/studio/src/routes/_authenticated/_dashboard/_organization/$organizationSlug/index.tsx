import { createFileRoute } from "@tanstack/react-router";

import { ProjectsList } from "@/features/organizations/projects/projects-list";
import { Page } from "@/features/shell";

export const Route = createFileRoute(
  "/_authenticated/_dashboard/_organization/$organizationSlug/"
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { organizationSlug } = Route.useParams();
  return (
    <Page>
      <div className="mx-auto max-w-4xl">
        <h1 className="font-normal text-3xl tracking-right">Projects</h1>
        <p className="mt-3 text-muted-foreground">
          All projects of organization {organizationSlug}
        </p>
        <div className="mt-8">
          <ProjectsList organizationSlug={organizationSlug as string} />
        </div>
      </div>
    </Page>
  );
}
