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

export const description = 'A line chart for Active Trials';

const chartData = [
  { month: 'January', activeTrials: 45 },
  { month: 'February', activeTrials: 60 },
  { month: 'March', activeTrials: 55 },
  { month: 'April', activeTrials: 50 },
  { month: 'May', activeTrials: 65 },
  { month: 'June', activeTrials: 70 }
];

const chartConfig = {
  activeTrials: {
    label: 'Active Trials',
    color: 'var(--chart-1)'
  }
} satisfies ChartConfig;

export function ActiveTrialsChartWidget() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-semibold text-muted-foreground text-sm">
          Active Trials
        </CardTitle>
        <div className="mt-1 font-semibold text-lg leading-none sm:text-2xl">
          70
        </div>
        <div className="mt-2 text-muted-foreground text-sm">
          65 previous period
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
              dataKey="activeTrials"
              dot={false}
              stroke="var(--color-activeTrials)"
              strokeWidth={2}
              type="natural"
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
