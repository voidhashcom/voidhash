/**
 * Foreign-exchange rate lookup. Owns the daily `(currency, USD)` cache used
 * by purchase-processing to populate `transaction.*_amount_usd` columns and
 * the USD payload on `PurchaseProcessingMoney`.
 *
 * Read path — two tiers, and it never contacts the upstream provider:
 *   1. process-local {@link Cache} keyed by `(currency, asOfUtcDay)`, 1h TTL
 *   2. durable cache in the `fx_rate` MySQL table
 *
 * A durable-cache miss for the exact `(currency, day)` falls back to the most
 * recent earlier rate within {@link FX_RATE_CARRY_FORWARD_MAX_AGE_DAYS} days
 * (carry-forward, so a purchase processed before the daily sync still gets a USD
 * mirror); only when nothing is in range does the lookup return `Option.none()`.
 * It never contacts the upstream provider on the read path either way — the
 * provider (ExchangeRate-API) bills every request against a small monthly quota,
 * so a read-path fetch would let a single unknown currency drain it. The
 * in-memory cache memoizes the resolved value (carried rate or negative) too, so
 * a given `(currency, day)` triggers at most one DB resolution per TTL window —
 * the exact-day lookup, plus a single carry-forward scan when that day misses.
 *
 * The durable cache is filled by exactly two write paths, each of which
 * calls the upstream `/latest/USD` endpoint once — a single request returns
 * rates for every supported currency:
 *   - {@link refreshLatest} — the daily refresh, dispatched by the
 *     `FxRateSyncWorkflow` on a `0 5 * * *` cron from `BackendService`.
 *   - {@link ensureSeeded} — a one-shot seed for an empty `fx_rate` table.
 */
import { constant } from "@voidhash/lib/lang";
import { Cache, Context, DateTime, Duration, Effect, Layer, Option, Schema } from "effect";

import { type FxRateLookup, USD_IDENTITY_RATE } from "../../domain/fxRate/FxRate.ts";
import { Db, type DbError, fxRates } from "@voidhash/db";
import { generateId } from "../../utils/generate-id.ts";
import { createExchangeRateApiFxRateFetcher } from "./exchange-rate-api-fetcher.ts";

/** Default in-memory cache TTL — matches the daily granularity of the data. */
const DEFAULT_CACHE_TTL = Duration.hours(1);

/** Default maximum number of `(currency, day)` keys to keep cached in memory. */
const DEFAULT_CACHE_CAPACITY = 1024;

/** Concurrency for the durable-cache fan-out on bulk persists. */
const DEFAULT_PERSIST_CONCURRENCY = 8;

/** Milliseconds in a day, for carry-forward staleness math. */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Carry-forward window for {@link FxRateService.getUsdRate}: when no rate exists
 * for the exact `(currency, day)`, reuse the most recent earlier rate within
 * this many days. FX drifts slowly, so a few days' staleness is well within
 * rounding for revenue reporting; bounding it stops a delisted currency from
 * carrying a stale rate indefinitely. This is what keeps a purchase processed
 * before the daily `0 5 * * *` sync (or on a provider holiday) from losing its
 * USD mirror.
 */
const FX_RATE_CARRY_FORWARD_MAX_AGE_DAYS = 7;

/**
 * Catch-all service error. Wraps `DatabaseError` and upstream provider
 * failures at the public-method boundary so callers see one stable error tag.
 */
export class FxRateServiceError extends Schema.TaggedErrorClass<FxRateServiceError>(
  "FxRateServiceError",
)("FxRateServiceError", { cause: Schema.String }) {}

/**
 * Pluggable upstream fetcher contract. The bulk endpoint returns one rate per
 * currency the provider supports — the service persists all of them on every
 * refresh so a single API call warms the cache for every supported currency.
 */
export interface FxRateFetcher {
  readonly fetchLatestUsdRates: () => Effect.Effect<
    ReadonlyArray<FxRateLookup>,
    FxRateServiceError
  >;
}

/**
 * Service tag for the upstream fetcher. The live layer (built from
 * {@link FxRateConfig}) wires in {@link createExchangeRateApiFxRateFetcher};
 * tests provide their own via {@link FxRateService.layerWithFetcher}.
 */
export class FxRateFetcherTag extends Context.Service<FxRateFetcherTag, FxRateFetcher>()(
  "core/FxRateFetcher",
) {}

/**
 * Runtime configuration for the live ExchangeRate-API fetcher. Fields are
 * Effect-of-string so the resolver (Alchemy variables / secrets / Config) is
 * decoupled from the service constructor — matches the `WorkosConfig` pattern.
 */
export interface FxRateConfig {
  readonly apiKey: Effect.Effect<string>;
  readonly baseUrl?: Effect.Effect<string>;
}

const buildCacheKey = (currency: string, asOfDate: Date): string =>
  `${currency}:${asOfDate.getTime()}`;

/** Builds a `Date` from epoch milliseconds without the banned `new Date(ms)`. */
const fromEpochMillis = (millis: number): Date => DateTime.toDateUtc(DateTime.makeUnsafe(millis));

const parseCacheKey = (key: string): { readonly currency: string; readonly asOfDate: Date } => {
  const separatorIndex = key.indexOf(":");
  return {
    asOfDate: fromEpochMillis(Number(key.slice(separatorIndex + 1))),
    currency: key.slice(0, separatorIndex),
  };
};

/** Truncates a `Date` to midnight UTC, matching the `(currency, as_of_date)` unique index. */
const toUtcDay = (d: Date): Date =>
  fromEpochMillis(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/** Formats a `Date` as a low-cardinality `YYYY-MM-DD` UTC day label for span attributes. */
const toUtcDayString = (d: Date): string => toUtcDay(d).toISOString().slice(0, 10);

const make = Effect.gen(function* () {
  const fetcher = yield* FxRateFetcherTag;
  const db = yield* Db;
  // Captured once for the process-local cache lookup below: `Cache.make` builds
  // its lookup at construction time, so the lookup effect cannot itself require
  // `Db`. FX reads never run inside a transaction, so binding the ambient `Db`
  // here (rather than per-call) is safe.
  const cacheDb = db;

  /**
   * In-memory cache lookup function: reads the durable DB cache only, never
   * the upstream provider (see the module header for why). An exact-day miss
   * carries forward the most recent earlier rate within
   * {@link FX_RATE_CARRY_FORWARD_MAX_AGE_DAYS} days; only a true gap returns
   * `Option.none()`, which the {@link Cache} memoizes for the TTL so an unknown
   * currency doesn't repeatedly hit the DB either.
   */
  const loadRate = Effect.fn("FxRateService.loadRate")(function* (input: {
    readonly currency: string;
    readonly asOfDate: Date;
  }) {
    yield* Effect.annotateCurrentSpan("voidhash.fx.currency", input.currency);
    yield* Effect.annotateCurrentSpan("voidhash.fx.as_of_day", toUtcDayString(input.asOfDate));
    const cached = yield* db.query.fxRates.findFirst({
      where: { currency: input.currency, asOfDate: { eq: input.asOfDate } },
    });
    if (cached) {
      yield* Effect.annotateCurrentSpan("voidhash.fx.cache_outcome", "hit");
      yield* Effect.annotateCurrentSpan("voidhash.fx.rate", cached.usdRate);
      yield* Effect.annotateCurrentSpan("voidhash.fx.source", cached.source);
      return Option.some<FxRateLookup>({
        asOfDate: cached.asOfDate,
        currency: input.currency,
        rate: cached.usdRate,
        source: cached.source,
      });
    }
    // Carry-forward: no rate for this exact day (purchase processed before the
    // daily sync, weekend, or a provider gap). Reuse the most recent earlier
    // rate within the bounded staleness window instead of dropping the USD
    // mirror — a missing mirror would under-count USD revenue downstream. Still
    // returns `none` (no fetch) when nothing is in range, preserving the
    // quota-safe read-path contract.
    const carryForwardCutoff = fromEpochMillis(
      input.asOfDate.getTime() - FX_RATE_CARRY_FORWARD_MAX_AGE_DAYS * MS_PER_DAY,
    );
    const carried = yield* db.query.fxRates.findFirst({
      orderBy: { asOfDate: "desc" },
      where: {
        currency: input.currency,
        asOfDate: { lte: input.asOfDate, gte: carryForwardCutoff },
      },
    });
    if (!carried) {
      yield* Effect.annotateCurrentSpan("voidhash.fx.cache_outcome", "miss");
      return Option.none<FxRateLookup>();
    }
    // Mark the source so a carried rate is distinguishable downstream, and
    // record how stale it is for observability.
    const carriedSource = `${carried.source}:carry_forward`;
    yield* Effect.annotateCurrentSpan("voidhash.fx.cache_outcome", "carry_forward");
    yield* Effect.annotateCurrentSpan(
      "voidhash.fx.carry_forward_days",
      Math.round((input.asOfDate.getTime() - carried.asOfDate.getTime()) / MS_PER_DAY),
    );
    yield* Effect.annotateCurrentSpan(
      "voidhash.fx.rate_as_of_day",
      toUtcDayString(carried.asOfDate),
    );
    yield* Effect.annotateCurrentSpan("voidhash.fx.rate", carried.usdRate);
    yield* Effect.annotateCurrentSpan("voidhash.fx.source", carriedSource);
    return Option.some<FxRateLookup>({
      asOfDate: carried.asOfDate,
      currency: input.currency,
      rate: carried.usdRate,
      source: carriedSource,
    });
  });

  /**
   * Hot-path cache: process-local {@link Cache} → durable DB cache via
   * {@link loadRate}. Holds `Option<FxRateLookup>` so unknown-currency
   * negatives are memoized for the TTL alongside the hits.
   */
  const cache = yield* Cache.make<string, Option.Option<FxRateLookup>, DbError>({
    capacity: DEFAULT_CACHE_CAPACITY,
    lookup: (key) => Effect.provideService(loadRate(parseCacheKey(key)), Db, cacheDb),
    timeToLive: DEFAULT_CACHE_TTL,
  });

  const persistBulk = Effect.fn("FxRateService.persistBulk")(function* (
    rates: ReadonlyArray<FxRateLookup>,
  ) {
    yield* Effect.annotateCurrentSpan("voidhash.fx.rate_count", rates.length);
    yield* Effect.annotateCurrentSpan(
      "voidhash.fx.persist_concurrency",
      DEFAULT_PERSIST_CONCURRENCY,
    );
    const fetchedAt = yield* DateTime.nowAsDate;
    yield* Effect.forEach(
      rates,
      (entry) =>
        // Insert a fetched rate, treating a UNIQUE-key collision on
        // `(currency, as_of_date)` as success — a concurrent caller already
        // populated the row.
        Effect.gen(function* () {
          yield* db
            .insert(fxRates)
            .values({
              asOfDate: entry.asOfDate,
              currency: entry.currency,
              fetchedAt,
              id: generateId("fxRate"),
              source: entry.source,
              usdRate: entry.rate,
            })
            // No-op insert lets the INSERT short-circuit on a race instead of
            // raising Postgres's unique_violation — DO NOTHING keeps the surviving row.
            .onConflictDoNothing({ target: [fxRates.currency, fxRates.asOfDate] });
        }),
      { concurrency: DEFAULT_PERSIST_CONCURRENCY, discard: true },
    );
  });

  /**
   * Returns `currency → USD` for the given date, served from the in-memory
   * cache backed by the durable DB cache. USD short-circuits to the identity
   * rate without touching the cache. An exact-day miss carries forward the most
   * recent earlier rate within {@link FX_RATE_CARRY_FORWARD_MAX_AGE_DAYS} days;
   * `Option.none()` is returned (not an error, and without any upstream fetch)
   * only when the durable cache has no rate for the currency within that window.
   */
  const getUsdRate = Effect.fn("FxRateService.getUsdRate")(function* (input: {
    readonly currency: string;
    readonly asOf: Date;
  }) {
    const currency = input.currency.toUpperCase();
    const asOfDate = toUtcDay(input.asOf);
    yield* Effect.annotateCurrentSpan("voidhash.fx.currency", currency);
    yield* Effect.annotateCurrentSpan("voidhash.fx.as_of_day", toUtcDayString(asOfDate));
    if (currency === "USD") {
      yield* Effect.annotateCurrentSpan("voidhash.fx.cache_outcome", "identity");
      yield* Effect.annotateCurrentSpan("voidhash.fx.rate", USD_IDENTITY_RATE);
      yield* Effect.annotateCurrentSpan("voidhash.fx.source", "identity");
      return Option.some<FxRateLookup>({
        asOfDate,
        currency: "USD",
        rate: USD_IDENTITY_RATE,
        source: "identity",
      });
    }
    const result = yield* Cache.get(cache, buildCacheKey(currency, asOfDate));
    if (Option.isSome(result)) {
      yield* Effect.annotateCurrentSpan("voidhash.fx.rate", result.value.rate);
      yield* Effect.annotateCurrentSpan("voidhash.fx.source", result.value.source);
    }
    return result;
  });

  /**
   * Pulls the full set of supported rates from the upstream provider in a
   * single request, persists them to the durable cache, and warms the
   * in-memory cache. One of only two paths that spend the upstream request
   * quota — the other is {@link ensureSeeded}. Dispatched by the daily
   * `FxRateSyncWorkflow`; also safe to call ad-hoc (e.g. an admin endpoint).
   * Returns the number of rates persisted so callers can log progress.
   */
  const refreshLatest = Effect.fn("FxRateService.refreshLatest")(function* () {
    const rates = yield* fetcher.fetchLatestUsdRates();
    yield* Effect.annotateCurrentSpan("voidhash.fx.rate_count", rates.length);
    yield* persistBulk(rates);
    yield* Effect.forEach(
      rates,
      (entry) =>
        Cache.set(cache, buildCacheKey(entry.currency, entry.asOfDate), Option.some(entry)),
      { discard: true },
    );
    return rates.length;
  });

  /**
   * Seeds the durable cache from the upstream provider when — and only when
   * — the `fx_rate` table is empty. Returns the number of rates seeded, or
   * `0` when the cache was already populated.
   */
  const ensureSeeded = Effect.fn("FxRateService.ensureSeeded")(function* () {
    const existingRow = yield* db.query.fxRates.findFirst();
    const alreadyPopulated = existingRow !== undefined;
    if (alreadyPopulated) {
      yield* Effect.annotateCurrentSpan("voidhash.fx.seed_skipped", true);
      yield* Effect.logDebug("FxRate durable cache already populated — skipping seed");
      return 0;
    }
    yield* Effect.annotateCurrentSpan("voidhash.fx.seed_skipped", false);
    yield* Effect.logInfo("FxRate durable cache is empty — seeding from the upstream provider");
    const seededCount = yield* refreshLatest();
    yield* Effect.annotateCurrentSpan("voidhash.fx.rate_count", seededCount);
    yield* Effect.logInfo(`FxRate seed persisted ${seededCount} rate(s)`);
    return seededCount;
  });

  return constant({ ensureSeeded, getUsdRate, refreshLatest });
});

const liveFetcherLayer = (config: FxRateConfig): Layer.Layer<FxRateFetcherTag> =>
  Layer.effect(FxRateFetcherTag)(
    Effect.gen(function* () {
      const apiKey = yield* config.apiKey;
      if (!config.baseUrl) return createExchangeRateApiFxRateFetcher({ apiKey });
      const baseUrl = yield* config.baseUrl;
      return createExchangeRateApiFxRateFetcher({ apiKey, baseUrl });
    }),
  );

export class FxRateService extends Context.Service<FxRateService>()("core/FxRateService", {
  make,
}) {
  /**
   * Live layer. Wires the ExchangeRate-API fetcher from the provided
   * {@link FxRateConfig}. The daily refresh is dispatched by
   * `FxRateSyncWorkflow` on the `0 5 * * *` cron registered in
   * `packages/backend/src/Service.ts`.
   */
  static readonly layer = (config: FxRateConfig): Layer.Layer<FxRateService, never, Db> =>
    Layer.effect(FxRateService)(FxRateService.make).pipe(Layer.provide(liveFetcherLayer(config)));

  /**
   * Test-friendly layer that accepts an explicit fetcher and bypasses the
   * upstream HTTP call.
   */
  static readonly layerWithFetcher = (
    fetcher: FxRateFetcher,
  ): Layer.Layer<FxRateService, never, Db> =>
    Layer.effect(FxRateService)(FxRateService.make).pipe(
      Layer.provide(Layer.succeed(FxRateFetcherTag, fetcher)),
    );
}
