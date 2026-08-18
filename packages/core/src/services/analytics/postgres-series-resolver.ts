import type {
  AnalyticsDataPoint,
  BuiltInInsightId,
  CompiledAnalyticsFilter,
  TimeGranularity,
} from "../../domain/analytics/Analytics.ts";
import { isReservedRevenueEventName } from "../../domain/internalAnalytics/InternalAnalyticsEvents.ts";
import type { StoredAnalyticsEvent } from "./AnalyticsEventStore.ts";
import { DateTime } from "effect";

const eventNames = {
  subscriptionActivity: new Set([
    "$subscription.created",
    "$subscription.renewed",
    "$subscription.active",
  ]),
  subscriptionChurn: new Set(["$subscription.canceled", "$subscription.expired"]),
};

const property = (event: StoredAnalyticsEvent, ...keys: ReadonlyArray<string>): unknown => {
  for (const key of keys) {
    const value = event.properties[key];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
};

const numberProperty = (event: StoredAnalyticsEvent, ...keys: ReadonlyArray<string>): number => {
  const value = property(event, ...keys);
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return value;
};

const booleanProperty = (event: StoredAnalyticsEvent, ...keys: ReadonlyArray<string>): boolean =>
  keys.some((key) => event.properties[key] === true);

const stringProperty = (event: StoredAnalyticsEvent, ...keys: ReadonlyArray<string>): string => {
  const value = property(event, ...keys);
  if (typeof value !== "string") return "";
  return value;
};

const subscriptionId = (event: StoredAnalyticsEvent): string =>
  stringProperty(
    event,
    "subscription_id",
    "subscriptionId",
    "provider_subscription_id",
    "providerSubscriptionId",
    "store_subscription_id",
    "storeSubscriptionId",
  ) || event.eventId;

const personKey = (event: StoredAnalyticsEvent): string => event.personId ?? event.distinctId;

const dateFrom = (value: Date | number | string): Date =>
  DateTime.toDateUtc(DateTime.makeUnsafe(value));

const startOfBucket = (date: Date, granularity: TimeGranularity): Date => {
  const result = dateFrom(date.getTime());
  result.setUTCMilliseconds(0);
  result.setUTCSeconds(0);
  result.setUTCMinutes(0);
  if (granularity !== "hour") result.setUTCHours(0);
  if (granularity === "week") {
    const day = result.getUTCDay();
    let offset = day - 1;
    if (day === 0) offset = 6;
    result.setUTCDate(result.getUTCDate() - offset);
  }
  if (granularity === "month" || granularity === "quarter" || granularity === "year") {
    result.setUTCDate(1);
  }
  if (granularity === "quarter") {
    result.setUTCMonth(Math.floor(result.getUTCMonth() / 3) * 3);
  }
  if (granularity === "year") result.setUTCMonth(0);
  return result;
};

const bucketKey = (event: StoredAnalyticsEvent, granularity: TimeGranularity): string =>
  startOfBucket(event.eventTimestamp, granularity).toISOString();

const withinRange = (event: StoredAnalyticsEvent, start: Date, end: Date): boolean =>
  event.eventTimestamp >= start && event.eventTimestamp <= end;

const matchesFilters = (event: StoredAnalyticsEvent, filters: CompiledAnalyticsFilter): boolean => {
  if (!filters.projectIds.includes(event.projectId)) return false;
  const productId = stringProperty(event, "product_id", "productId", "product.id");
  if (filters.productIds?.length && !filters.productIds.includes(productId)) return false;
  const environment = numberProperty(event, "provider_environment", "providerEnvironment");
  if (
    filters.providerEnvironments !== undefined &&
    !filters.providerEnvironments.includes(environment)
  ) {
    return false;
  }
  const status = numberProperty(event, "subscription_status", "subscriptionStatus");
  if (filters.subscriptionStatuses?.length && !filters.subscriptionStatuses.includes(status)) {
    return false;
  }
  return true;
};

const pointsFromValues = (values: ReadonlyMap<string, number>): AnalyticsDataPoint[] =>
  [...values.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([timestamp, value]) => ({ timestamp: dateFrom(timestamp), value }));

const sumByBucket = (
  events: ReadonlyArray<StoredAnalyticsEvent>,
  granularity: TimeGranularity,
  valueOf: (event: StoredAnalyticsEvent) => number,
): AnalyticsDataPoint[] => {
  const values = new Map<string, number>();
  for (const event of events) {
    const key = bucketKey(event, granularity);
    values.set(key, (values.get(key) ?? 0) + valueOf(event));
  }
  return pointsFromValues(values);
};

const uniqueByBucket = (
  events: ReadonlyArray<StoredAnalyticsEvent>,
  granularity: TimeGranularity,
  keyOf: (event: StoredAnalyticsEvent) => string,
): AnalyticsDataPoint[] => {
  const values = new Map<string, Set<string>>();
  for (const event of events) {
    const key = bucketKey(event, granularity);
    const bucket = values.get(key) ?? new Set<string>();
    bucket.add(keyOf(event));
    values.set(key, bucket);
  }
  return pointsFromValues(new Map([...values].map(([key, bucket]) => [key, bucket.size])));
};

const combine = (
  left: ReadonlyArray<AnalyticsDataPoint>,
  right: ReadonlyArray<AnalyticsDataPoint>,
  operation: (left: number, right: number) => number,
): AnalyticsDataPoint[] => {
  const leftByTime = new Map(left.map((point) => [point.timestamp.toISOString(), point.value]));
  const rightByTime = new Map(right.map((point) => [point.timestamp.toISOString(), point.value]));
  const timestamps = new Set([...leftByTime.keys(), ...rightByTime.keys()]);
  return [...timestamps]
    .sort((a, b) => a.localeCompare(b))
    .map((timestamp) => ({
      timestamp: dateFrom(timestamp),
      value: operation(leftByTime.get(timestamp) ?? 0, rightByTime.get(timestamp) ?? 0),
    }));
};

const rate = (numerator: number, denominator: number): number => {
  if (denominator <= 0) return 0;
  return (numerator / denominator) * 100;
};

const ratio = (numerator: number, denominator: number): number => {
  if (denominator <= 0) return 0;
  return numerator / denominator;
};

const growthRate = (current: number, previous: number): number => {
  if (previous !== 0) return rate(current - previous, previous);
  if (current > 0) return 100;
  return 0;
};

/** Computes one built-in analytics series from portable event rows. */
export const resolvePostgresAnalyticsSeries = (input: {
  readonly end: Date;
  readonly events: ReadonlyArray<StoredAnalyticsEvent>;
  readonly filters: CompiledAnalyticsFilter;
  readonly granularity: TimeGranularity;
  readonly insightId: BuiltInInsightId;
  readonly start: Date;
}): AnalyticsDataPoint[] => {
  const filtered = input.events.filter(
    (event) => matchesFilters(event, input.filters) && withinRange(event, input.start, input.end),
  );
  const cache = new Map<BuiltInInsightId, AnalyticsDataPoint[]>();

  const series = (insightId: BuiltInInsightId): AnalyticsDataPoint[] => {
    const cached = cache.get(insightId);
    if (cached) return cached;
    let result: AnalyticsDataPoint[];
    switch (insightId) {
      case "builtin/revenue":
        result = sumByBucket(
          filtered.filter((event) => isReservedRevenueEventName(event.eventName)),
          input.granularity,
          (event) =>
            numberProperty(event, "gross_amount_usd", "grossAmountUsd", "amount_usd", "amountUsd") /
            100,
        );
        break;
      case "builtin/mrr":
        result = sumByBucket(
          filtered.filter(
            (event) =>
              (event.eventName === "$subscription.created" ||
                event.eventName === "$subscription.renewed") &&
              !booleanProperty(event, "is_trial", "isTrial"),
          ),
          input.granularity,
          (event) =>
            numberProperty(event, "gross_amount_usd", "grossAmountUsd", "amount_usd", "amountUsd") /
            100,
        );
        break;
      case "builtin/arr":
        result = series("builtin/mrr").map((point) => ({ ...point, value: point.value * 12 }));
        break;
      case "builtin/churned_revenue":
        result = sumByBucket(
          filtered.filter((event) => eventNames.subscriptionChurn.has(event.eventName)),
          input.granularity,
          (event) =>
            numberProperty(event, "gross_amount_usd", "grossAmountUsd", "amount_usd", "amountUsd") /
            100,
        );
        break;
      case "builtin/active_subscriptions":
      case "builtin/active_trials": {
        const trials = insightId === "builtin/active_trials";
        result = uniqueByBucket(
          filtered.filter(
            (event) =>
              eventNames.subscriptionActivity.has(event.eventName) &&
              booleanProperty(event, "is_trial", "isTrial") === trials,
          ),
          input.granularity,
          subscriptionId,
        );
        break;
      }
      case "builtin/new_subscriptions":
      case "builtin/trials": {
        const trials = insightId === "builtin/trials";
        result = sumByBucket(
          filtered.filter(
            (event) =>
              event.eventName === "$subscription.created" &&
              booleanProperty(event, "is_trial", "isTrial") === trials,
          ),
          input.granularity,
          () => 1,
        );
        break;
      }
      case "builtin/churned_subscriptions":
        result = sumByBucket(
          filtered.filter((event) => eventNames.subscriptionChurn.has(event.eventName)),
          input.granularity,
          () => 1,
        );
        break;
      case "builtin/trial_conversions":
        result = uniqueByBucket(
          filtered.filter(
            (event) =>
              eventNames.subscriptionActivity.has(event.eventName) &&
              booleanProperty(event, "converted_from_trial", "convertedFromTrial"),
          ),
          input.granularity,
          subscriptionId,
        );
        break;
      case "builtin/person_count":
      case "builtin/new_persons": {
        const firstSeen = new Map<string, StoredAnalyticsEvent>();
        for (const event of input.events.filter((candidate) =>
          matchesFilters(candidate, input.filters),
        )) {
          const key = personKey(event);
          const existing = firstSeen.get(key);
          if (!existing || existing.eventTimestamp > event.eventTimestamp)
            firstSeen.set(key, event);
        }
        const firstSeenEvents = [...firstSeen.values()].filter((event) => {
          if (insightId === "builtin/person_count") return event.eventTimestamp <= input.end;
          return withinRange(event, input.start, input.end);
        });
        result = sumByBucket(firstSeenEvents, input.granularity, () => 1);
        break;
      }
      case "builtin/mrr_growth_rate": {
        const mrr = series("builtin/mrr");
        result = mrr.map((point, index) => {
          const previous = mrr[index - 1]?.value ?? 0;
          const value = growthRate(point.value, previous);
          return { timestamp: point.timestamp, value };
        });
        break;
      }
      case "builtin/churn_rate":
        result = combine(
          series("builtin/churned_subscriptions"),
          series("builtin/active_subscriptions"),
          (churned, active) => rate(churned, active + churned),
        );
        break;
      case "builtin/retention":
        result = combine(
          series("builtin/active_subscriptions"),
          series("builtin/churned_subscriptions"),
          (active, churned) => rate(active, active + churned),
        );
        break;
      case "builtin/arpu":
        result = combine(series("builtin/revenue"), series("builtin/person_count"), ratio);
        break;
      case "builtin/arppu": {
        const paying = uniqueByBucket(
          filtered.filter(
            (event) =>
              isReservedRevenueEventName(event.eventName) &&
              numberProperty(
                event,
                "gross_amount_usd",
                "grossAmountUsd",
                "amount_usd",
                "amountUsd",
              ) > 0,
          ),
          input.granularity,
          personKey,
        );
        result = combine(series("builtin/revenue"), paying, ratio);
        break;
      }
      case "builtin/active_subscribers_growth": {
        const active = series("builtin/active_subscriptions");
        result = active.map((point, index) => {
          const previous = active[index - 1]?.value ?? 0;
          return {
            timestamp: point.timestamp,
            value: growthRate(point.value, previous),
          };
        });
        break;
      }
      case "builtin/subscriber_lifetime_value":
        result = combine(series("builtin/arpu"), series("builtin/churn_rate"), (arpu, churn) =>
          ratio(arpu, churn / 100),
        );
        break;
      case "builtin/trial_conversion_rate":
        result = combine(series("builtin/trial_conversions"), series("builtin/trials"), rate);
        break;
    }
    cache.set(insightId, result);
    return result;
  };

  return series(input.insightId);
};
