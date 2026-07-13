import { createFileRoute } from "@tanstack/react-router";

import { CustomDashboardsPage } from "@/features/studio/analytics/custom-dashboards-page";

export const Route = createFileRoute(
  "/studio/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/analytics/dashboards",
)({
  component: DashboardsRoute,
});

function DashboardsRoute() {
  const { organizationSlug, projectSlug } = Route.useParams();
  return <CustomDashboardsPage organizationSlug={organizationSlug} projectSlug={projectSlug} />;
}
