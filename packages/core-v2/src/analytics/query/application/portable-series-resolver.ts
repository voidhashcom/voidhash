import type {
  AnalyticsDataPoint,
  BuiltInInsightId,
  CompiledAnalyticsFilter,
  TimeGranularity,
} from "../domain/Analytics.ts";
import { isRevenueMoneyEventName } from "../../domain/InternalAnalyticsEvents.ts";
import type { StoredAnalyticsEvent } from "../../application/ports.ts";
import { DateTime } from "effect";

const eventNames = {
  subscriptionActivity: new Set(["$subscription.created", "$subscription.renewed"]),
  subscriptionChurn: new Set(["$subscription.canceled", "$subscription.expired"]),
};

const property = (event: typeof StoredAnalyticsEvent.Type, ...keys: ReadonlyArray<string>) => {
  for (const key of keys) {
    const value = event.properties[key];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
};

const optionalNumberProperty = (
  event: typeof StoredAnalyticsEvent.Type,
  ...keys: ReadonlyArray<string>
) => {
  const value = property(event, ...keys);
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value;
};

const numberProperty = (event: typeof StoredAnalyticsEvent.Type, ...keys: ReadonlyArray<string>) =>
  optionalNumberProperty(event, ...keys) ?? 0;

const booleanProperty = (event: typeof StoredAnalyticsEvent.Type, ...keys: ReadonlyArray<string>) =>
  keys.some((key) => event.properties[key] === true);

const stringProperty = (
  event: typeof StoredAnalyticsEvent.Type,
  ...keys: ReadonlyArray<string>
) => {
  const value = property(event, ...keys);
  if (typeof value !== "string") return "";
  return value;
};

const subscriptionId = (event: typeof StoredAnalyticsEvent.Type) =>
  stringProperty(
    event,
    "subscription_id",
    "subscriptionId",
    "provider_subscription_id",
    "providerSubscriptionId",
    "store_subscription_id",
    "storeSubscriptionId",
  ) || event.eventId;

const personKey = (event: typeof StoredAnalyticsEvent.Type) => event.personId ?? event.distinctId;

const dateFrom = (value: Date | number | string) => DateTime.toDateUtc(DateTime.makeUnsafe(value));

const startOfBucket = (date: Date, granularity: typeof TimeGranularity.Type) => {
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

const bucketKey = (
  event: typeof StoredAnalyticsEvent.Type,
  granularity: typeof TimeGranularity.Type,
) => startOfBucket(event.eventTimestamp, granularity).toISOString();

const withinRange = (event: typeof StoredAnalyticsEvent.Type, start: Date, end: Date) =>
  event.eventTimestamp >= start && event.eventTimestamp <= end;

const matchesFilters = (
  event: typeof StoredAnalyticsEvent.Type,
  filters: CompiledAnalyticsFilter,
) => {
  if (!filters.projectIds.includes(event.projectId)) return false;
  if (filters.providerEnvironments?.length === 0) return false;
  const productId = stringProperty(event, "product_id", "productId", "product.id");
  if (filters.productIds !== undefined && !filters.productIds.includes(productId)) return false;
  // An absent provider_environment is not evidence against the filter; only a
  // present-but-unlisted environment excludes the event.
  const environment = optionalNumberProperty(event, "provider_environment", "providerEnvironment");
  if (
    filters.providerEnvironments !== undefined &&
    environment !== undefined &&
    !filters.providerEnvironments.includes(environment)
  ) {
    return false;
  }
  return true;
};

const pointsFromValues = (values: ReadonlyMap<string, number>) =>
  [...values.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([timestamp, value]) => ({ timestamp: dateFrom(timestamp), value }));

const advanceBucket = (date: Date, granularity: typeof TimeGranularity.Type) => {
  const next = dateFrom(date.getTime());
  if (granularity === "hour") next.setUTCHours(next.getUTCHours() + 1);
  else if (granularity === "day") next.setUTCDate(next.getUTCDate() + 1);
  else if (granularity === "week") next.setUTCDate(next.getUTCDate() + 7);
  else if (granularity === "month") next.setUTCMonth(next.getUTCMonth() + 1);
  else if (granularity === "quarter") next.setUTCMonth(next.getUTCMonth() + 3);
  else next.setUTCFullYear(next.getUTCFullYear() + 1);
  return next;
};

interface SubscriptionState {
  readonly amountUsd: number;
  readonly trial: boolean;
}

const subscriptionStockByBucket = (input: {
  readonly end: Date;
  readonly events: ReadonlyArray<typeof StoredAnalyticsEvent.Type>;
  readonly granularity: typeof TimeGranularity.Type;
  readonly start: Date;
  readonly valueOf: (states: ReadonlyMap<string, SubscriptionState>) => number;
}) => {
  const lifecycle = input.events
    .filter(
      (event) =>
        eventNames.subscriptionActivity.has(event.eventName) ||
        eventNames.subscriptionChurn.has(event.eventName),
    )
    .sort(
      (left, right) =>
        left.eventTimestamp.getTime() - right.eventTimestamp.getTime() ||
        left.eventId.localeCompare(right.eventId),
    );
  const states = new Map<string, SubscriptionState>();
  const apply = (event: typeof StoredAnalyticsEvent.Type) => {
    const id = subscriptionId(event);
    if (eventNames.subscriptionChurn.has(event.eventName)) {
      states.delete(id);
      return;
    }
    const previous = states.get(id);
    const amount = optionalNumberProperty(
      event,
      "gross_amount_usd",
      "grossAmountUsd",
      "amount_usd",
      "amountUsd",
    );
    let amountUsd = previous?.amountUsd ?? 0;
    if (amount !== undefined) amountUsd = amount / 100;
    states.set(id, {
      amountUsd,
      trial: booleanProperty(event, "is_trial", "isTrial"),
    });
  };
  let index = 0;
  while (lifecycle[index] && lifecycle[index].eventTimestamp < input.start) {
    apply(lifecycle[index]);
    index += 1;
  }
  const points: (typeof AnalyticsDataPoint.Type)[] = [];
  for (
    let cursor = startOfBucket(input.start, input.granularity);
    cursor.getTime() <= input.end.getTime();
    cursor = advanceBucket(cursor, input.granularity)
  ) {
    const next = advanceBucket(cursor, input.granularity);
    const finalBucket = next.getTime() > input.end.getTime();
    while (lifecycle[index]) {
      const timestamp = lifecycle[index].eventTimestamp.getTime();
      let inBucket = timestamp < next.getTime();
      if (finalBucket) inBucket = timestamp <= input.end.getTime();
      if (!inBucket) break;
      apply(lifecycle[index]);
      index += 1;
    }
    points.push({ timestamp: dateFrom(cursor.getTime()), value: input.valueOf(states) });
  }
  return points;
};

/** Zero-fills every bucket between start and end so series carry no axis gaps. */
const fillSeries = (
  points: ReadonlyArray<typeof AnalyticsDataPoint.Type>,
  start: Date,
  end: Date,
  granularity: typeof TimeGranularity.Type,
) => {
  const byKey = new Map(
    points.map((point) => [startOfBucket(point.timestamp, granularity).toISOString(), point]),
  );
  const filled: (typeof AnalyticsDataPoint.Type)[] = [];
  for (
    let cursor = startOfBucket(start, granularity);
    cursor.getTime() <= end.getTime();
    cursor = advanceBucket(cursor, granularity)
  ) {
    filled.push(
      byKey.get(cursor.toISOString()) ?? { timestamp: dateFrom(cursor.getTime()), value: 0 },
    );
  }
  return filled;
};

const sumByBucket = (
  events: ReadonlyArray<typeof StoredAnalyticsEvent.Type>,
  granularity: typeof TimeGranularity.Type,
  valueOf: (event: typeof StoredAnalyticsEvent.Type) => number,
) => {
  const values = new Map<string, number>();
  for (const event of events) {
    const key = bucketKey(event, granularity);
    values.set(key, (values.get(key) ?? 0) + valueOf(event));
  }
  return pointsFromValues(values);
};

const uniqueByBucket = (
  events: ReadonlyArray<typeof StoredAnalyticsEvent.Type>,
  granularity: typeof TimeGranularity.Type,
  keyOf: (event: typeof StoredAnalyticsEvent.Type) => string,
) => {
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
  left: ReadonlyArray<typeof AnalyticsDataPoint.Type>,
  right: ReadonlyArray<typeof AnalyticsDataPoint.Type>,
  operation: (left: number, right: number) => number,
) => {
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

const rate = (numerator: number, denominator: number) => {
  if (denominator <= 0) return 0;
  return (numerator / denominator) * 100;
};

const ratio = (numerator: number, denominator: number) => {
  if (denominator <= 0) return 0;
  return numerator / denominator;
};

const growthRate = (current: number, previous: number) => {
  if (previous !== 0) return rate(current - previous, previous);
  if (current > 0) return 100;
  return 0;
};

/** Computes one built-in analytics series from storage-neutral event rows. */
export const resolvePortableAnalyticsSeries = (input: {
  readonly end: Date;
  readonly events: ReadonlyArray<typeof StoredAnalyticsEvent.Type>;
  readonly filters: CompiledAnalyticsFilter;
  readonly granularity: typeof TimeGranularity.Type;
  readonly insightId: typeof BuiltInInsightId.Type;
  readonly start: Date;
}): (typeof AnalyticsDataPoint.Type)[] => {
  const matching = input.events.filter((event) => matchesFilters(event, input.filters));
  const filtered = matching.filter((event) => withinRange(event, input.start, input.end));
  const cache = new Map<typeof BuiltInInsightId.Type, (typeof AnalyticsDataPoint.Type)[]>();

  const series = (insightId: typeof BuiltInInsightId.Type): (typeof AnalyticsDataPoint.Type)[] => {
    const cached = cache.get(insightId);
    if (cached) return cached;
    let result: (typeof AnalyticsDataPoint.Type)[];
    switch (insightId) {
      case "builtin/revenue":
        result = sumByBucket(
          filtered.filter((event) => isRevenueMoneyEventName(event.eventName)),
          input.granularity,
          (event) =>
            numberProperty(event, "gross_amount_usd", "grossAmountUsd", "amount_usd", "amountUsd") /
            100,
        );
        break;
      case "builtin/mrr":
        result = subscriptionStockByBucket({
          end: input.end,
          events: matching,
          granularity: input.granularity,
          start: input.start,
          valueOf: (states) =>
            [...states.values()].reduce((total, subscription) => {
              if (subscription.trial) return total;
              return total + subscription.amountUsd;
            }, 0),
        });
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
        result = subscriptionStockByBucket({
          end: input.end,
          events: matching,
          granularity: input.granularity,
          start: input.start,
          valueOf: (states) =>
            [...states.values()].filter((subscription) => subscription.trial === trials).length,
        });
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
      case "builtin/trial_conversions": {
        // No emitter stamps a conversion property, so conversion is derived from
        // event sequences: a subscription that started as a trial and later saw
        // a paid renewal; conversion time is that first paid renewal.
        const trialStarts = new Map<string, Date>();
        const conversions = new Map<string, typeof StoredAnalyticsEvent.Type>();
        for (const event of matching) {
          if (event.eventTimestamp > input.end) continue;
          if (
            event.eventName !== "$subscription.created" &&
            event.eventName !== "$subscription.renewed"
          )
            continue;
          const id = subscriptionId(event);
          if (event.eventName === "$subscription.created") {
            if (booleanProperty(event, "is_trial", "isTrial")) {
              const existing = trialStarts.get(id);
              if (!existing || event.eventTimestamp < existing) {
                trialStarts.set(id, event.eventTimestamp);
              }
            }
            continue;
          }
          const trialStart = trialStarts.get(id);
          if (!trialStart || event.eventTimestamp < trialStart) continue;
          if (booleanProperty(event, "is_trial", "isTrial")) continue;
          const existing = conversions.get(id);
          if (!existing || event.eventTimestamp < existing.eventTimestamp)
            conversions.set(id, event);
        }
        result = uniqueByBucket(
          [...conversions.values()].filter((event) => withinRange(event, input.start, input.end)),
          input.granularity,
          subscriptionId,
        );
        break;
      }
      case "builtin/person_count":
      case "builtin/new_persons": {
        const firstSeen = new Map<string, typeof StoredAnalyticsEvent.Type>();
        for (const event of matching) {
          if (event.eventTimestamp > input.end) continue;
          const key = personKey(event);
          const existing = firstSeen.get(key);
          if (!existing || existing.eventTimestamp > event.eventTimestamp)
            firstSeen.set(key, event);
        }
        const firstSeenEvents = [...firstSeen.values()].filter((event) =>
          withinRange(event, input.start, input.end),
        );
        // Fill first so the cumulative total carries zero buckets forward
        // instead of being overwritten by the final zero-fill pass.
        const perBucket = fillSeries(
          sumByBucket(firstSeenEvents, input.granularity, () => 1),
          input.start,
          input.end,
          input.granularity,
        );
        if (insightId === "builtin/new_persons") {
          result = perBucket;
          break;
        }
        let running = [...firstSeen.values()].filter(
          (event) => event.eventTimestamp < input.start,
        ).length;
        result = perBucket.map((point) => {
          running += point.value;
          return { timestamp: point.timestamp, value: running };
        });
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
              isRevenueMoneyEventName(event.eventName) &&
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

  return fillSeries(series(input.insightId), input.start, input.end, input.granularity);
};
