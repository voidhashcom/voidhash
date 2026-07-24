"use client";

import { useQuery } from "@tanstack/react-query";
import {
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

import {
  buildLocationFunnelDefinition,
  buildLocationTimeseriesDefinition,
  buildLocationTotalsDefinition,
  isMetricRange,
  METRIC_RANGE_OPTIONS,
  type MetricRange,
} from "./paywall-location-metrics";

interface StatTileProps {
  label: string;
  loading: boolean;
  value: string;
}

function StatTile({ label, loading, value }: StatTileProps) {
  return (
    <div className="sm:border-border/60 sm:border-l sm:pl-4 sm:first:border-l-0 sm:first:pl-0">
      <p className="truncate text-muted-foreground text-xs">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-16" />
      ) : (
        <p className="mt-1 font-semibold text-2xl tabular-nums tracking-tight">{value}</p>
      )}
    </div>
  );
}

export interface PaywallLocationStatsProps {
  description: string;
  emptyDescription: string;
  emptyTitle: string;
  locationSlugs: string[];
  projectId: string;
}

/**
 * Performance section shared by the paywall and paywall-location detail
 * screens: KPI tiles (views, unique viewers, purchases, view→purchase
 * conversion) plus a views/purchases area chart, scoped to a set of paywall
 * locations. With no locations to scope to it renders the caller's empty state.
 */
export function PaywallLocationStats({
  description,
  emptyDescription,
  emptyTitle,
  locationSlugs,
  projectId,
}: PaywallLocationStatsProps) {
  const [range, setRange] = useState<MetricRange>("last_30d");
  const hasScope = locationSlugs.length > 0;

  const totalsQuery = useQuery({
    ...customAnalyticsInsightQueryOptions({
      definition: buildLocationTotalsDefinition(range, locationSlugs),
      projectId,
    }),
    enabled: hasScope,
  });
  const timeseriesQuery = useQuery({
    ...customAnalyticsInsightQueryOptions({
      definition: buildLocationTimeseriesDefinition(range, locationSlugs),
      projectId,
    }),
    enabled: hasScope,
  });
  const funnelQuery = useQuery({
    ...customAnalyticsInsightQueryOptions({
      definition: buildLocationFunnelDefinition(range, locationSlugs),
      projectId,
    }),
    enabled: hasScope,
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
    <section className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-medium text-sm">Performance</h2>
          <p className="mt-0.5 text-muted-foreground text-xs">{description}</p>
        </div>
        <ToggleGroup
          onValueChange={(value: string) => {
            if (value && isMetricRange(value)) {
              setRange(value);
            }
          }}
          type="single"
          value={range}
        >
          {METRIC_RANGE_OPTIONS.map((option) => (
            <ToggleGroupItem className="cursor-pointer" key={option.value} value={option.value}>
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {hasScope ? (
        <>
          <div className="grid grid-cols-2 gap-x-6 gap-y-5 border-border/60 border-y py-5 sm:grid-cols-4 sm:gap-x-0">
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

          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <p className="font-medium text-sm">Views &amp; purchases</p>
              <div className="flex items-center gap-3 text-muted-foreground text-xs">
                {(["views", "purchases"] as const).map((key) => (
                  <span className="inline-flex items-center gap-1.5" key={key}>
                    <span
                      aria-hidden="true"
                      className="size-2 rounded-[2px]"
                      style={{ backgroundColor: chartConfig[key].color }}
                    />
                    {chartConfig[key].label}
                  </span>
                ))}
              </div>
            </div>
            {timeseriesQuery.isPending ? (
              <Skeleton className="h-[240px] w-full" />
            ) : chartRows.length > 0 ? (
              <ChartContainer className="h-[240px] w-full" config={chartConfig}>
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
              <div className="flex h-[240px] items-center justify-center rounded-xl border border-dashed bg-muted/20 text-center">
                <div>
                  <ChartSplineIcon className="mx-auto text-muted-foreground" />
                  <p className="mt-3 text-sm">No events in this period yet</p>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex h-[240px] items-center justify-center rounded-xl border border-dashed bg-muted/20">
          <div className="text-center">
            <MapPinOffIcon className="mx-auto text-muted-foreground" />
            <p className="mt-3 font-medium text-sm">{emptyTitle}</p>
            <p className="mt-1 text-muted-foreground text-sm">{emptyDescription}</p>
          </div>
        </div>
      )}
    </section>
  );
}
