import { createFileRoute } from "@tanstack/react-router";
import { INTERNAL_FEATURE_FLAGS } from "@voidhash/rpc";

import { CustomDashboardsPage } from "@/features/studio/analytics/custom-dashboards-page";
import { useInternalFeatureFlag } from "@/features/studio/lib/useInternalFeatureFlag";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";

export const Route = createFileRoute(
  "/studio/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/analytics/dashboards",
)({
  component: DashboardsRoute,
});

function DashboardsRoute() {
  const customAnalyticsEnabled = useInternalFeatureFlag(INTERNAL_FEATURE_FLAGS.customAnalytics.key);
  const { organizationSlug, projectSlug } = Route.useParams();

  if (!customAnalyticsEnabled) {
    return (
      <VoidhashErrorCard error={{ code: "NOT_FOUND", message: "This page is not available." }} />
    );
  }

  return <CustomDashboardsPage organizationSlug={organizationSlug} projectSlug={projectSlug} />;
}
