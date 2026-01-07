import { sql } from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import { SubscriptionStatus } from '@voidhash/lib';
import { Effect } from 'effect';
import type {
  AnalyticsDataAccessor,
  AnalyticsDataPoint,
  AnalyticsFilters,
  TimeGranularity,
  TimeRangeParams
} from './types';

const getDateTruncSQL = (column: string, granularity: TimeGranularity) => {
  switch (granularity) {
    case 'hour':
      return sql`DATE_FORMAT(${sql.raw(column)}, '%Y-%m-%d %H:00:00')`;
    case 'day':
      return sql`DATE(${sql.raw(column)})`;
    case 'week':
      return sql`DATE(DATE_SUB(${sql.raw(column)}, INTERVAL WEEKDAY(${sql.raw(column)}) DAY))`;
    case 'month':
      return sql`DATE_FORMAT(${sql.raw(column)}, '%Y-%m-01')`;
    case 'quarter':
      return sql`MAKEDATE(YEAR(${sql.raw(column)}), 1) + INTERVAL QUARTER(${sql.raw(column)}) QUARTER - INTERVAL 1 QUARTER`;
    case 'year':
      return sql`DATE_FORMAT(${sql.raw(column)}, '%Y-01-01')`;
    default:
      return sql`DATE(${sql.raw(column)})`;
  }
};

interface AnalyticsRow {
  period: string;
  total: string | number;
}

const extractRows = (result: unknown): AnalyticsRow[] => {
  if (Array.isArray(result) && result.length > 0 && Array.isArray(result[0])) {
    return result[0] as AnalyticsRow[];
  }
  if (Array.isArray(result)) {
    return result as AnalyticsRow[];
  }
  return [];
};

const parseRowsToDataPoints = (result: unknown): AnalyticsDataPoint[] => {
  const rows = extractRows(result);
  return rows.map((row) => ({
    timestamp: new Date(row.period),
    value: Number(row.total)
  }));
};

export const createMySQLAccessor = Effect.gen(function* () {
  const db = yield* Db;

  const getRevenue = db.makeQuery(
    (
      execute,
      {
        params,
        filters
      }: { params: TimeRangeParams; filters?: AnalyticsFilters }
    ) =>
      execute(async (dbClient) => {
        const dateTrunc = getDateTruncSQL('t.occurred_at', params.granularity);

        const result = await dbClient.execute(sql`
          SELECT
            ${dateTrunc} as period,
            COALESCE(SUM(COALESCE(t.amount_usd, t.amount)), 0) as total
          FROM transaction t
          INNER JOIN customer c ON c.id = t.customer_id
          WHERE c.project_id = ${params.projectId}
            AND t.occurred_at >= ${params.startDate}
            AND t.occurred_at <= ${params.endDate}
            ${filters?.providerEnvironment !== undefined ? sql`AND t.provider_environment = ${filters.providerEnvironment}` : sql``}
          GROUP BY period
          ORDER BY period ASC
        `);

        return parseRowsToDataPoints(result).map((dp) => ({
          ...dp,
          value: dp.value / 100 // Convert from cents
        }));
      })
  );

  const getMRR = db.makeQuery(
    (
      execute,
      {
        params,
        filters
      }: { params: TimeRangeParams; filters?: AnalyticsFilters }
    ) =>
      execute(async (dbClient) => {
        const dateTrunc = getDateTruncSQL('s.starts_at', params.granularity);

        // MRR calculation: Sum of active subscription revenues normalized to monthly
        const result = await dbClient.execute(sql`
          SELECT
            ${dateTrunc} as period,
            COALESCE(SUM(
              CASE
                WHEN DATEDIFF(s.expires_at, s.starts_at) > 180
                THEN COALESCE(t.amount_usd, t.amount) / 12.0
                ELSE COALESCE(t.amount_usd, t.amount)
              END
            ), 0) as total
          FROM subscription s
          INNER JOIN customer c ON c.id = s.customer_id
          INNER JOIN transaction t ON t.id = s.latest_transaction_id
          WHERE c.project_id = ${params.projectId}
            AND s.status = ${SubscriptionStatus.Active}
            AND s.starts_at <= ${params.endDate}
            AND (s.expires_at IS NULL OR s.expires_at >= ${params.startDate})
            AND s.is_trial = false
            ${filters?.providerEnvironment !== undefined ? sql`AND s.provider_environment = ${filters.providerEnvironment}` : sql``}
          GROUP BY period
          ORDER BY period ASC
        `);

        return parseRowsToDataPoints(result).map((dp) => ({
          ...dp,
          value: dp.value / 100 // Convert from cents
        }));
      })
  );

  const getActiveSubscriptions = db.makeQuery(
    (
      execute,
      {
        params,
        filters
      }: { params: TimeRangeParams; filters?: AnalyticsFilters }
    ) =>
      execute(async (dbClient) => {
        const dateTrunc = getDateTruncSQL('s.starts_at', params.granularity);

        const result = await dbClient.execute(sql`
          SELECT
            ${dateTrunc} as period,
            COUNT(DISTINCT s.id) as total
          FROM subscription s
          INNER JOIN customer c ON c.id = s.customer_id
          WHERE c.project_id = ${params.projectId}
            AND s.status = ${SubscriptionStatus.Active}
            AND s.starts_at <= ${params.endDate}
            AND (s.expires_at IS NULL OR s.expires_at >= ${params.startDate})
            ${filters?.providerEnvironment !== undefined ? sql`AND s.provider_environment = ${filters.providerEnvironment}` : sql``}
          GROUP BY period
          ORDER BY period ASC
        `);

        return parseRowsToDataPoints(result);
      })
  );

  const getNewSubscriptions = db.makeQuery(
    (
      execute,
      {
        params,
        filters
      }: { params: TimeRangeParams; filters?: AnalyticsFilters }
    ) =>
      execute(async (dbClient) => {
        const dateTrunc = getDateTruncSQL('s.created_at', params.granularity);

        const result = await dbClient.execute(sql`
          SELECT
            ${dateTrunc} as period,
            COUNT(*) as total
          FROM subscription s
          INNER JOIN customer c ON c.id = s.customer_id
          WHERE c.project_id = ${params.projectId}
            AND s.created_at >= ${params.startDate}
            AND s.created_at <= ${params.endDate}
            AND s.is_trial = false
            ${filters?.providerEnvironment !== undefined ? sql`AND s.provider_environment = ${filters.providerEnvironment}` : sql``}
          GROUP BY period
          ORDER BY period ASC
        `);

        return parseRowsToDataPoints(result);
      })
  );

  const getChurnedSubscriptions = db.makeQuery(
    (
      execute,
      {
        params,
        filters
      }: { params: TimeRangeParams; filters?: AnalyticsFilters }
    ) =>
      execute(async (dbClient) => {
        const dateTrunc = getDateTruncSQL('s.canceled_at', params.granularity);

        const result = await dbClient.execute(sql`
          SELECT
            ${dateTrunc} as period,
            COUNT(*) as total
          FROM subscription s
          INNER JOIN customer c ON c.id = s.customer_id
          WHERE c.project_id = ${params.projectId}
            AND s.status = ${SubscriptionStatus.Canceled}
            AND s.canceled_at >= ${params.startDate}
            AND s.canceled_at <= ${params.endDate}
            ${filters?.providerEnvironment !== undefined ? sql`AND s.provider_environment = ${filters.providerEnvironment}` : sql``}
          GROUP BY period
          ORDER BY period ASC
        `);

        return parseRowsToDataPoints(result);
      })
  );

  const getTrials = db.makeQuery(
    (
      execute,
      {
        params,
        filters
      }: { params: TimeRangeParams; filters?: AnalyticsFilters }
    ) =>
      execute(async (dbClient) => {
        const dateTrunc = getDateTruncSQL('s.created_at', params.granularity);

        const result = await dbClient.execute(sql`
          SELECT
            ${dateTrunc} as period,
            COUNT(*) as total
          FROM subscription s
          INNER JOIN customer c ON c.id = s.customer_id
          WHERE c.project_id = ${params.projectId}
            AND s.is_trial = true
            AND s.created_at >= ${params.startDate}
            AND s.created_at <= ${params.endDate}
            ${filters?.providerEnvironment !== undefined ? sql`AND s.provider_environment = ${filters.providerEnvironment}` : sql``}
          GROUP BY period
          ORDER BY period ASC
        `);

        return parseRowsToDataPoints(result);
      })
  );

  const getTrialConversions = db.makeQuery(
    (
      execute,
      {
        params,
        filters
      }: { params: TimeRangeParams; filters?: AnalyticsFilters }
    ) =>
      execute(async (dbClient) => {
        const dateTrunc = getDateTruncSQL('s.updated_at', params.granularity);

        // Count subscriptions that were trials and are now active (non-trial)
        const result = await dbClient.execute(sql`
          SELECT
            ${dateTrunc} as period,
            COUNT(*) as total
          FROM subscription s
          INNER JOIN customer c ON c.id = s.customer_id
          WHERE c.project_id = ${params.projectId}
            AND s.status = ${SubscriptionStatus.Active}
            AND s.is_trial = false
            AND s.updated_at >= ${params.startDate}
            AND s.updated_at <= ${params.endDate}
            AND EXISTS (
              SELECT 1 FROM subscription s2
              WHERE s2.store_subscription_id = s.store_subscription_id
              AND s2.is_trial = true
            )
            ${filters?.providerEnvironment !== undefined ? sql`AND s.provider_environment = ${filters.providerEnvironment}` : sql``}
          GROUP BY period
          ORDER BY period ASC
        `);

        return parseRowsToDataPoints(result);
      })
  );

  const getCustomerCount = db.makeQuery(
    (
      execute,
      {
        params,
        filters: _filters
      }: { params: TimeRangeParams; filters?: AnalyticsFilters }
    ) =>
      execute(async (dbClient) => {
        const dateTrunc = getDateTruncSQL('c.created_at', params.granularity);

        // Cumulative customer count up to each period
        const result = await dbClient.execute(sql`
          SELECT
            ${dateTrunc} as period,
            COUNT(*) as total
          FROM customer c
          WHERE c.project_id = ${params.projectId}
            AND c.created_at <= ${params.endDate}
            AND c.archived_at IS NULL
          GROUP BY period
          ORDER BY period ASC
        `);

        return parseRowsToDataPoints(result);
      })
  );

  const getNewCustomers = db.makeQuery(
    (
      execute,
      {
        params,
        filters: _filters
      }: { params: TimeRangeParams; filters?: AnalyticsFilters }
    ) =>
      execute(async (dbClient) => {
        const dateTrunc = getDateTruncSQL('c.created_at', params.granularity);

        const result = await dbClient.execute(sql`
          SELECT
            ${dateTrunc} as period,
            COUNT(*) as total
          FROM customer c
          WHERE c.project_id = ${params.projectId}
            AND c.created_at >= ${params.startDate}
            AND c.created_at <= ${params.endDate}
            AND c.archived_at IS NULL
          GROUP BY period
          ORDER BY period ASC
        `);

        return parseRowsToDataPoints(result);
      })
  );

  const getPayingCustomerCount = db.makeQuery(
    (
      execute,
      {
        params,
        filters
      }: { params: TimeRangeParams; filters?: AnalyticsFilters }
    ) =>
      execute(async (dbClient) => {
        const dateTrunc = getDateTruncSQL('t.occurred_at', params.granularity);

        const result = await dbClient.execute(sql`
          SELECT
            ${dateTrunc} as period,
            COUNT(DISTINCT c.id) as total
          FROM customer c
          INNER JOIN transaction t ON t.customer_id = c.id
          WHERE c.project_id = ${params.projectId}
            AND t.occurred_at >= ${params.startDate}
            AND t.occurred_at <= ${params.endDate}
            AND COALESCE(t.amount_usd, t.amount) > 0
            ${filters?.providerEnvironment !== undefined ? sql`AND t.provider_environment = ${filters.providerEnvironment}` : sql``}
          GROUP BY period
          ORDER BY period ASC
        `);

        return parseRowsToDataPoints(result);
      })
  );

  return {
    getRevenue,
    getMRR,
    getActiveSubscriptions,
    getNewSubscriptions,
    getChurnedSubscriptions,
    getTrials,
    getTrialConversions,
    getCustomerCount,
    getNewCustomers,
    getPayingCustomerCount
  } satisfies AnalyticsDataAccessor;
});
