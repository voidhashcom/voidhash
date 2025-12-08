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

export const description = 'A line chart for ARPPU';

const chartData = [
  { month: 'January', arppu: 24.8 },
  { month: 'February', arppu: 30.4 },
  { month: 'March', arppu: 23.6 },
  { month: 'April', arppu: 7.2 },
  { month: 'May', arppu: 20.8 },
  { month: 'June', arppu: 21.4 }
];

const chartConfig = {
  arppu: {
    label: 'ARPPU',
    color: 'var(--chart-1)'
  }
} satisfies ChartConfig;

export function ARPPUChartWidget() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-semibold text-muted-foreground text-sm">
          ARPPU
        </CardTitle>
        <div className="mt-1 font-semibold text-lg leading-none sm:text-2xl">
          $21.40
        </div>
        <div className="mt-2 text-muted-foreground text-sm">
          $20.80 previous period
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
              dataKey="arppu"
              dot={false}
              stroke="var(--color-arppu)"
              strokeWidth={2}
              type="natural"
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
