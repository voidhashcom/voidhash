import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { QueryAnalyticsInsightsResponseType } from "@voidhash/rpc";

import {
  buildOverviewMetricCards,
  buildTodayChartData,
  mapAnalyticsResultsByKey,
} from "@/features/studio/analytics/overview/result-mappers";
import { buildOverviewAnalyticsRequest } from "@/features/studio/analytics/overview/query-builders";
import { useAuth } from "@/features/studio/components/auth-context";
import { queryAnalyticsInsightsOptions } from "@/features/studio/lib/tanstack-query";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";
import {
  OverviewSection,
  type OverviewMetricCardData,
} from "@/features/studio/organizations/overview/overview-section";
import { TodayChart } from "@/features/studio/organizations/overview/today-chart";
import {
  type DateRange,
  type Granularity,
} from "@/features/studio/organizations/overview/date-range-filter";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";
import { Card, CardContent, CardHeader, CardTitle } from "@voidhash/ui";

interface ProjectOverviewProps {
  organizationSlug: string;
  projectSlug: string;
}

/** Displays a project overview without rebuilding time ranges on result updates. */
export const ProjectOverview = ({ organizationSlug, projectSlug }: ProjectOverviewProps) => {
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange>("last_7d");
  const [granularity, setGranularity] = useState<Granularity>("daily");
  const activeOrganization = user.organizations.find((org) => org.slug === organizationSlug);
  const project = CurrentUser.getProjectBySlugs(user, organizationSlug, projectSlug);

  const analyticsRequest = useMemo(
    () =>
      buildOverviewAnalyticsRequest({
        dateRange,
        granularity,
        organizationId: activeOrganization?.id ?? "",
        projectId: project?.id,
      }),
    [dateRange, granularity, activeOrganization?.id, project?.id],
  );

  const analyticsQuery = useQuery({
    ...queryAnalyticsInsightsOptions(analyticsRequest),
    enabled: Boolean(activeOrganization && project),
  });

  if (!activeOrganization || !project) {
    return <VoidhashErrorCard error={{ code: "NOT_FOUND", message: "Project not found" }} />;
  }

  if (analyticsQuery.error) {
    return (
      <VoidhashErrorCard
        error={{
          code: "ANALYTICS_ERROR",
          message: analyticsQuery.error.message,
        }}
      />
    );
  }

  if (analyticsQuery.isPending) return <p role="status">Loading analytics...</p>;

  const analyticsData = analyticsQuery.data as QueryAnalyticsInsightsResponseType | undefined;
  const resultsByKey = mapAnalyticsResultsByKey(analyticsData?.results ?? []);
  const todayChart = buildTodayChartData(resultsByKey);
  const metrics: OverviewMetricCardData[] = buildOverviewMetricCards(resultsByKey);

  return (
    <div className="mx-auto max-w-7xl px-4">
      <div className="w-full">
        <Card>
          <CardHeader>
            <CardTitle>Today</CardTitle>
          </CardHeader>
          <CardContent className="px-0 py-0">
            <TodayChart
              grossRevenue={todayChart.grossRevenue}
              timeSeries={todayChart.timeSeries}
              yesterdayRevenue={todayChart.yesterdayRevenue}
            />
          </CardContent>
        </Card>
      </div>
      <div className="mt-4">
        <OverviewSection
          dateRange={dateRange}
          granularity={granularity}
          metrics={metrics}
          onDateRangeChange={setDateRange}
          onGranularityChange={setGranularity}
        />
      </div>
    </div>
  );
};
