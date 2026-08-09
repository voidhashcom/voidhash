import { DateTime, Effect, Schema } from "effect";

import { causeMessage } from "@voidhash/lib/lang";
import { FX_RATE_PRECISION, type FxRateLookup } from "../../domain/fxRate/FxRate.ts";
import { FxRateServiceError, type FxRateFetcher } from "./FxRateService.ts";

const DEFAULT_EXCHANGE_RATE_API_BASE_URL = "https://v6.exchangerate-api.com/v6";

const ExchangeRateApiLatestSuccessResponseSchema = Schema.Struct({
  result: Schema.Literal("success"),
  time_last_update_unix: Schema.Number,
  conversion_rates: Schema.Record(Schema.String, Schema.Unknown),
});

const ExchangeRateApiErrorResponseSchema = Schema.Struct({
  result: Schema.Literal("error"),
  // The provider uses kebab-case `error-type` in JSON; both forms are tolerated
  // here so the parser is robust against future naming changes.
  "error-type": Schema.optional(Schema.String),
  error_type: Schema.optional(Schema.String),
});

const ExchangeRateApiLatestResponseSchema = Schema.Union([
  ExchangeRateApiLatestSuccessResponseSchema,
  ExchangeRateApiErrorResponseSchema,
]);

type ExchangeRateApiErrorResponse = typeof ExchangeRateApiErrorResponseSchema.Type;

const decodeLatestResponse = Schema.decodeUnknownEffect(ExchangeRateApiLatestResponseSchema);

/**
 * Runs a thunk that may hand back either a plain value or a promise, mirroring
 * what `await` tolerated before. The `fetch` seam is stubbed synchronously in
 * unit tests, so `Effect.tryPromise` alone cannot consume it.
 */
const tryMaybePromise = <A>(
  thunk: () => A | Promise<A>,
  onError: (cause: unknown) => FxRateServiceError,
): Effect.Effect<A, FxRateServiceError> =>
  Effect.try({ try: thunk, catch: onError }).pipe(
    Effect.flatMap((value) => {
      if (value instanceof Promise) return Effect.tryPromise({ try: () => value, catch: onError });
      return Effect.succeed(value);
    }),
  );

const trimTrailingSlash = (value: string) => value.replace(/\/+$/u, "");

/** Truncates a `Date` to midnight UTC, matching the `(currency, as_of_date)` unique index. */
const toUtcDay = (d: Date): Date =>
  DateTime.toDateUtc(
    DateTime.makeUnsafe(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())),
  );

const buildLatestUrl = (options: { readonly baseUrl: string; readonly apiKey: string }): string =>
  `${trimTrailingSlash(options.baseUrl)}/${encodeURIComponent(options.apiKey)}/latest/USD`;

const getErrorType = (payload: ExchangeRateApiErrorResponse): string | undefined =>
  payload["error-type"] ?? payload.error_type;

const usdToUsdRate = (currency: string, usdToCurrencyRate: number): number => {
  if (currency.toUpperCase() === "USD") return 1;
  return 1 / usdToCurrencyRate;
};

/**
 * Inverts `USD → X` quotes to `X → USD` rates expressed in
 * `FX_RATE_PRECISION` units. Zero / non-finite quotes are skipped so a bad
 * upstream entry doesn't poison the cache with `Infinity`.
 */
const invertRatesToUsdBase = (
  conversionRates: Readonly<Record<string, unknown>>,
  asOfDate: Date,
  sourceLabel: string,
): ReadonlyArray<FxRateLookup> => {
  const out: FxRateLookup[] = [];
  for (const [currency, usdToCurrencyRate] of Object.entries(conversionRates)) {
    if (
      typeof usdToCurrencyRate !== "number" ||
      !Number.isFinite(usdToCurrencyRate) ||
      usdToCurrencyRate <= 0
    ) {
      continue;
    }
    const currencyToUsd = usdToUsdRate(currency, usdToCurrencyRate);
    out.push({
      asOfDate,
      currency: currency.toUpperCase(),
      rate: Math.round(currencyToUsd * FX_RATE_PRECISION),
      source: sourceLabel,
    });
  }
  return out;
};

/**
 * Builds an {@link FxRateFetcher} backed by the ExchangeRate-API standard
 * `/latest/USD` endpoint. Uses the runtime's built-in `fetch` so the fetcher
 * runs natively on Cloudflare Workers without an Effect `HttpClient`
 * dependency.
 *
 * See https://www.exchangerate-api.com/docs/standard-requests for the request
 * / response format.
 */
export const createExchangeRateApiFxRateFetcher = (config: {
  readonly apiKey: string;
  readonly baseUrl?: string;
}): FxRateFetcher => {
  const baseUrl = trimTrailingSlash(config.baseUrl ?? DEFAULT_EXCHANGE_RATE_API_BASE_URL);
  const url = buildLatestUrl({ apiKey: config.apiKey, baseUrl });

  const fetchFailure = (cause: unknown) =>
    new FxRateServiceError({
      cause: `ExchangeRate API fetch failed: ${causeMessage(cause)}`,
    });

  return {
    fetchLatestUsdRates: () =>
      Effect.gen(function* () {
        const response = yield* tryMaybePromise(
          // oxlint-disable-next-line effect/noGlobals -- deliberate raw fetch so this module runs on Cloudflare Workers without pulling in an HttpClient dependency.
          () => fetch(url, { headers: { Accept: "application/json" } }),
          fetchFailure,
        );
        if (!response.ok) {
          return yield* new FxRateServiceError({
            cause: `ExchangeRate API fetch failed: ExchangeRate API returned ${response.status}`,
          });
        }
        const json = yield* tryMaybePromise(() => response.json(), fetchFailure);
        const payload = yield* decodeLatestResponse(json).pipe(Effect.mapError(fetchFailure));

        if (payload.result !== "success") {
          return yield* new FxRateServiceError({
            cause: `ExchangeRate API error: ${getErrorType(payload) ?? "unknown"}`,
          });
        }
        const asOfDate = toUtcDay(
          DateTime.toDateUtc(DateTime.makeUnsafe(payload.time_last_update_unix * 1000)),
        );
        const sourceLabel = `exchange-rate-api:latest:${payload.time_last_update_unix}`;
        return invertRatesToUsdBase(payload.conversion_rates, asOfDate, sourceLabel);
      }),
  };
};
