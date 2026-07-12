import {
  Card,
  CardContent,
  CardHeader,
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  cn,
} from "@voidhash/ui";
import { CartesianGrid, Line, LineChart, XAxis } from "recharts";

import { formatCurrency } from "./format";

export interface OverviewTimeSeriesPoint {
  date: string;
  value: number;
}

interface TodayChartProps {
  className?: string;
  grossRevenue: number;
  timeSeries: OverviewTimeSeriesPoint[];
  yesterdayRevenue: number | null;
}

const chartConfig = {
  value: {
    color: "var(--chart-1)",
    label: "Revenue",
  },
} satisfies ChartConfig;

export const TodayChart = ({
  className,
  grossRevenue,
  yesterdayRevenue,
  timeSeries,
}: TodayChartProps) => (
  <div className={cn("flex flex-col py-4 sm:py-0", className)}>
    <div className="p-0! flex flex-col items-stretch border-b sm:flex-row">
      <div className="flex min-w-48 flex-col justify-center gap-1 px-6 py-4 text-left odd:border-r sm:px-8 sm:py-6">
        <span className="text-muted-foreground text-sm">Gross Revenue</span>
        <span className="mt-1 font-medium text-lg leading-none sm:text-2xl">
          {formatCurrency(grossRevenue)}
        </span>
      </div>
      <div className="flex min-w-48 flex-col justify-center gap-1 px-6 py-4 text-left odd:border-r sm:px-8 sm:py-6">
        <span className="text-muted-foreground text-sm">Yesterday</span>
        <span className="mt-1 font-medium text-lg text-muted-foreground leading-none sm:text-xl">
          {yesterdayRevenue === null ? "—" : formatCurrency(yesterdayRevenue)}
        </span>
      </div>
    </div>
    <div className="px-2 sm:p-6">
      <ChartContainer className="h-62.5 w-full" config={chartConfig}>
        <LineChart accessibilityLayer data={timeSeries} margin={{ left: 12, right: 12 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="date"
            minTickGap={32}
            tickFormatter={(value: string) => {
              const d = new Date(value);
              return d.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              });
            }}
            tickLine={false}
            tickMargin={8}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                className="w-[150px]"
                labelFormatter={(value: string) =>
                  new Date(value).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })
                }
                nameKey="value"
              />
            }
          />
          <Line
            dataKey="value"
            dot={false}
            stroke="var(--color-value)"
            strokeWidth={2}
            type="monotone"
          />
        </LineChart>
      </ChartContainer>
    </div>
  </div>
);
