"use client";

import { useQuery } from "@tanstack/react-query";
import type { AnalyticsFilterType, CustomAnalyticsInsightQueryType } from "@voidhash/rpc";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  Skeleton,
  ToggleGroup,
  ToggleGroupItem,
} from "@voidhash/ui";
import { ChartSplineIcon, MapPinOffIcon } from "lucide-react";
import { useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { customAnalyticsInsightQueryOptions } from "@/features/studio/lib/tanstack-query/analytics";

// Conventional event names emitted by paywall compositions through the SDK
// bridge. Every bridge event is stamped with the `paywall_location` property
// of the location that served the paywall, which is what scopes these queries
// to a single paywall.
const PAYWALL_VIEWED_EVENT = "paywall_viewed";
const PURCHASE_COMPLETED_EVENT = "purchase_completed";

const CONVERSION_WINDOW_SECONDS = 7 * 86_400;

const RANGE_OPTIONS = [
  { label: "7D", value: "last_7d" },
  { label: "30D", value: "last_30d" },
  { label: "90D", value: "last_90d" },
] as const;

type StatsRange = (typeof RANGE_OPTIONS)[number]["value"];

const isStatsRange = (value: string): value is StatsRange =>
  RANGE_OPTIONS.some((option) => option.value === value);

const locationFilter = (locationSlugs: string[]): AnalyticsFilterType => ({
  field: "event.properties.paywall_location",
  op: "in",
  type: "predicate",
  value: locationSlugs,
});

const buildTotalsDefinition = (
  range: StatsRange,
  locationSlugs: string[],
): CustomAnalyticsInsightQueryType => ({
  display: "number",
  granularity: "day",
  kind: "trends",
  series: [
    {
      aggregation: "total_events",
      eventNames: [PAYWALL_VIEWED_EVENT],
      filters: locationFilter(locationSlugs),
      key: "views",
      label: "Views",
    },
    {
      aggregation: "unique_users",
      eventNames: [PAYWALL_VIEWED_EVENT],
      filters: locationFilter(locationSlugs),
      key: "viewers",
      label: "Unique viewers",
    },
    {
      aggregation: "total_events",
      eventNames: [PURCHASE_COMPLETED_EVENT],
      filters: locationFilter(locationSlugs),
      key: "purchases",
      label: "Purchases",
    },
  ],
  timeRange: { preset: range },
});

const buildTimeseriesDefinition = (
  range: StatsRange,
  locationSlugs: string[],
): CustomAnalyticsInsightQueryType => ({
  display: "area",
  granularity: "day",
  kind: "trends",
  series: [
    {
      aggregation: "total_events",
      eventNames: [PAYWALL_VIEWED_EVENT],
      filters: locationFilter(locationSlugs),
      key: "views",
      label: "Views",
    },
    {
      aggregation: "total_events",
      eventNames: [PURCHASE_COMPLETED_EVENT],
      filters: locationFilter(locationSlugs),
      key: "purchases",
      label: "Purchases",
    },
  ],
  timeRange: { preset: range },
});

// The purchase step is intentionally unfiltered: the funnel is sequential per
// user, so it measures "viewed this paywall, then purchased" even when the
// purchase event isn't stamped with the paywall location.
const buildFunnelDefinition = (
  range: StatsRange,
  locationSlugs: string[],
): CustomAnalyticsInsightQueryType => ({
  conversionWindowSeconds: CONVERSION_WINDOW_SECONDS,
  kind: "funnels",
  order: "sequential",
  steps: [
    {
      eventNames: [PAYWALL_VIEWED_EVENT],
      filters: locationFilter(locationSlugs),
      key: "viewed",
      label: "Viewed paywall",
    },
    {
      eventNames: [PURCHASE_COMPLETED_EVENT],
      key: "purchased",
      label: "Purchased",
    },
  ],
  timeRange: { preset: range },
});

interface StatTileProps {
  label: string;
  loading: boolean;
  value: string;
}

function StatTile({ label, loading, value }: StatTileProps) {
  return (
    <div className="rounded-xl border bg-muted/20 p-5">
      <p className="truncate text-muted-foreground text-sm">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-20" />
      ) : (
        <p className="mt-2 font-semibold text-3xl tabular-nums tracking-tight">{value}</p>
      )}
    </div>
  );
}

interface PaywallDetailStatsProps {
  locationSlugs: string[];
  projectId: string;
}

/**
 * Performance section of the paywall detail page: KPI tiles (views, unique
 * viewers, purchases, view→purchase conversion) plus a views/purchases area
 * chart, scoped to the locations currently showing the paywall.
 */
export function PaywallDetailStats({ locationSlugs, projectId }: PaywallDetailStatsProps) {
  const [range, setRange] = useState<StatsRange>("last_30d");
  const isLive = locationSlugs.length > 0;

  const totalsQuery = useQuery({
    ...customAnalyticsInsightQueryOptions({
      definition: buildTotalsDefinition(range, locationSlugs),
      projectId,
    }),
    enabled: isLive,
  });
  const timeseriesQuery = useQuery({
    ...customAnalyticsInsightQueryOptions({
      definition: buildTimeseriesDefinition(range, locationSlugs),
      projectId,
    }),
    enabled: isLive,
  });
  const funnelQuery = useQuery({
    ...customAnalyticsInsightQueryOptions({
      definition: buildFunnelDefinition(range, locationSlugs),
      projectId,
    }),
    enabled: isLive,
  });

  const totals = totalsQuery.data?.kind === "trends" ? totalsQuery.data : undefined;
  const timeseries = timeseriesQuery.data?.kind === "trends" ? timeseriesQuery.data : undefined;
  const funnel = funnelQuery.data?.kind === "funnels" ? funnelQuery.data : undefined;

  const totalFor = (key: string) =>
    totals?.series.find((series) => series.key === key)?.points[0]?.value ?? 0;

  const chartRows = (() => {
    if (!timeseries) {
      return [];
    }
    const rows = new Map<number, { date: string; purchases: number; views: number }>();
    for (const series of timeseries.series) {
      for (const point of series.points) {
        const timestamp = point.timestamp.getTime();
        const row = rows.get(timestamp) ?? {
          date: point.timestamp.toISOString(),
          purchases: 0,
          views: 0,
        };
        if (series.key === "views") {
          row.views = point.value;
        }
        if (series.key === "purchases") {
          row.purchases = point.value;
        }
        rows.set(timestamp, row);
      }
    }
    return [...rows.entries()].sort(([a], [b]) => a - b).map(([, row]) => row);
  })();

  const chartConfig = {
    purchases: { color: "var(--chart-2)", label: "Purchases" },
    views: { color: "var(--chart-1)", label: "Views" },
  } satisfies ChartConfig;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-lg">Performance</h2>
        <ToggleGroup
          onValueChange={(value: string) => {
            if (value && isStatsRange(value)) {
              setRange(value);
            }
          }}
          type="single"
          value={range}
          variant="outline"
        >
          {RANGE_OPTIONS.map((option) => (
            <ToggleGroupItem className="cursor-pointer" key={option.value} value={option.value}>
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {isLive ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Views"
              loading={totalsQuery.isPending}
              value={totalFor("views").toLocaleString()}
            />
            <StatTile
              label="Unique viewers"
              loading={totalsQuery.isPending}
              value={totalFor("viewers").toLocaleString()}
            />
            <StatTile
              label="Purchases"
              loading={totalsQuery.isPending}
              value={totalFor("purchases").toLocaleString()}
            />
            <StatTile
              label="Conversion rate"
              loading={funnelQuery.isPending}
              value={`${((funnel?.totalConversionRate ?? 0) * 100).toFixed(1)}%`}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Views &amp; purchases</CardTitle>
              <CardDescription>
                Events captured at locations currently showing this paywall.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {timeseriesQuery.isPending ? (
                <Skeleton className="h-[280px] w-full" />
              ) : chartRows.length > 0 ? (
                <ChartContainer className="h-[280px] w-full" config={chartConfig}>
                  <AreaChart accessibilityLayer data={chartRows} margin={{ left: 8, right: 20 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      axisLine={false}
                      dataKey="date"
                      tickFormatter={(value: string) =>
                        new Date(value).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                        })
                      }
                      tickLine={false}
                      tickMargin={10}
                    />
                    <YAxis axisLine={false} tickLine={false} width={42} />
                    <ChartTooltip content={<ChartTooltipContent hideLabel />} cursor={false} />
                    <Area
                      dataKey="views"
                      fill="var(--chart-1)"
                      fillOpacity={0.18}
                      stroke="var(--chart-1)"
                      strokeWidth={2}
                      type="monotone"
                    />
                    <Area
                      dataKey="purchases"
                      fill="var(--chart-2)"
                      fillOpacity={0.18}
                      stroke="var(--chart-2)"
                      strokeWidth={2}
                      type="monotone"
                    />
                  </AreaChart>
                </ChartContainer>
              ) : (
                <div className="flex h-[280px] items-center justify-center rounded-xl border border-dashed bg-muted/20 text-center">
                  <div>
                    <ChartSplineIcon className="mx-auto text-muted-foreground" />
                    <p className="mt-3 text-sm">No events in this period yet</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="flex h-[280px] items-center justify-center">
            <div className="text-center">
              <MapPinOffIcon className="mx-auto text-muted-foreground" />
              <p className="mt-3 font-medium text-sm">Not live yet</p>
              <p className="mt-1 text-muted-foreground text-sm">
                Assign this paywall to a location to start collecting stats.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
