import {
  FX_RATE_PRECISION,
  FxRateSource,
  PurchasePortError,
  type FxRateLookup,
} from "@voidhash/core-v2";
import { causeMessage } from "@voidhash/lib/lang";
import * as Arr from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { HttpClient } from "effect/unstable/http";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import { utcTimestamp } from "../../runtime-boundary.ts";

const DEFAULT_BASE_URL = "https://v6.exchangerate-api.com/v6";

const LatestResponse = Schema.Union([
  Schema.Struct({
    conversion_rates: Schema.Record(Schema.String, Schema.Unknown),
    result: Schema.Literal("success"),
    time_last_update_unix: Schema.Number,
  }),
  Schema.Struct({
    "error-type": Schema.optional(Schema.String),
    error_type: Schema.optional(Schema.String),
    result: Schema.Literal("error"),
  }),
]);

const portError = (message: string) => (cause: unknown) =>
  new PurchasePortError({ cause, message: `${message}: ${causeMessage(cause)}` });

const trimTrailingSlash = (value: string) => value.replace(/\/+$/u, "");

const utcDay = (epochSeconds: number) => {
  const date = DateTime.toDateUtc(DateTime.makeUnsafe(epochSeconds * 1_000));
  return DateTime.toDateUtc(
    DateTime.makeUnsafe(utcTimestamp(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())),
  );
};

const invertRates = (
  rates: Readonly<Record<string, unknown>>,
  asOfDate: Date,
  source: string,
): ReadonlyArray<FxRateLookup> => {
  return Arr.flatMap(R.toEntries(rates), ([rawCurrency, quote]) => {
    if (!P.isNumber(quote) || !Number.isFinite(quote) || quote <= 0) return [];
    const currency = rawCurrency.toUpperCase();
    const rate =
      currency === "USD" ? FX_RATE_PRECISION : Math.round((1 / quote) * FX_RATE_PRECISION);
    return [
      {
        asOfDate,
        currency,
        rate,
        source,
      },
    ];
  });
};

/** Runtime configuration for the ExchangeRate-API source. */
export interface ExchangeRateSourceConfig {
  readonly apiKey: Effect.Effect<string>;
  /** Optional provider base URL; an empty value selects the public default. */
  readonly baseUrl?: Effect.Effect<string>;
}

/** ExchangeRate-API bulk source with response validation at the HTTP boundary. */
export const ExchangeRateSourceLive = (
  config: ExchangeRateSourceConfig,
): Layer.Layer<FxRateSource, never, HttpClient.HttpClient> =>
  Layer.effect(
    FxRateSource,
    Effect.gen(function* () {
      const apiKey = yield* config.apiKey;
      const httpClient = yield* HttpClient.HttpClient;
      const configuredBaseUrl = config.baseUrl === undefined ? "" : (yield* config.baseUrl).trim();
      const baseUrl = configuredBaseUrl === "" ? DEFAULT_BASE_URL : configuredBaseUrl;
      const url = `${trimTrailingSlash(baseUrl)}/${encodeURIComponent(apiKey)}/latest/USD`;

      return FxRateSource.of({
        fetchLatestUsdRates: () =>
          Effect.fn("fetchLatestUsdRates")(function* () {
            const response = yield* httpClient
              .get(url, { headers: { Accept: "application/json" } })
              .pipe(Effect.mapError(portError("ExchangeRate API fetch failed")));
            if (response.status < 200 || response.status >= 300) {
              return yield* new PurchasePortError({
                cause: response.status,
                message: `ExchangeRate API returned ${response.status}`,
              });
            }
            const json = yield* response.json.pipe(
              Effect.mapError(portError("ExchangeRate API response read failed")),
            );
            const payload = yield* Schema.decodeUnknownEffect(LatestResponse)(json).pipe(
              Effect.mapError(portError("ExchangeRate API response validation failed")),
            );
            if (payload.result === "error") {
              return yield* new PurchasePortError({
                cause: payload,
                message: `ExchangeRate API error: ${payload["error-type"] ?? payload.error_type ?? "unknown"}`,
              });
            }
            return invertRates(
              payload.conversion_rates,
              utcDay(payload.time_last_update_unix),
              `exchange-rate-api:latest:${payload.time_last_update_unix}`,
            );
          })(),
      });
    }),
  );
