import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  cn,
} from "@voidhash/ui";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { formatMetricValue, formatPercentChange, type MetricValueFormat } from "./format";
import type { OverviewTimeSeriesPoint } from "./today-chart";

interface MetricCardProps {
  label: string;
  currentValue: number;
  previousValue: number | null;
  percentChange: number | null;
  valueFormat: MetricValueFormat;
  timeSeries: OverviewTimeSeriesPoint[];
  chartColor?: string;
  className?: string;
}

export const MetricCard = ({
  label,
  currentValue,
  previousValue,
  percentChange,
  valueFormat,
  timeSeries,
  className,
  chartColor = "var(--chart-1)",
}: MetricCardProps) => {
  const isPositive = percentChange === null ? true : percentChange >= 0;
  const dataKey = "value";

  const chartConfig = {
    [dataKey]: {
      color: chartColor,
      label,
    },
  } satisfies ChartConfig;

  return (
    <div className={cn("ring-0 rounded-none", className)}>
      <div className="px-4 py-4">
        <div className="text-muted-foreground text-sm">{label}</div>
        <div className="mt-1 flex items-baseline gap-3 my-2 pt-1">
          <span className="font-medium text-lg leading-none sm:text-2xl">
            {formatMetricValue(currentValue, valueFormat)}
          </span>
          <span
            className={`inline-flex items-center gap-0.5 text-sm ${isPositive ? "text-success" : "text-destructive"}`}
          >
            {percentChange === null ? "—" : formatPercentChange(percentChange)}
          </span>
        </div>
        <div className="mt-1 text-muted-foreground text-sm">
          {previousValue === null
            ? "— previous period"
            : `${formatMetricValue(previousValue, valueFormat)} previous period`}
        </div>
      </div>
      <div className="px-4 py-4">
        <ChartContainer config={chartConfig}>
          <LineChart accessibilityLayer data={timeSeries} margin={{ left: 12, right: 12 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="date"
              tickFormatter={(value: string) => {
                const d = new Date(value);
                return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
              }}
              tickLine={false}
              tickMargin={8}
            />
            <YAxis
              axisLine={false}
              orientation="right"
              tickLine={false}
              tickMargin={8}
              width={50}
            />
            <ChartTooltip content={<ChartTooltipContent hideLabel />} cursor={false} />
            <Line
              dataKey={dataKey}
              dot={false}
              stroke={`var(--color-${dataKey})`}
              strokeWidth={2}
              type="natural"
            />
          </LineChart>
        </ChartContainer>
      </div>
    </div>
  );
};
