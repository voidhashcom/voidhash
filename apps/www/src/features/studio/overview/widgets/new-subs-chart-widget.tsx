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

export const description = "A line chart for New Subscriptions";

const chartData = [
  { month: "January", newSubs: 15 },
  { month: "February", newSubs: 20 },
  { month: "March", newSubs: 18 },
  { month: "April", newSubs: 12 },
  { month: "May", newSubs: 22 },
  { month: "June", newSubs: 25 },
];

const chartConfig = {
  newSubs: {
    color: "var(--chart-1)",
    label: "New Subscriptions",
  },
} satisfies ChartConfig;

export function NewSubsChartWidget() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-semibold text-muted-foreground text-sm">
          New Subscriptions
        </CardTitle>
        <div className="mt-1 font-semibold text-lg leading-none sm:text-2xl">25</div>
        <div className="mt-2 text-muted-foreground text-sm">22 previous period</div>
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
              dataKey="newSubs"
              dot={false}
              stroke="var(--color-newSubs)"
              strokeWidth={2}
              type="natural"
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
