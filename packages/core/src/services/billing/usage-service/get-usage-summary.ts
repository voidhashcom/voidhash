import { and, eq, organizationBilling, usageAggregates } from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import { Effect } from 'effect';
import { BillingServiceError } from '../../../billing/errors';
import { METRIC_DEFINITIONS } from '../../../billing/types';
import type { MetricIdValue, UsageSummary } from '../../../billing/types';

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

const _getOrganizationBilling = (db: Db) =>
  db.makeQuery((execute, organizationId: string) =>
    execute(async (db) => {
      return db.query.organizationBilling.findFirst({
        where: eq(organizationBilling.organizationId, organizationId)
      });
    })
  );

export const getUsageSummary = Effect.gen(function* () {
  const db = yield* Db;
  return Effect.fn('UsageService.getUsageSummary')(
    function* (input: { organizationId: string; metricId: MetricIdValue }) {
      const period = getCurrentBillingPeriod();

      const aggregate = yield* _getUsageAggregate(db)({
        organizationId: input.organizationId,
        metricId: input.metricId,
        periodStart: period.start
      });

      const currentValue = aggregate?.totalValue ?? 0;
      const limit = aggregate?.limitValue ?? null;
      const warnThreshold = aggregate?.warnThreshold ?? null;

      const metricDef = METRIC_DEFINITIONS[input.metricId];

      // Calculate percentage used
      const percentUsed = limit !== null ? (currentValue / limit) * 100 : null;

      // Determine if over limit or approaching limit
      const isOverLimit = limit !== null && currentValue > limit;
      const isApproachingLimit =
        warnThreshold !== null && currentValue >= warnThreshold;

      return {
        metricId: input.metricId,
        metricName: metricDef?.name ?? input.metricId,
        currentValue,
        limit,
        percentUsed,
        isOverLimit,
        isApproachingLimit
      };
    },
    (effect) =>
      effect.pipe(
        Effect.catchTags({
          DatabaseError: (error) =>
            new BillingServiceError({
              message: 'Failed to get usage summary',
              cause: String(error.cause)
            })
        })
      )
  );
});

export const getAllUsageSummaries = Effect.gen(function* () {
  const db = yield* Db;
  const getUsageSummaryFn = yield* getUsageSummary;

  return Effect.fn('UsageService.getAllUsageSummaries')(
    function* (input: { organizationId: string }) {
      const metricIds = Object.keys(METRIC_DEFINITIONS) as MetricIdValue[];

      const summaries: UsageSummary[] = [];
      for (const metricId of metricIds) {
        const summary = yield* getUsageSummaryFn({
          organizationId: input.organizationId,
          metricId
        });
        summaries.push(summary);
      }

      return summaries;
    },
    (effect) =>
      effect.pipe(
        Effect.catchTags({
          BillingServiceError: (error) => error
        })
      )
  );
});
