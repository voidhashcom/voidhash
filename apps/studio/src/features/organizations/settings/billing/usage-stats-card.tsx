'use client';

import { Badge, Progress, cn } from '@voidhash/ui';

interface UsageStatsCardProps {
  metricName: string;
  description: string;
  currentValue: number;
  limit: number | null;
  percentUsed: number | null;
  isOverLimit: boolean;
  isApproachingLimit: boolean;
}

function formatValue(value: number, metricName: string): string {
  if (metricName.toLowerCase().includes('revenue')) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }
  return new Intl.NumberFormat('en-US').format(value);
}

function formatLimit(limit: number | null, metricName: string): string {
  if (limit === null) return 'Unlimited';
  return formatValue(limit, metricName);
}

export function UsageStatsCard({
  metricName,
  description,
  currentValue,
  limit,
  percentUsed,
  isOverLimit,
  isApproachingLimit
}: UsageStatsCardProps) {
  const progressValue = percentUsed ?? 0;

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-medium text-sm">{metricName}</h4>
          <p className="mt-1 text-muted-foreground text-xs">{description}</p>
        </div>
        {isOverLimit && (
          <Badge variant="destructive" className="text-xs">
            Over limit
          </Badge>
        )}
        {isApproachingLimit && !isOverLimit && (
          <Badge
            variant="outline"
            className="border-yellow-500 text-xs text-yellow-600"
          >
            Approaching limit
          </Badge>
        )}
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between">
          <span className="font-semibold text-2xl">
            {formatValue(currentValue, metricName)}
          </span>
          <span className="text-muted-foreground text-sm">
            / {formatLimit(limit, metricName)}
          </span>
        </div>

        {limit !== null && (
          <Progress
            value={Math.min(progressValue, 100)}
            className={cn(
              'mt-2 h-2',
              isOverLimit && '[&>div]:bg-destructive',
              isApproachingLimit && !isOverLimit && '[&>div]:bg-yellow-500'
            )}
          />
        )}

        {limit !== null && percentUsed !== null && (
          <p className="mt-1 text-muted-foreground text-xs">
            {percentUsed.toFixed(1)}% used
          </p>
        )}
      </div>
    </div>
  );
}
