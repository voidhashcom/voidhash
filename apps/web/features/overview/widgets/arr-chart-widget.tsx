'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from '@voidhash/ui';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';

export const description = 'A line chart for ARR';

const chartData = [
  { month: 'January', arr: 223_200 },
  { month: 'February', arr: 366_000 },
  { month: 'March', arr: 284_400 },
  { month: 'April', arr: 87_600 },
  { month: 'May', arr: 250_800 },
  { month: 'June', arr: 256_800 }
];

const chartConfig = {
  arr: {
    label: 'ARR',
    color: 'var(--chart-1)'
  }
} satisfies ChartConfig;

export function ARRChartWidget() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-semibold text-muted-foreground text-sm">
          ARR
        </CardTitle>
        <div className="mt-1 font-semibold text-lg leading-none sm:text-2xl">
          $256,800
        </div>
        <div className="mt-2 text-muted-foreground text-sm">
          $250,800 previous period
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <LineChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 12,
              right: 12
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
              dataKey="arr"
              dot={false}
              stroke="var(--color-arr)"
              strokeWidth={2}
              type="natural"
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
