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

export const description = "A line chart for New Users";

const chartData = [
  { month: "January", newUsers: 150 },
  { month: "February", newUsers: 200 },
  { month: "March", newUsers: 180 },
  { month: "April", newUsers: 200 },
  { month: "May", newUsers: 250 },
  { month: "June", newUsers: 200 },
];

const chartConfig = {
  newUsers: {
    color: "var(--chart-1)",
    label: "New Users",
  },
} satisfies ChartConfig;

export function NewUsersChartWidget() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-semibold text-muted-foreground text-sm">
          New Users
        </CardTitle>
        <div className="mt-1 font-semibold text-lg leading-none sm:text-2xl">
          200
        </div>
        <div className="mt-2 text-muted-foreground text-sm">
          250 previous period
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
              dataKey="newUsers"
              dot={false}
              stroke="var(--color-newUsers)"
              strokeWidth={2}
              type="natural"
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
