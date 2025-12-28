import {
  and,
  eq,
  type InsertUsageAggregate,
  type InsertUsageRecord,
  organizationBilling,
  usageAggregates,
  usageRecords
} from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import { generateId } from '@voidhash/lib';
import { Effect } from 'effect';
import { BillingServiceError } from '../../../billing/errors';
import { getTierLimitForMetric } from '../../../billing/tiers';
import type { MetricIdValue, UsageRecordInput } from '../../../billing/types';

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

const _insertUsageRecord = (db: Db) =>
  db.makeQuery((execute, record: InsertUsageRecord) =>
    execute(async (db) => {
      await db.insert(usageRecords).values(record);
      return { id: record.id };
    })
  );

const _upsertUsageAggregate = (db: Db) =>
  db.makeQuery(
    (
      execute,
      input: {
        organizationId: string;
        metricId: string;
        periodStart: Date;
        periodEnd: Date;
        value: number;
        limit: number | null;
        warnThreshold: number | null;
      }
    ) =>
      execute(async (db) => {
        // Try to find existing aggregate
        const existing = await db.query.usageAggregates.findFirst({
          where: and(
            eq(usageAggregates.organizationId, input.organizationId),
            eq(usageAggregates.metricId, input.metricId),
            eq(usageAggregates.periodStart, input.periodStart)
          )
        });

        if (existing) {
          // Update existing aggregate
          await db
            .update(usageAggregates)
            .set({
              totalValue: existing.totalValue + input.value,
              limitValue: input.limit,
              warnThreshold: input.warnThreshold
            })
            .where(eq(usageAggregates.id, existing.id));

          return {
            id: existing.id,
            totalValue: existing.totalValue + input.value
          };
        }

        // Create new aggregate
        const newAggregate: InsertUsageAggregate = {
          id: generateId('usageAggregate'),
          organizationId: input.organizationId,
          metricId: input.metricId,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          totalValue: input.value,
          limitValue: input.limit,
          warnThreshold: input.warnThreshold
        };

        await db.insert(usageAggregates).values(newAggregate);

        return {
          id: newAggregate.id,
          totalValue: input.value
        };
      })
  );

const _getOrganizationBilling = (db: Db) =>
  db.makeQuery((execute, organizationId: string) =>
    execute(async (db) => {
      return await db.query.organizationBilling.findFirst({
        where: eq(organizationBilling.organizationId, organizationId)
      });
    })
  );

export const recordUsage = Effect.gen(function* () {
  const db = yield* Db;
  return Effect.fn('UsageService.recordUsage')(
    function* (input: UsageRecordInput) {
      // Get the current billing period
      const period = getCurrentBillingPeriod();

      // Get organization billing to determine tier
      const billing = yield* _getOrganizationBilling(db)(input.organizationId);

      // Default to free tier if no billing record exists
      const tier = billing
        ? billing.tier === 1
          ? 'free'
          : billing.tier === 2
            ? 'pro'
            : 'enterprise'
        : 'free';

      // Get limits for this tier and metric
      const { limit, warnAt } = getTierLimitForMetric(
        tier,
        input.metricId as MetricIdValue
      );

      // Create usage record
      const record: InsertUsageRecord = {
        id: generateId('usageRecord'),
        organizationId: input.organizationId,
        metricId: input.metricId,
        value: input.value,
        periodStart: period.start,
        periodEnd: period.end,
        syncedToProvider: false,
        metadata: input.metadata ?? null,
        occurredAt: new Date()
      };

      yield* _insertUsageRecord(db)(record);

      // Update aggregate
      const aggregate = yield* _upsertUsageAggregate(db)({
        organizationId: input.organizationId,
        metricId: input.metricId,
        periodStart: period.start,
        periodEnd: period.end,
        value: input.value,
        limit,
        warnThreshold: warnAt
      });

      yield* Effect.log(
        `Recorded usage for org ${input.organizationId}, metric ${input.metricId}: +${input.value} (total: ${aggregate.totalValue})`
      );

      return {
        recordId: record.id,
        totalValue: aggregate.totalValue,
        limit,
        warnAt
      };
    },
    (effect) =>
      effect.pipe(
        Effect.catchTags({
          DatabaseError: (error) =>
            new BillingServiceError({
              message: 'Failed to record usage',
              cause: String(error.cause)
            })
        })
      )
  );
});
