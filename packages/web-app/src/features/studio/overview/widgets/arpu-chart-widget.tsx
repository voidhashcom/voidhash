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

export const description = "A line chart for ARPU";

const chartData = [
  { arpu: 12.4, month: "January" },
  { arpu: 15.2, month: "February" },
  { arpu: 11.8, month: "March" },
  { arpu: 3.6, month: "April" },
  { arpu: 10.4, month: "May" },
  { arpu: 10.7, month: "June" },
];

const chartConfig = {
  arpu: {
    color: "var(--chart-1)",
    label: "ARPU",
  },
} satisfies ChartConfig;

export function ARPUChartWidget() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-semibold text-muted-foreground text-sm">ARPU</CardTitle>
        <div className="mt-1 font-semibold text-lg leading-none sm:text-2xl">$10.70</div>
        <div className="mt-2 text-muted-foreground text-sm">$10.40 previous period</div>
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
              dataKey="arpu"
              dot={false}
              stroke="var(--color-arpu)"
              strokeWidth={2}
              type="natural"
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
