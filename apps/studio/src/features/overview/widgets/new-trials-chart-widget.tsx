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

export const description = "A line chart for New Trials";

const chartData = [
  { month: "January", newTrials: 30 },
  { month: "February", newTrials: 40 },
  { month: "March", newTrials: 35 },
  { month: "April", newTrials: 25 },
  { month: "May", newTrials: 45 },
  { month: "June", newTrials: 50 },
];

const chartConfig = {
  newTrials: {
    color: "var(--chart-1)",
    label: "New Trials",
  },
} satisfies ChartConfig;

export function NewTrialsChartWidget() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-semibold text-muted-foreground text-sm">
          New Trials
        </CardTitle>
        <div className="mt-1 font-semibold text-lg leading-none sm:text-2xl">
          50
        </div>
        <div className="mt-2 text-muted-foreground text-sm">
          45 previous period
        </div>
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
            <ChartTooltip
              content={<ChartTooltipContent hideLabel />}
              cursor={false}
            />
            <Line
              dataKey="newTrials"
              dot={false}
              stroke="var(--color-newTrials)"
              strokeWidth={2}
              type="natural"
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
