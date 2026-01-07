import { and, eq, usageAggregates } from "@voidhash/db";
import { Db } from "@voidhash/db/effect";
import { Effect } from "effect";

import { BillingServiceError } from "../../../billing/errors";
import type { MetricIdValue } from "../../../billing/types";

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
  return { end, start };
}

const _getUsageAggregate = (db: Db) =>
  db.makeQuery(
    (
      execute,
      input: { organizationId: string; metricId: string; periodStart: Date }
    ) =>
      execute(async (db) =>
        db.query.usageAggregates.findFirst({
          where: and(
            eq(usageAggregates.organizationId, input.organizationId),
            eq(usageAggregates.metricId, input.metricId),
            eq(usageAggregates.periodStart, input.periodStart)
          ),
        })
      )
  );

export const getUsage = Effect.gen(function* getUsage() {
  const db = yield* Db;
  return Effect.fn("UsageService.getUsage")(
    function* getUsage(input: {
      organizationId: string;
      metricId: MetricIdValue;
    }) {
      const period = getCurrentBillingPeriod();

      const aggregate = yield* _getUsageAggregate(db)({
        metricId: input.metricId,
        organizationId: input.organizationId,
        periodStart: period.start,
      });

      return aggregate?.totalValue ?? 0;
    },
    (effect) =>
      effect.pipe(
        Effect.catchTags({
          DatabaseError: (error) =>
            new BillingServiceError({
              cause: String(error.cause),
              message: "Failed to get usage",
            }),
        })
      )
  );
});
