import { createFileRoute } from "@tanstack/react-router";

import { OrganizationOverview } from "@/features/studio/organizations/overview/organization-overview";

export const Route = createFileRoute(
  "/studio/_authenticated/_dashboard/_organization/$organizationSlug/",
)({
  staticData: { allProjectsPicker: true },
  component: RouteComponent,
});

function RouteComponent() {
  const { organizationSlug } = Route.useParams();
  return <OrganizationOverview organizationSlug={organizationSlug as string} />;
}
