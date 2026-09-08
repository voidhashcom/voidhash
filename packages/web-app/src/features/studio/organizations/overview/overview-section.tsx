import { type DateRange, DateRangeFilter, type Granularity } from "./date-range-filter";
import { MetricCard } from "./metric-card";
import type { MetricValueFormat } from "./format";
import type { OverviewTimeSeriesPoint } from "./today-chart";
import { Card, CardAction, CardContent, CardHeader, CardTitle, cn } from "@voidhash/ui";

export interface OverviewMetricCardData {
  currentValue: number;
  id: string;
  label: string;
  percentChange: number | null;
  previousValue: number | null;
  timeSeries: OverviewTimeSeriesPoint[];
  valueFormat: MetricValueFormat;
}

interface OverviewSectionProps {
  columns?: 2 | 3;
  dateRange: DateRange;
  granularity: Granularity;
  isPending?: boolean;
  metrics: OverviewMetricCardData[];
  onDateRangeChange: (range: DateRange) => void;
  onGranularityChange: (granularity: Granularity) => void;
  title?: string;
}

interface OverviewMetricsGridProps {
  columns?: 2 | 3;
  isPending?: boolean;
  metrics: OverviewMetricCardData[];
}

/** Renders metric cards or their loading skeletons in the same grid. */
export const OverviewMetricsGrid = ({
  columns = 3,
  metrics,
  isPending,
}: OverviewMetricsGridProps) => (
  <div
    className={cn(
      "grid gap-0 py-0",
      columns === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 lg:grid-cols-3",
    )}
  >
    {metrics.map((metric, index) => (
      <MetricCard
        key={metric.id}
        isPending={isPending}
        className={cn(
          "border-border",
          index > 0 && "border-t",
          columns === 2 && index % 2 > 0 && "md:border-l",
          columns === 2 && index < 2 && "md:border-t-0",
          columns === 2 && index >= 2 && "md:border-t",
          columns === 3 && index % 3 > 0 && "lg:border-l",
          columns === 3 && index < 3 && "lg:border-t-0",
          columns === 3 && index >= 3 && "lg:border-t",
        )}
        currentValue={metric.currentValue}
        label={metric.label}
        percentChange={metric.percentChange}
        previousValue={metric.previousValue}
        timeSeries={metric.timeSeries}
        valueFormat={metric.valueFormat}
      />
    ))}
  </div>
);

/** Renders the overview filters and metric grid. */
export const OverviewSection = ({
  columns = 3,
  dateRange,
  granularity,
  metrics,
  isPending,
  onDateRangeChange,
  onGranularityChange,
  title = "Your overview",
}: OverviewSectionProps) => (
  <Card>
    <CardHeader>
      <CardTitle>{title}</CardTitle>
      <CardAction>
        <DateRangeFilter
          dateRange={dateRange}
          granularity={granularity}
          onDateRangeChange={onDateRangeChange}
          onGranularityChange={onGranularityChange}
        />
      </CardAction>
    </CardHeader>
    <CardContent className="px-0 py-0">
      <OverviewMetricsGrid columns={columns} metrics={metrics} isPending={isPending} />
    </CardContent>
  </Card>
);
