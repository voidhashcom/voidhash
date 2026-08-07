import { DateTime, Effect } from "effect";

import { describe, expect, it } from "../../../src/testing/effect-vitest.ts";
import { FX_RATE_PRECISION, type FxRateLookup } from "../../../src/domain/fxRate/FxRate.ts";
import { FxRateServiceError } from "../../../src/services/fxRates/FxRateService.ts";
import { createExchangeRateApiFxRateFetcher } from "../../../src/services/fxRates/exchange-rate-api-fetcher.ts";

/**
 * `invertRatesToUsdBase` and the URL/`asOfDate`/`sourceLabel` derivation are
 * module-private; they are exercised through the only public export,
 * {@link createExchangeRateApiFxRateFetcher}, by stubbing the runtime's global
 * `fetch`. The fetcher uses `globalThis.fetch` directly (no Effect
 * `HttpClient`), so a per-test stub of that platform seam is the unit-level
 * way to drive the success / error / network-failure branches.
 */

/**
 * The slice of `Response` the fetcher actually reads. `await` accepts
 * non-thenables, so `json` may hand back the decoded body synchronously — which
 * keeps values JSON cannot round-trip (`NaN`, `Infinity`) intact for the
 * quote-validation branches.
 */
interface FetchStubResponse {
  readonly json: () => unknown;
  readonly ok: boolean;
  readonly status: number;
}

type FetchStub = (url: string) => FetchStubResponse | Promise<FetchStubResponse>;

/**
 * Swaps `globalThis.fetch` for a stub. `Object.assign` is used instead of a
 * direct assignment because the stub is intentionally narrower than the
 * platform `fetch` signature (it only models what the fetcher calls).
 */
const setGlobalFetch = (impl: unknown): void => {
  Object.assign(globalThis, { fetch: impl });
};

/** A minimal `Response`-shaped object good enough for the fetcher's reads. */
const jsonResponse = (
  body: unknown,
  init?: { readonly ok?: boolean; readonly status?: number },
): FetchStubResponse => ({
  json: () => body,
  ok: init?.ok ?? true,
  status: init?.status ?? 200,
});

/**
 * Installs a recording `fetch` stub for the duration of `run`, capturing the
 * URL it was called with, and always restores the original `fetch` after.
 */
const withFetch = <A, E, R>(
  impl: FetchStub,
  run: (captured: { url: string | undefined }) => Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    const original = globalThis.fetch;
    const captured: { url: string | undefined } = { url: undefined };
    setGlobalFetch((input: string) => {
      captured.url = String(input);
      return impl(captured.url);
    });
    return yield* run(captured).pipe(
      Effect.ensuring(Effect.sync(() => setGlobalFetch(original))),
    );
  });

const SUCCESS_TIMESTAMP = 1_700_000_000; // unix seconds

const successBody = (conversionRates: Readonly<Record<string, unknown>>) => ({
  base_code: "USD",
  conversion_rates: conversionRates,
  result: "success",
  time_last_update_unix: SUCCESS_TIMESTAMP,
});

/** Index the inverted rates by currency for terse assertions. */
const byCurrency = (rates: ReadonlyArray<FxRateLookup>): Record<string, FxRateLookup> =>
  Object.fromEntries(rates.map((r) => [r.currency, r]));

describe("createExchangeRateApiFxRateFetcher — URL construction", () => {
  it.effect("builds baseUrl + url-encoded apiKey + /latest/USD", () =>
    Effect.gen(function* () {
      const fetcher = createExchangeRateApiFxRateFetcher({
        apiKey: "abc123",
        baseUrl: "https://example.com/v6",
      });
      yield* withFetch(
        () => jsonResponse(successBody({})),
        (captured) =>
          Effect.gen(function* () {
            yield* fetcher.fetchLatestUsdRates();
            expect(captured.url).toBe("https://example.com/v6/abc123/latest/USD");
          }),
      );
    }),
  );

  it.effect("trims trailing slashes from baseUrl", () =>
    Effect.gen(function* () {
      const fetcher = createExchangeRateApiFxRateFetcher({
        apiKey: "key",
        baseUrl: "https://example.com/v6///",
      });
      yield* withFetch(
        () => jsonResponse(successBody({})),
        (captured) =>
          Effect.gen(function* () {
            yield* fetcher.fetchLatestUsdRates();
            expect(captured.url).toBe("https://example.com/v6/key/latest/USD");
          }),
      );
    }),
  );

  it.effect("falls back to the default exchangerate-api baseUrl when none is given", () =>
    Effect.gen(function* () {
      const fetcher = createExchangeRateApiFxRateFetcher({ apiKey: "key" });
      yield* withFetch(
        () => jsonResponse(successBody({})),
        (captured) =>
          Effect.gen(function* () {
            yield* fetcher.fetchLatestUsdRates();
            expect(captured.url).toBe("https://v6.exchangerate-api.com/v6/key/latest/USD");
          }),
      );
    }),
  );

  it.effect("url-encodes an apiKey containing reserved characters", () =>
    Effect.gen(function* () {
      const fetcher = createExchangeRateApiFxRateFetcher({
        apiKey: "a b/c?d",
        baseUrl: "https://example.com/v6",
      });
      yield* withFetch(
        () => jsonResponse(successBody({})),
        (captured) =>
          Effect.gen(function* () {
            yield* fetcher.fetchLatestUsdRates();
            expect(captured.url).toBe("https://example.com/v6/a%20b%2Fc%3Fd/latest/USD");
          }),
      );
    }),
  );
});

describe("createExchangeRateApiFxRateFetcher — rate inversion (success path)", () => {
  it.effect("inverts USD→X quotes to X→USD rates scaled by FX_RATE_PRECISION", () =>
    Effect.gen(function* () {
      const fetcher = createExchangeRateApiFxRateFetcher({ apiKey: "k" });
      yield* withFetch(
        () => jsonResponse(successBody({ EUR: 2 })), // 1 USD = 2 EUR ⇒ 1 EUR = 0.5 USD
        () =>
          Effect.gen(function* () {
            const rates = yield* fetcher.fetchLatestUsdRates();
            const eur = byCurrency(rates).EUR;
            expect(eur).toBeDefined();
            expect(eur?.rate).toBe(0.5 * FX_RATE_PRECISION);
          }),
      );
    }),
  );

  it.effect("rounds the scaled rate to the nearest integer", () =>
    Effect.gen(function* () {
      const fetcher = createExchangeRateApiFxRateFetcher({ apiKey: "k" });
      // 1 USD = 3 X ⇒ 1 X = 0.333333… USD ⇒ round(333333.33…) = 333333
      yield* withFetch(
        () => jsonResponse(successBody({ XAF: 3 })),
        () =>
          Effect.gen(function* () {
            const rates = yield* fetcher.fetchLatestUsdRates();
            expect(byCurrency(rates).XAF?.rate).toBe(Math.round((1 / 3) * FX_RATE_PRECISION));
          }),
      );
    }),
  );

  it.effect("emits USD as the identity rate (1.0 × FX_RATE_PRECISION)", () =>
    Effect.gen(function* () {
      const fetcher = createExchangeRateApiFxRateFetcher({ apiKey: "k" });
      yield* withFetch(
        () => jsonResponse(successBody({ USD: 1 })),
        () =>
          Effect.gen(function* () {
            const rates = yield* fetcher.fetchLatestUsdRates();
            expect(byCurrency(rates).USD?.rate).toBe(FX_RATE_PRECISION);
          }),
      );
    }),
  );

  it.effect("uppercases the currency code", () =>
    Effect.gen(function* () {
      const fetcher = createExchangeRateApiFxRateFetcher({ apiKey: "k" });
      yield* withFetch(
        () => jsonResponse(successBody({ gbp: 0.8 })),
        () =>
          Effect.gen(function* () {
            const rates = yield* fetcher.fetchLatestUsdRates();
            expect(rates.map((r) => r.currency)).toContain("GBP");
            expect(rates.map((r) => r.currency)).not.toContain("gbp");
          }),
      );
    }),
  );

  it.effect("skips zero, negative and non-finite quotes so a bad entry can't poison the cache", () =>
    Effect.gen(function* () {
      const fetcher = createExchangeRateApiFxRateFetcher({ apiKey: "k" });
      yield* withFetch(
        () =>
          jsonResponse(
            successBody({
              EUR: 2, // valid → kept
              INF: Number.POSITIVE_INFINITY,
              NAN: Number.NaN,
              NEG: -1,
              ZERO: 0,
            }),
          ),
        () =>
          Effect.gen(function* () {
            const rates = yield* fetcher.fetchLatestUsdRates();
            const codes = rates.map((r) => r.currency);
            expect(codes).toEqual(["EUR"]);
          }),
      );
    }),
  );

  it.effect("skips non-numeric entries in conversion_rates", () =>
    Effect.gen(function* () {
      const fetcher = createExchangeRateApiFxRateFetcher({ apiKey: "k" });
      yield* withFetch(
        // A provider response with a stray string value — must be dropped.
        () => jsonResponse(successBody({ BAD: "oops", EUR: 2 })),
        () =>
          Effect.gen(function* () {
            const rates = yield* fetcher.fetchLatestUsdRates();
            expect(rates.map((r) => r.currency)).toEqual(["EUR"]);
          }),
      );
    }),
  );

  it.effect("derives asOfDate from time_last_update_unix (×1000, truncated to UTC day)", () =>
    Effect.gen(function* () {
      const fetcher = createExchangeRateApiFxRateFetcher({ apiKey: "k" });
      yield* withFetch(
        () => jsonResponse(successBody({ EUR: 2 })),
        () =>
          Effect.gen(function* () {
            const rates = yield* fetcher.fetchLatestUsdRates();
            const expected = DateTime.makeUnsafe(SUCCESS_TIMESTAMP * 1000).pipe(
              DateTime.removeTime,
              DateTime.toDateUtc,
            );
            expect(byCurrency(rates).EUR?.asOfDate.getTime()).toBe(expected.getTime());
            // truncated to midnight UTC
            const actual = byCurrency(rates).EUR?.asOfDate;
            expect(actual?.getUTCHours()).toBe(0);
            expect(actual?.getUTCMinutes()).toBe(0);
            expect(actual?.getUTCSeconds()).toBe(0);
          }),
      );
    }),
  );

  it.effect("stamps a source label of exchange-rate-api:latest:<unix>", () =>
    Effect.gen(function* () {
      const fetcher = createExchangeRateApiFxRateFetcher({ apiKey: "k" });
      yield* withFetch(
        () => jsonResponse(successBody({ EUR: 2 })),
        () =>
          Effect.gen(function* () {
            const rates = yield* fetcher.fetchLatestUsdRates();
            expect(byCurrency(rates).EUR?.source).toBe(
              `exchange-rate-api:latest:${SUCCESS_TIMESTAMP}`,
            );
          }),
      );
    }),
  );
});

describe("createExchangeRateApiFxRateFetcher — failure paths", () => {
  it.effect("fails with FxRateServiceError carrying the error-type on a provider error", () =>
    Effect.gen(function* () {
      const fetcher = createExchangeRateApiFxRateFetcher({ apiKey: "k" });
      yield* withFetch(
        () => jsonResponse({ "error-type": "invalid-key", result: "error" }),
        () =>
          Effect.gen(function* () {
            // `Effect.flip` moves the typed error into the success channel.
            const error = yield* Effect.flip(fetcher.fetchLatestUsdRates());
            expect(error).toBeInstanceOf(FxRateServiceError);
            expect(error.cause).toContain("invalid-key");
          }),
      );
    }),
  );

  it.effect("tolerates the snake_case error_type variant", () =>
    Effect.gen(function* () {
      const fetcher = createExchangeRateApiFxRateFetcher({ apiKey: "k" });
      yield* withFetch(
        () => jsonResponse({ error_type: "quota-reached", result: "error" }),
        () =>
          Effect.gen(function* () {
            const error = yield* Effect.flip(fetcher.fetchLatestUsdRates());
            expect(error).toBeInstanceOf(FxRateServiceError);
            expect(error.cause).toContain("quota-reached");
          }),
      );
    }),
  );

  it.effect("reports 'unknown' when a provider error carries no error type", () =>
    Effect.gen(function* () {
      const fetcher = createExchangeRateApiFxRateFetcher({ apiKey: "k" });
      yield* withFetch(
        () => jsonResponse({ result: "error" }),
        () =>
          Effect.gen(function* () {
            const error = yield* Effect.flip(fetcher.fetchLatestUsdRates());
            expect(error).toBeInstanceOf(FxRateServiceError);
            expect(error.cause).toContain("unknown");
          }),
      );
    }),
  );

  it.effect("fails with FxRateServiceError on a non-200 HTTP response", () =>
    Effect.gen(function* () {
      const fetcher = createExchangeRateApiFxRateFetcher({ apiKey: "k" });
      yield* withFetch(
        () => jsonResponse({}, { ok: false, status: 429 }),
        () =>
          Effect.gen(function* () {
            const error = yield* Effect.flip(fetcher.fetchLatestUsdRates());
            expect(error).toBeInstanceOf(FxRateServiceError);
            expect(error.cause).toContain("429");
          }),
      );
    }),
  );

  it.effect("wraps a network failure (fetch rejects) into FxRateServiceError with the message", () =>
    Effect.gen(function* () {
      const fetcher = createExchangeRateApiFxRateFetcher({ apiKey: "k" });
      yield* withFetch(
        // A dying effect run as a promise rejects with the defect itself, which
        // is exactly how a rejected `fetch` reaches the fetcher.
        () => Effect.runPromise(Effect.die(new Error("ECONNREFUSED"))),
        () =>
          Effect.gen(function* () {
            const error = yield* Effect.flip(fetcher.fetchLatestUsdRates());
            expect(error).toBeInstanceOf(FxRateServiceError);
            expect(error.cause).toContain("ECONNREFUSED");
          }),
      );
    }),
  );
});
