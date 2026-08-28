import {
  FX_RATE_PRECISION,
  FxRateSource,
  PurchasePortError,
  type FxRateLookup,
} from "@voidhash/core-v2";
import { causeMessage } from "@voidhash/lib/lang";
import { DateTime, Effect, Layer, Schema } from "effect";
import { HttpClient } from "effect/unstable/http";

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
    DateTime.makeUnsafe(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())),
  );
};

const invertRates = (
  rates: Readonly<Record<string, unknown>>,
  asOfDate: Date,
  source: string,
): ReadonlyArray<FxRateLookup> => {
  const result: FxRateLookup[] = [];
  for (const [rawCurrency, quote] of Object.entries(rates)) {
    if (typeof quote !== "number" || !Number.isFinite(quote) || quote <= 0) continue;
    const currency = rawCurrency.toUpperCase();
    let rate = FX_RATE_PRECISION;
    if (currency !== "USD") rate = Math.round((1 / quote) * FX_RATE_PRECISION);
    result.push({
      asOfDate,
      currency,
      rate,
      source,
    });
  }
  return result;
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
      let baseUrl = DEFAULT_BASE_URL;
      if (config.baseUrl !== undefined) {
        const configuredBaseUrl = (yield* config.baseUrl).trim();
        if (configuredBaseUrl !== "") baseUrl = configuredBaseUrl;
      }
      const url = `${trimTrailingSlash(baseUrl)}/${encodeURIComponent(apiKey)}/latest/USD`;

      return FxRateSource.of({
        fetchLatestUsdRates: () =>
          Effect.gen(function* () {
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
          }),
      });
    }),
  );
