import { Effect } from "effect";

import { FX_RATE_PRECISION, type FxRateLookup } from "../../domain/fxRate/FxRate.ts";
import { FxRateServiceError, type FxRateFetcher } from "./FxRateService.ts";

const DEFAULT_EXCHANGE_RATE_API_BASE_URL = "https://v6.exchangerate-api.com/v6";

interface ExchangeRateApiLatestSuccessResponse {
  readonly result: "success";
  readonly time_last_update_unix: number;
  readonly base_code: string;
  readonly conversion_rates: Record<string, number>;
}

interface ExchangeRateApiErrorResponse {
  readonly result: "error";
  // The provider uses kebab-case `error-type` in JSON; both forms are tolerated
  // here so the parser is robust against future naming changes.
  readonly "error-type"?: string;
  readonly error_type?: string;
}

type ExchangeRateApiLatestResponse =
  | ExchangeRateApiLatestSuccessResponse
  | ExchangeRateApiErrorResponse;

const trimTrailingSlash = (value: string) => value.replace(/\/+$/u, "");

/** Truncates a `Date` to midnight UTC, matching the `(currency, as_of_date)` unique index. */
const toUtcDay = (d: Date): Date =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

const buildLatestUrl = (options: { readonly baseUrl: string; readonly apiKey: string }): string =>
  `${trimTrailingSlash(options.baseUrl)}/${encodeURIComponent(options.apiKey)}/latest/USD`;

const getErrorType = (payload: ExchangeRateApiErrorResponse): string | undefined =>
  payload["error-type"] ?? payload.error_type;

/**
 * Inverts `USD → X` quotes to `X → USD` rates expressed in
 * `FX_RATE_PRECISION` units. Zero / non-finite quotes are skipped so a bad
 * upstream entry doesn't poison the cache with `Infinity`.
 */
const invertRatesToUsdBase = (
  conversionRates: Readonly<Record<string, number>>,
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
    const currencyToUsd = currency.toUpperCase() === "USD" ? 1 : 1 / usdToCurrencyRate;
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

  return {
    fetchLatestUsdRates: () =>
      Effect.tryPromise({
        catch: (cause) =>
          new FxRateServiceError({
            cause: `ExchangeRate API fetch failed: ${cause instanceof Error ? cause.message : String(cause)}`,
          }),
        try: async (): Promise<ExchangeRateApiLatestResponse> => {
          const response = await fetch(url, { headers: { Accept: "application/json" } });
          if (!response.ok) {
            throw new Error(`ExchangeRate API returned ${response.status}`);
          }
          return (await response.json()) as ExchangeRateApiLatestResponse;
        },
      }).pipe(
        Effect.flatMap((payload) => {
          if (payload.result !== "success") {
            return Effect.fail(
              new FxRateServiceError({
                cause: `ExchangeRate API error: ${getErrorType(payload) ?? "unknown"}`,
              }),
            );
          }
          const asOfDate = toUtcDay(new Date(payload.time_last_update_unix * 1000));
          const sourceLabel = `exchange-rate-api:latest:${payload.time_last_update_unix}`;
          return Effect.succeed(
            invertRatesToUsdBase(payload.conversion_rates, asOfDate, sourceLabel),
          );
        }),
      ),
  };
};
