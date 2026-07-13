import { createFileRoute } from "@tanstack/react-router";

import { CustomInsightsPage } from "@/features/studio/analytics/custom-insights-page";

export const Route = createFileRoute(
  "/studio/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/analytics/insights",
)({
  component: InsightsRoute,
});

function InsightsRoute() {
  const { organizationSlug, projectSlug } = Route.useParams();
  return <CustomInsightsPage organizationSlug={organizationSlug} projectSlug={projectSlug} />;
}
