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

export const description = 'A line chart for Active Subscriptions';

const chartData = [
  { month: 'January', activeSubs: 120 },
  { month: 'February', activeSubs: 140 },
  { month: 'March', activeSubs: 158 },
  { month: 'April', activeSubs: 170 },
  { month: 'May', activeSubs: 192 },
  { month: 'June', activeSubs: 217 }
];

const chartConfig = {
  activeSubs: {
    label: 'Active Subscriptions',
    color: 'var(--chart-1)'
  }
} satisfies ChartConfig;

export function ActiveSubsChartWidget() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-semibold text-muted-foreground text-sm">
          Active Subscriptions
        </CardTitle>
        <div className="mt-1 font-semibold text-lg leading-none sm:text-2xl">
          217
        </div>
        <div className="mt-2 text-muted-foreground text-sm">
          192 previous period
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
              dataKey="activeSubs"
              dot={false}
              stroke="var(--color-activeSubs)"
              strokeWidth={2}
              type="natural"
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
