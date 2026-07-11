import { createFileRoute } from "@tanstack/react-router";

import { SUBSCRIBER_ANALYTICS_INSIGHTS } from "@/features/studio/analytics/overview/query-builders";
import { ProjectAnalyticsPage } from "@/features/studio/analytics/project-analytics-page";

export const Route = createFileRoute(
  "/studio/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/analytics/subscribers",
)({
  component: SubscribersAnalyticsPage,
});

function SubscribersAnalyticsPage() {
  const { organizationSlug, projectSlug } = Route.useParams();

  return (
    <ProjectAnalyticsPage
      columns={3}
      metrics={SUBSCRIBER_ANALYTICS_INSIGHTS}
      organizationSlug={organizationSlug}
      projectSlug={projectSlug}
      title="Subscribers"
    />
  );
}
