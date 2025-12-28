'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton
} from '@voidhash/ui';
import { UsageStatsCard } from './usage-stats-card';

interface UsageSummary {
  metricId: string;
  metricName: string;
  currentValue: number;
  limit: number | null;
  percentUsed: number | null;
  isOverLimit: boolean;
  isApproachingLimit: boolean;
}

interface UsageDashboardProps {
  usageSummaries?: readonly UsageSummary[];
  isLoading: boolean;
}

const metricDescriptions: Record<string, string> = {
  paywall_conversions: 'Number of successful paywall conversions this period',
  monthly_tracked_revenue: 'Total revenue tracked through Voidhash this period',
  api_calls: 'Total API requests made to Voidhash this period',
  active_customers: 'Number of unique customers with activity this period'
};

export function UsageDashboard({
  usageSummaries,
  isLoading
}: UsageDashboardProps) {
  if (isLoading) {
    return (
      <Card className="mt-8">
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="mt-2 h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!usageSummaries || usageSummaries.length === 0) {
    return (
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Usage</CardTitle>
          <CardDescription>
            Your usage data will appear here once available
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No usage data available yet. Start using Voidhash to see your usage
            metrics.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>Usage</CardTitle>
        <CardDescription>
          Monitor your usage across different metrics
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          {usageSummaries.map((summary) => (
            <UsageStatsCard
              key={summary.metricId}
              metricName={summary.metricName}
              description={metricDescriptions[summary.metricId] ?? ''}
              currentValue={summary.currentValue}
              limit={summary.limit}
              percentUsed={summary.percentUsed}
              isOverLimit={summary.isOverLimit}
              isApproachingLimit={summary.isApproachingLimit}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
