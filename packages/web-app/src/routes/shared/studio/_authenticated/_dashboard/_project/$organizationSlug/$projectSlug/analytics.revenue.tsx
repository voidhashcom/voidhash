import { createFileRoute } from "@tanstack/react-router";

import { REVENUE_ANALYTICS_INSIGHTS } from "@/features/studio/analytics/overview/query-builders";
import { ProjectAnalyticsPage } from "@/features/studio/analytics/project-analytics-page";

export const Route = createFileRoute(
  "/studio/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/analytics/revenue",
)({
  component: RevenueAnalyticsPage,
});

function RevenueAnalyticsPage() {
  const { organizationSlug, projectSlug } = Route.useParams();

  return (
    <ProjectAnalyticsPage
      columns={2}
      metrics={REVENUE_ANALYTICS_INSIGHTS}
      organizationSlug={organizationSlug}
      projectSlug={projectSlug}
      title="Revenue"
    />
  );
}
