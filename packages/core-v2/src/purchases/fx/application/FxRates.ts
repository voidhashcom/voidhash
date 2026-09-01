import * as P from "effect/Predicate";
import * as Cache from "effect/Cache";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import {
  FxRateSource,
  type FxRateSourceShape,
  FxRateStore,
} from "../../application/ports/FxRateStore.ts";
import {
  FxRateLookups,
  FxRateWrite,
  type FxRateLookup,
  USD_IDENTITY_RATE,
} from "../domain/FxRate.ts";

const CACHE_TTL = Duration.hours(1);
const CACHE_CAPACITY = 1_024;
const CARRY_FORWARD_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1_000;

const GetUsdRateInput = Schema.Struct({
  asOf: Schema.Date,
  currency: Schema.NonEmptyString,
});

export class FxRateServiceError extends Schema.TaggedErrorClass<FxRateServiceError>(
  "FxRateServiceError",
)("FxRateServiceError", { cause: Schema.String }) {}

export interface FxRatesShape {
  readonly ensureSeeded: () => Effect.Effect<number, FxRateServiceError>;
  readonly getUsdRate: (input: {
    readonly asOf: Date;
    readonly currency: string;
  }) => Effect.Effect<Option.Option<FxRateLookup>, FxRateServiceError>;
  readonly refreshLatest: () => Effect.Effect<number, FxRateServiceError>;
}

const fromEpochMillis = (millis: number): Date => DateTime.toDateUtc(DateTime.makeUnsafe(millis));

const toUtcDay = (date: Date): Date =>
  DateTime.toDateUtc(DateTime.startOf(DateTime.makeUnsafe(date), "day"));

const cacheKey = (currency: string, asOfDate: Date) => `${currency}:${asOfDate.getTime()}`;

const parseCacheKey = (key: string) => {
  const separator = key.indexOf(":");
  return {
    asOfDate: fromEpochMillis(Number(key.slice(separator + 1))),
    currency: key.slice(0, separator),
  };
};

const isFxRateWrite = Schema.is(FxRateWrite);

const serviceError = (error: unknown) => {
  if (error instanceof FxRateServiceError) return error;
  let cause = String(error);
  if (P.isObject(error) && error !== null && "message" in error) {
    cause = String(error.message);
  }
  return new FxRateServiceError({ cause });
};

const makeFxRates = Effect.fn("makeFxRates")(function* () {
  const source = yield* FxRateSource;
  const store = yield* FxRateStore;

  const loadRate = ({ asOfDate, currency }: { asOfDate: Date; currency: string }) =>
    store.findExact({ asOfDate, currency }).pipe(
      Effect.flatMap((exact) => {
        if (Option.isSome(exact)) return Effect.succeed(exact);
        return store
          .findMostRecent({
            currency,
            from: fromEpochMillis(asOfDate.getTime() - CARRY_FORWARD_DAYS * MS_PER_DAY),
            to: asOfDate,
          })
          .pipe(
            Effect.map((rate) => {
              if (Option.isNone(rate)) return Option.none<FxRateLookup>();
              return Option.some({
                asOfDate: rate.value.asOfDate,
                currency: rate.value.currency,
                rate: rate.value.rate,
                source: `${rate.value.source}:carry_forward`,
              });
            }),
          );
      }),
      Effect.mapError(serviceError),
    );

  const cache = yield* Cache.make<string, Option.Option<FxRateLookup>, FxRateServiceError>({
    capacity: CACHE_CAPACITY,
    lookup: (key) => loadRate(parseCacheKey(key)),
    timeToLive: CACHE_TTL,
  });

  const refreshLatest = () =>
    Effect.gen(function* () {
      const rates = yield* source.fetchLatestUsdRates();
      const decoded = yield* Schema.decodeUnknownEffect(FxRateLookups)(rates);
      // A single non-ISO ticker from the upstream feed must not sink the whole
      // refresh, so unwritable rows are dropped and reported rather than raised.
      const writes = decoded.filter(isFxRateWrite);
      if (writes.length !== decoded.length) {
        const skipped = decoded.filter((rate) => !isFxRateWrite(rate)).map((rate) => rate.currency);
        yield* Effect.logWarning("FxRates.refreshLatest skipped non-ISO currencies", skipped);
      }
      yield* store.persist(writes);
      yield* Effect.forEach(
        writes,
        (rate) => Cache.set(cache, cacheKey(rate.currency, rate.asOfDate), Option.some(rate)),
        { discard: true, concurrency: 1 },
      );
      return writes.length;
    }).pipe(Effect.mapError(serviceError), Effect.withSpan("FxRates.refreshLatest"));

  return {
    ensureSeeded: () =>
      store.hasAny().pipe(
        Effect.mapError(serviceError),
        Effect.flatMap((populated) => {
          if (populated) return Effect.succeed(0);
          return refreshLatest();
        }),
        Effect.withSpan("FxRates.ensureSeeded"),
      ),
    getUsdRate: (input) =>
      Schema.decodeUnknownEffect(GetUsdRateInput)(input).pipe(
        Effect.mapError(serviceError),
        Effect.flatMap(({ asOf, currency: rawCurrency }) => {
          const currency = rawCurrency.toUpperCase();
          const asOfDate = toUtcDay(asOf);
          if (currency === "USD") {
            return Effect.succeed(
              Option.some({
                asOfDate,
                currency,
                rate: USD_IDENTITY_RATE,
                source: "identity",
              }),
            );
          }
          return Cache.get(cache, cacheKey(currency, asOfDate));
        }),
        Effect.withSpan("FxRates.getUsdRate"),
      ),
    refreshLatest,
  } satisfies FxRatesShape;
})();

export class FxRates extends Context.Service<FxRates, FxRatesShape>()(
  "@voidhash/core-v2/purchases/FxRates",
  { make: makeFxRates },
) {
  static readonly layer = Layer.effect(FxRates)(FxRates.make);
}

export { FxRates as FxRateService };
export type FxRateFetcher = FxRateSourceShape;
