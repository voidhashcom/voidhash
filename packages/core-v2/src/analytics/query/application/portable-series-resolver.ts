import * as P from "effect/Predicate";
import * as Arr from "effect/Array";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as Order from "effect/Order";
import type {
  AnalyticsDataPoint,
  BuiltInInsightId,
  CompiledAnalyticsFilter,
  TimeGranularity,
} from "../domain/Analytics.ts";
import { isRevenueMoneyEventName } from "../../domain/InternalAnalyticsEvents.ts";
import type { StoredAnalyticsEvent } from "../../application/ports.ts";
import * as DateTime from "effect/DateTime";

const eventNames = {
  subscriptionActivity: HashSet.make("$subscription.created", "$subscription.renewed"),
  subscriptionChurn: HashSet.make("$subscription.canceled", "$subscription.expired"),
};

const property = (event: typeof StoredAnalyticsEvent.Type, ...keys: ReadonlyArray<string>) =>
  Arr.findFirst(keys, (key) => {
    const value = event.properties[key];
    return value !== undefined && value !== null;
  }).pipe(
    Option.map((key) => event.properties[key]),
    Option.getOrUndefined,
  );

const optionalNumberProperty = (
  event: typeof StoredAnalyticsEvent.Type,
  ...keys: ReadonlyArray<string>
) => {
  const value = property(event, ...keys);
  if (!P.isNumber(value) || !Number.isFinite(value)) return undefined;
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
  if (!P.isString(value)) return "";
  return value;
};

/** Property names exactly as the revenue emitter writes them (see `RevenueEvents.ts`). */
const REVENUE_PROPERTY = {
  /** Deprecated mirror of `grossAmountUsd`, still emitted for readers that predate it. */
  amountUsd: "amountUsd",
  grossAmountUsd: "grossAmountUsd",
  isTrial: "isTrial",
  productId: "productId",
  providerEnvironment: "providerEnvironment",
  providerSubscriptionId: "providerSubscriptionId",
} as const;

const subscriptionId = (event: typeof StoredAnalyticsEvent.Type) =>
  stringProperty(event, REVENUE_PROPERTY.providerSubscriptionId) || event.eventId;

const grossAmountUsdCents = (event: typeof StoredAnalyticsEvent.Type) =>
  numberProperty(event, REVENUE_PROPERTY.grossAmountUsd, REVENUE_PROPERTY.amountUsd);

const isTrial = (event: typeof StoredAnalyticsEvent.Type) =>
  booleanProperty(event, REVENUE_PROPERTY.isTrial);

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
  const productId = stringProperty(event, REVENUE_PROPERTY.productId);
  if (filters.productIds !== undefined && !filters.productIds.includes(productId)) return false;
  // An absent provider_environment is not evidence against the filter; only a
  // present-but-unlisted environment excludes the event.
  const environment = optionalNumberProperty(event, REVENUE_PROPERTY.providerEnvironment);
  if (
    filters.providerEnvironments !== undefined &&
    environment !== undefined &&
    !filters.providerEnvironments.includes(environment)
  ) {
    return false;
  }
  return true;
};

const pointsFromValues = (values: Iterable<readonly [string, number]>) =>
  Arr.sort(
    Arr.fromIterable(values),
    Order.mapInput(Order.String, ([timestamp]: readonly [string, number]) => timestamp),
  ).map(([timestamp, value]) => ({ timestamp: dateFrom(timestamp), value }));

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
  readonly valueOf: (states: HashMap.HashMap<string, SubscriptionState>) => number;
}) => {
  const lifecycle = Arr.sort(
    input.events.filter(
      (event) =>
        HashSet.has(eventNames.subscriptionActivity, event.eventName) ||
        HashSet.has(eventNames.subscriptionChurn, event.eventName),
    ),
    Order.make<typeof StoredAnalyticsEvent.Type>((left, right) => {
      const byTimestamp = left.eventTimestamp.getTime() - right.eventTimestamp.getTime();
      if (byTimestamp < 0) return -1;
      if (byTimestamp > 0) return 1;
      const byId = left.eventId.localeCompare(right.eventId);
      if (byId < 0) return -1;
      if (byId > 0) return 1;
      return 0;
    }),
  );
  let states = HashMap.empty<string, SubscriptionState>();
  const apply = (event: typeof StoredAnalyticsEvent.Type) => {
    const id = subscriptionId(event);
    if (HashSet.has(eventNames.subscriptionChurn, event.eventName)) {
      states = HashMap.remove(states, id);
      return;
    }
    const previous = HashMap.get(states, id);
    const amount = optionalNumberProperty(
      event,
      REVENUE_PROPERTY.grossAmountUsd,
      REVENUE_PROPERTY.amountUsd,
    );
    let amountUsd = Option.match(previous, { onNone: () => 0, onSome: (value) => value.amountUsd });
    if (amount !== undefined) amountUsd = amount / 100;
    states = HashMap.set(states, id, {
      amountUsd,
      trial: isTrial(event),
    });
  };
  let index = 0;
  const applyBeforeStart = (): void => {
    const event = lifecycle[index];
    if (!event || event.eventTimestamp >= input.start) return;
    apply(event);
    index += 1;
    applyBeforeStart();
  };
  applyBeforeStart();
  const points: (typeof AnalyticsDataPoint.Type)[] = [];
  const collectBuckets = (cursor: Date): void => {
    if (cursor.getTime() > input.end.getTime()) return;
    const next = advanceBucket(cursor, input.granularity);
    const finalBucket = next.getTime() > input.end.getTime();
    const applyBucketEvents = (): void => {
      const event = lifecycle[index];
      if (!event) return;
      const timestamp = event.eventTimestamp.getTime();
      let inBucket = timestamp < next.getTime();
      if (finalBucket) inBucket = timestamp <= input.end.getTime();
      if (!inBucket) return;
      apply(event);
      index += 1;
      applyBucketEvents();
    };
    applyBucketEvents();
    points.push({ timestamp: dateFrom(cursor.getTime()), value: input.valueOf(states) });
    collectBuckets(next);
  };
  collectBuckets(startOfBucket(input.start, input.granularity));
  return points;
};

/** Zero-fills every bucket between start and end so series carry no axis gaps. */
const fillSeries = (
  points: ReadonlyArray<typeof AnalyticsDataPoint.Type>,
  start: Date,
  end: Date,
  granularity: typeof TimeGranularity.Type,
) => {
  const byKey = HashMap.fromIterable(
    points.map((point) => [startOfBucket(point.timestamp, granularity).toISOString(), point]),
  );
  const filled: (typeof AnalyticsDataPoint.Type)[] = [];
  const fill = (cursor: Date): void => {
    if (cursor.getTime() > end.getTime()) return;
    filled.push(
      Option.getOrElse(HashMap.get(byKey, cursor.toISOString()), () => ({
        timestamp: dateFrom(cursor.getTime()),
        value: 0,
      })),
    );
    fill(advanceBucket(cursor, granularity));
  };
  fill(startOfBucket(start, granularity));
  return filled;
};

const sumByBucket = (
  events: ReadonlyArray<typeof StoredAnalyticsEvent.Type>,
  granularity: typeof TimeGranularity.Type,
  valueOf: (event: typeof StoredAnalyticsEvent.Type) => number,
) => {
  const values = Arr.reduce(events, HashMap.empty<string, number>(), (acc, event) => {
    const key = bucketKey(event, granularity);
    return HashMap.set(acc, key, Option.getOrElse(HashMap.get(acc, key), () => 0) + valueOf(event));
  });
  return pointsFromValues(values);
};

const uniqueByBucket = (
  events: ReadonlyArray<typeof StoredAnalyticsEvent.Type>,
  granularity: typeof TimeGranularity.Type,
  keyOf: (event: typeof StoredAnalyticsEvent.Type) => string,
) => {
  const values = Arr.reduce(
    events,
    HashMap.empty<string, HashSet.HashSet<string>>(),
    (acc, event) => {
      const key = bucketKey(event, granularity);
      const bucket = Option.getOrElse(HashMap.get(acc, key), HashSet.empty<string>);
      return HashMap.set(acc, key, HashSet.add(bucket, keyOf(event)));
    },
  );
  return pointsFromValues(HashMap.map(values, HashSet.size));
};

const combine = (
  left: ReadonlyArray<typeof AnalyticsDataPoint.Type>,
  right: ReadonlyArray<typeof AnalyticsDataPoint.Type>,
  operation: (left: number, right: number) => number,
) => {
  const leftByTime = HashMap.fromIterable(
    left.map((point) => [point.timestamp.toISOString(), point.value] as const),
  );
  const rightByTime = HashMap.fromIterable(
    right.map((point) => [point.timestamp.toISOString(), point.value] as const),
  );
  const timestamps = HashSet.fromIterable([
    ...HashMap.keys(leftByTime),
    ...HashMap.keys(rightByTime),
  ]);
  return Arr.sort(Arr.fromIterable(timestamps), Order.String).map((timestamp) => ({
    timestamp: dateFrom(timestamp),
    value: operation(
      Option.getOrElse(HashMap.get(leftByTime, timestamp), () => 0),
      Option.getOrElse(HashMap.get(rightByTime, timestamp), () => 0),
    ),
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
  let cache = HashMap.empty<typeof BuiltInInsightId.Type, (typeof AnalyticsDataPoint.Type)[]>();

  const series = (insightId: typeof BuiltInInsightId.Type): (typeof AnalyticsDataPoint.Type)[] => {
    const cached = HashMap.get(cache, insightId);
    if (Option.isSome(cached)) return cached.value;
    const result = Match.value(insightId).pipe(
      Match.when("builtin/revenue", () =>
        sumByBucket(
          filtered.filter((event) => isRevenueMoneyEventName(event.eventName)),
          input.granularity,
          (event) =>
            grossAmountUsdCents(event) /
            100,
        ),
      ),
      Match.when("builtin/mrr", () =>
        subscriptionStockByBucket({
          end: input.end,
          events: matching,
          granularity: input.granularity,
          start: input.start,
          valueOf: (states) =>
            Arr.fromIterable(HashMap.values(states)).reduce((total, subscription) => {
              if (subscription.trial) return total;
              return total + subscription.amountUsd;
            }, 0),
        }),
      ),
      Match.when("builtin/arr", () =>
        series("builtin/mrr").map((point) => ({ ...point, value: point.value * 12 })),
      ),
      Match.when("builtin/churned_revenue", () =>
        sumByBucket(
          filtered.filter((event) => HashSet.has(eventNames.subscriptionChurn, event.eventName)),
          input.granularity,
          (event) =>
            grossAmountUsdCents(event) /
            100,
        ),
      ),
      Match.whenOr("builtin/active_subscriptions", "builtin/active_trials", (matchedInsightId) => {
        const trials = matchedInsightId === "builtin/active_trials";
        return subscriptionStockByBucket({
          end: input.end,
          events: matching,
          granularity: input.granularity,
          start: input.start,
          valueOf: (states) =>
            Arr.fromIterable(HashMap.values(states)).filter(
              (subscription) => subscription.trial === trials,
            ).length,
        });
      }),
      Match.whenOr("builtin/new_subscriptions", "builtin/trials", (matchedInsightId) => {
        const trials = matchedInsightId === "builtin/trials";
        return sumByBucket(
          filtered.filter(
            (event) =>
              event.eventName === "$subscription.created" &&
              isTrial(event) === trials,
          ),
          input.granularity,
          () => 1,
        );
      }),
      Match.when("builtin/churned_subscriptions", () =>
        sumByBucket(
          filtered.filter((event) => HashSet.has(eventNames.subscriptionChurn, event.eventName)),
          input.granularity,
          () => 1,
        ),
      ),
      Match.when("builtin/trial_conversions", () => {
        // No emitter stamps a conversion property, so conversion is derived from
        // event sequences: a subscription that started as a trial and later saw
        // a paid renewal; conversion time is that first paid renewal.
        const conversionState = Arr.reduce(
          matching,
          {
            conversions: HashMap.empty<string, typeof StoredAnalyticsEvent.Type>(),
            trialStarts: HashMap.empty<string, Date>(),
          },
          (state, event) => {
            if (event.eventTimestamp > input.end) return state;
            if (
              event.eventName !== "$subscription.created" &&
              event.eventName !== "$subscription.renewed"
            )
              return state;
            const id = subscriptionId(event);
            if (event.eventName === "$subscription.created") {
              if (isTrial(event)) {
                const existing = HashMap.get(state.trialStarts, id);
                if (Option.isNone(existing) || event.eventTimestamp < existing.value) {
                  return {
                    ...state,
                    trialStarts: HashMap.set(state.trialStarts, id, event.eventTimestamp),
                  };
                }
              }
              return state;
            }
            const trialStart = HashMap.get(state.trialStarts, id);
            if (Option.isNone(trialStart) || event.eventTimestamp < trialStart.value) return state;
            if (isTrial(event)) return state;
            const existing = HashMap.get(state.conversions, id);
            if (Option.isSome(existing) && event.eventTimestamp >= existing.value.eventTimestamp) {
              return state;
            }
            return { ...state, conversions: HashMap.set(state.conversions, id, event) };
          },
        );
        return uniqueByBucket(
          Arr.fromIterable(HashMap.values(conversionState.conversions)).filter((event) =>
            withinRange(event, input.start, input.end),
          ),
          input.granularity,
          subscriptionId,
        );
      }),
      Match.whenOr("builtin/person_count", "builtin/new_persons", (matchedInsightId) => {
        const firstSeen = Arr.reduce(
          matching,
          HashMap.empty<string, typeof StoredAnalyticsEvent.Type>(),
          (seen, event) => {
            if (event.eventTimestamp > input.end) return seen;
            const key = personKey(event);
            const existing = HashMap.get(seen, key);
            if (Option.isSome(existing) && existing.value.eventTimestamp <= event.eventTimestamp) {
              return seen;
            }
            return HashMap.set(seen, key, event);
          },
        );
        const firstSeenEvents = Arr.fromIterable(HashMap.values(firstSeen)).filter((event) =>
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
        if (matchedInsightId === "builtin/new_persons") return perBucket;
        let running = Arr.fromIterable(HashMap.values(firstSeen)).filter(
          (event) => event.eventTimestamp < input.start,
        ).length;
        return perBucket.map((point) => {
          running += point.value;
          return { timestamp: point.timestamp, value: running };
        });
      }),
      Match.when("builtin/mrr_growth_rate", () => {
        const mrr = series("builtin/mrr");
        return mrr.map((point, index) => {
          const previous = mrr[index - 1]?.value ?? 0;
          const value = growthRate(point.value, previous);
          return { timestamp: point.timestamp, value };
        });
      }),
      Match.when("builtin/churn_rate", () =>
        combine(
          series("builtin/churned_subscriptions"),
          series("builtin/active_subscriptions"),
          (churned, active) => rate(churned, active + churned),
        ),
      ),
      Match.when("builtin/retention", () =>
        combine(
          series("builtin/active_subscriptions"),
          series("builtin/churned_subscriptions"),
          (active, churned) => rate(active, active + churned),
        ),
      ),
      Match.when("builtin/arpu", () =>
        combine(series("builtin/revenue"), series("builtin/person_count"), ratio),
      ),
      Match.when("builtin/arppu", () => {
        const paying = uniqueByBucket(
          filtered.filter(
            (event) =>
              isRevenueMoneyEventName(event.eventName) && grossAmountUsdCents(event) > 0,
          ),
          input.granularity,
          personKey,
        );
        return combine(series("builtin/revenue"), paying, ratio);
      }),
      Match.when("builtin/active_subscribers_growth", () => {
        const active = series("builtin/active_subscriptions");
        return active.map((point, index) => {
          const previous = active[index - 1]?.value ?? 0;
          return {
            timestamp: point.timestamp,
            value: growthRate(point.value, previous),
          };
        });
      }),
      Match.when("builtin/subscriber_lifetime_value", () =>
        combine(series("builtin/arpu"), series("builtin/churn_rate"), (arpu, churn) =>
          ratio(arpu, churn / 100),
        ),
      ),
      Match.when("builtin/trial_conversion_rate", () =>
        combine(series("builtin/trial_conversions"), series("builtin/trials"), rate),
      ),
      Match.exhaustive,
    );
    cache = HashMap.set(cache, insightId, result);
    return result;
  };

  return fillSeries(series(input.insightId), input.start, input.end, input.granularity);
};
