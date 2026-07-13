import { createFileRoute } from "@tanstack/react-router";
import { INTERNAL_FEATURE_FLAGS } from "@voidhash/rpc";

import { CustomInsightsPage } from "@/features/studio/analytics/custom-insights-page";
import { useInternalFeatureFlag } from "@/features/studio/lib/useInternalFeatureFlag";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";

export const Route = createFileRoute(
  "/studio/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/analytics/insights",
)({
  component: InsightsRoute,
});

function InsightsRoute() {
  const customAnalyticsEnabled = useInternalFeatureFlag(INTERNAL_FEATURE_FLAGS.customAnalytics.key);
  const { organizationSlug, projectSlug } = Route.useParams();

  if (!customAnalyticsEnabled) {
    return (
      <VoidhashErrorCard error={{ code: "NOT_FOUND", message: "This page is not available." }} />
    );
  }

  return <CustomInsightsPage organizationSlug={organizationSlug} projectSlug={projectSlug} />;
}
