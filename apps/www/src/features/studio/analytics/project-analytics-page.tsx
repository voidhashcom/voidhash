import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { QueryAnalyticsInsightsResponseType } from "@voidhash/rpc";
import {
  Card,
  CardContent,
  Page,
  PageHeader,
  PageHeaderTitle,
} from "@voidhash/ui";

import {
  buildMetricCards,
  mapAnalyticsResultsByKey,
} from "@/features/studio/analytics/overview/result-mappers";
import {
  buildMetricsAnalyticsRequest,
  type AnalyticsMetricDefinition,
} from "@/features/studio/analytics/overview/query-builders";
import { useAuth } from "@/features/studio/components/auth-context";
import { queryAnalyticsInsightsOptions } from "@/features/studio/lib/tanstack-query";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";
import {
  OverviewMetricsGrid,
  type OverviewMetricCardData,
} from "@/features/studio/organizations/overview/overview-section";
import {
  DateRangeFilter,
  type DateRange,
  type Granularity,
} from "@/features/studio/organizations/overview/date-range-filter";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";

interface ProjectAnalyticsPageProps {
  columns?: 2 | 3;
  metrics: readonly AnalyticsMetricDefinition[];
  organizationSlug: string;
  projectSlug: string;
  title: string;
}

export const ProjectAnalyticsPage = ({
  columns = 2,
  metrics,
  organizationSlug,
  projectSlug,
  title,
}: ProjectAnalyticsPageProps) => {
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange>("last_7d");
  const [granularity, setGranularity] = useState<Granularity>("daily");
  const activeOrganization = user.organizations.find(
    (organization) => organization.slug === organizationSlug,
  );
  const project = CurrentUser.getProjectBySlugs(user, organizationSlug, projectSlug);

  if (!activeOrganization || !project) {
    return <VoidhashErrorCard error={{ code: "NOT_FOUND", message: "Project not found" }} />;
  }

  const analyticsQuery = useQuery(
    queryAnalyticsInsightsOptions(
      buildMetricsAnalyticsRequest({
        dateRange,
        granularity,
        metrics,
        organizationId: activeOrganization.id,
        projectId: project.id,
      }),
    ),
  );

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

  const analyticsData = analyticsQuery.data as QueryAnalyticsInsightsResponseType | undefined;
  const resultsByKey = mapAnalyticsResultsByKey(analyticsData?.results ?? []);
  const metricCards: OverviewMetricCardData[] = buildMetricCards(metrics, resultsByKey);

  return (
    <Page>
      <PageHeader
        rightActions={
          <DateRangeFilter
            dateRange={dateRange}
            granularity={granularity}
            onDateRangeChange={setDateRange}
            onGranularityChange={setGranularity}
          />
        }
      >
        <PageHeaderTitle>{title}</PageHeaderTitle>
      </PageHeader>
      <div className="mx-auto w-full max-w-7xl px-4 pt-4">
        <Card>
          <CardContent className="px-0 py-0">
            <OverviewMetricsGrid columns={columns} metrics={metricCards} />
          </CardContent>
        </Card>
      </div>
    </Page>
  );
};
