import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { QueryAnalyticsInsightsResponseType } from "@voidhash/rpc";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Page,
  PageHeader,
  PageHeaderTitle,
} from "@voidhash/ui";

import {
  buildOverviewMetricCards,
  buildTodayChartData,
  mapAnalyticsResultsByKey,
} from "@/features/studio/analytics/overview/result-mappers";
import { buildOverviewAnalyticsRequest } from "@/features/studio/analytics/overview/query-builders";
import { useAuth } from "@/features/studio/components/auth-context";
import { queryAnalyticsInsightsOptions } from "@/features/studio/lib/tanstack-query";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";

import { type DateRange, type Granularity } from "./date-range-filter";
import { OverviewSection } from "./overview-section";
import { TodayChart } from "./today-chart";

interface OrganizationOverviewProps {
  organizationSlug: string;
}

export const OrganizationOverview = ({ organizationSlug }: OrganizationOverviewProps) => {
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange>("last_7d");
  const [granularity, setGranularity] = useState<Granularity>("daily");

  const activeOrganization = user.organizations.find((org) => org.slug === organizationSlug);

  // Hooks must run unconditionally, so the analytics query is declared before
  // the missing-org guard and gated with `enabled`.
  const analyticsQuery = useQuery({
    ...queryAnalyticsInsightsOptions(
      buildOverviewAnalyticsRequest({
        dateRange,
        granularity,
        organizationId: activeOrganization?.id ?? "",
      }),
    ),
    enabled: Boolean(activeOrganization),
  });

  if (!activeOrganization) {
    return <VoidhashErrorCard error={{ code: "NOT_FOUND", message: "Organization not found" }} />;
  }

  const analyticsData = analyticsQuery.data as QueryAnalyticsInsightsResponseType | undefined;
  const resultsByKey = mapAnalyticsResultsByKey(analyticsData?.results ?? []);
  const todayChart = buildTodayChartData(resultsByKey);
  const metrics = buildOverviewMetricCards(resultsByKey);

  return (
    <Page>
      <PageHeader>
        <PageHeaderTitle>{activeOrganization.name}</PageHeaderTitle>
      </PageHeader>
      <div className="mx-auto w-full max-w-7xl px-4 pt-4">
        {analyticsQuery.isError ? (
          // Keep the org shell rendered — a transient analytics/provisioning
          // hiccup shouldn't blank the whole page. Offer a retry inline.
          <Card>
            <CardHeader>
              <CardTitle>Analytics temporarily unavailable</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-start gap-3">
              <p className="text-muted-foreground text-sm">
                We couldn't load analytics for this organization. This can happen briefly while a
                new organization is being set up.
              </p>
              <Button onClick={() => analyticsQuery.refetch()} variant="outline">
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
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
            <div className="mt-4">
              <OverviewSection
                dateRange={dateRange}
                granularity={granularity}
                metrics={metrics}
                onDateRangeChange={setDateRange}
                onGranularityChange={setGranularity}
              />
            </div>
          </>
        )}
      </div>
    </Page>
  );
};
