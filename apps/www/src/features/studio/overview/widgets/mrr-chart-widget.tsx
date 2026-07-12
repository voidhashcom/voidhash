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

export const description = "A line chart for MRR";

const chartData = [
  { month: "January", mrr: 18_600 },
  { month: "February", mrr: 30_500 },
  { month: "March", mrr: 23_700 },
  { month: "April", mrr: 7300 },
  { month: "May", mrr: 20_900 },
  { month: "June", mrr: 21_400 },
];

const chartConfig = {
  mrr: {
    color: "var(--chart-1)",
    label: "MRR",
  },
} satisfies ChartConfig;

export function MRRChartWidget() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-semibold text-muted-foreground text-sm">MRR</CardTitle>
        <div className="mt-1 font-semibold text-lg leading-none sm:text-2xl">$21,400</div>
        <div className="mt-2 text-muted-foreground text-sm">$20,900 previous period</div>
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
              dataKey="mrr"
              dot={false}
              stroke="var(--color-mrr)"
              strokeWidth={2}
              type="natural"
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
