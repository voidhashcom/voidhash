'use client';

import {
  Card,
  CardContent,
  CardHeader,
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from '@voidhash/ui';
import * as React from 'react';
import { CartesianGrid, Line, LineChart, XAxis } from 'recharts';

export const description = 'An interactive line chart';

const chartData = [
  {
    date: '2024-04-01',
    gross: 222,
    withoutTax: 150,
    withoutTaxAndStoreFees: 100
  },
  {
    date: '2024-04-02',
    gross: 97,
    withoutTax: 180,
    withoutTaxAndStoreFees: 100
  },
  {
    date: '2024-04-03',
    gross: 167,
    withoutTax: 120,
    withoutTaxAndStoreFees: 100
  },
  {
    date: '2024-04-04',
    gross: 242,
    withoutTax: 260,
    withoutTaxAndStoreFees: 100
  },
  {
    date: '2024-04-05',
    gross: 373,
    withoutTax: 290,
    withoutTaxAndStoreFees: 100
  }
];

const chartConfig = {
  views: {
    label: 'Page Views'
  },
  gross: {
    label: 'Gross',
    color: 'var(--chart-1)'
  },
  withoutTax: {
    label: 'Without tax',
    color: 'var(--chart-2)'
  },
  withoutTaxAndStoreFees: {
    label: 'Without tax and store fees',
    color: 'var(--chart-3)'
  }
} satisfies ChartConfig;

export function TodayRevenueChart() {
  const [activeChart] = React.useState<keyof typeof chartConfig>('gross');

  return (
    <Card className="py-4 sm:py-0">
      <CardHeader className="!p-0 flex flex-col items-stretch border-b sm:flex-row">
        <div className="flex min-w-48 flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l sm:border-t-0 sm:border-l sm:px-8 sm:py-6">
          <span className="font-semibold text-muted-foreground text-sm">
            Gross Revenue
          </span>
          <span className="mt-1 font-semibold text-lg leading-none sm:text-2xl">
            $123,540
          </span>
        </div>
        <div className="flex min-w-48 flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l sm:border-t-0 sm:border-l sm:px-8 sm:py-6">
          <span className="text-muted-foreground text-sm">Yesterday</span>
          <span className="mt-1 font-semibold text-lg text-muted-foreground leading-none sm:text-xl">
            $100,540
          </span>
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:p-6">
        <ChartContainer
          className="aspect-auto h-[250px] w-full"
          config={chartConfig}
        >
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
              dataKey="date"
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric'
                });
              }}
              tickLine={false}
              tickMargin={8}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  className="w-[150px]"
                  labelFormatter={(value) => {
                    return new Date(value).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    });
                  }}
                  nameKey="views"
                />
              }
            />
            <Line
              dataKey={activeChart}
              dot={false}
              stroke={`var(--color-${activeChart})`}
              strokeWidth={2}
              type="monotone"
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
