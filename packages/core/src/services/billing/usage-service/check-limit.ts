import { and, eq, usageAggregates } from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import { Effect } from 'effect';
import { BillingServiceError, UsageLimitWarning } from '../../../billing/errors';
import { METRIC_DEFINITIONS } from '../../../billing/types';
import type { MetricIdValue } from '../../../billing/types';

/**
 * Get or create the current billing period for an organization
 */
function getCurrentBillingPeriod(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  );
  return { start, end };
}

const _getUsageAggregate = (db: Db) =>
  db.makeQuery(
    (
      execute,
      input: { organizationId: string; metricId: string; periodStart: Date }
    ) =>
      execute(async (db) => {
        return db.query.usageAggregates.findFirst({
          where: and(
            eq(usageAggregates.organizationId, input.organizationId),
            eq(usageAggregates.metricId, input.metricId),
            eq(usageAggregates.periodStart, input.periodStart)
          )
        });
      })
  );

export const checkLimit = Effect.gen(function* () {
  const db = yield* Db;
  return Effect.fn('UsageService.checkLimit')(
    function* (input: {
      organizationId: string;
      metricId: MetricIdValue;
    }) {
      const period = getCurrentBillingPeriod();

      const aggregate = yield* _getUsageAggregate(db)({
        organizationId: input.organizationId,
        metricId: input.metricId,
        periodStart: period.start
      });

      if (!aggregate) {
        return null;
      }

      const currentValue = aggregate.totalValue;
      const limit = aggregate.limitValue;
      const warnThreshold = aggregate.warnThreshold;

      // No limit set means unlimited
      if (limit === null) {
        return null;
      }

      const metricDef = METRIC_DEFINITIONS[input.metricId];
      const metricName = metricDef?.name ?? input.metricId;

      // Check if approaching or over limit
      if (currentValue > limit) {
        return new UsageLimitWarning({
          metricId: input.metricId,
          currentValue: Number(currentValue),
          limit: Number(limit),
          message: `You have exceeded your ${metricName} limit (${currentValue}/${limit}). Consider upgrading your plan.`
        });
      }

      if (warnThreshold !== null && currentValue >= warnThreshold) {
        const percentUsed = Math.round((currentValue / limit) * 100);
        return new UsageLimitWarning({
          metricId: input.metricId,
          currentValue: Number(currentValue),
          limit: Number(limit),
          message: `You are approaching your ${metricName} limit (${percentUsed}% used). Consider upgrading your plan.`
        });
      }

      return null;
    },
    (effect) =>
      effect.pipe(
        Effect.catchTags({
          DatabaseError: (error) =>
            new BillingServiceError({
              message: 'Failed to check limit',
              cause: String(error.cause)
            })
        })
      )
  );
});
