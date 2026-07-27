"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@voidhash/ui";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

export const description = "A line chart for Renewal Canceled Subscriptions";

const chartData = [
  { month: "January", renewalCanceledSubs: 5 },
  { month: "February", renewalCanceledSubs: 8 },
  { month: "March", renewalCanceledSubs: 6 },
  { month: "April", renewalCanceledSubs: 10 },
  { month: "May", renewalCanceledSubs: 7 },
  { month: "June", renewalCanceledSubs: 9 },
];

const chartConfig = {
  renewalCanceledSubs: {
    color: "var(--chart-1)",
    label: "Renewal Canceled",
  },
} satisfies ChartConfig;

export function RenewalCanceledSubsChartWidget() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-semibold text-muted-foreground text-sm">
          Renewal Canceled
        </CardTitle>
        <div className="mt-1 font-semibold text-lg leading-none sm:text-2xl">9</div>
        <div className="mt-2 text-muted-foreground text-sm">7 previous period</div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <LineChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="month"
              tickFormatter={(value) => value.slice(0, 3)}
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
              dataKey="renewalCanceledSubs"
              dot={false}
              stroke="var(--color-renewalCanceledSubs)"
              strokeWidth={2}
              type="natural"
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
