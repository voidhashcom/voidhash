import { describe, expect, it } from "vite-plus/test";
import { Effect } from "effect";

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

/** A minimal `Response`-shaped object good enough for the fetcher's reads. */
const jsonResponse = (body: unknown, init?: { readonly ok?: boolean; readonly status?: number }) =>
  ({
    json: () => Promise.resolve(body),
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
  }) as unknown as Response;

/**
 * Installs a recording `fetch` stub for the duration of `run`, capturing the
 * URL it was called with, and always restores the original `fetch` after.
 */
const withFetch = async <A>(
  impl: (url: string) => Response | Promise<Response>,
  run: (captured: { url: string | undefined }) => Promise<A>,
): Promise<A> => {
  const original = globalThis.fetch;
  const captured: { url: string | undefined } = { url: undefined };
  globalThis.fetch = ((input: string) => {
    captured.url = String(input);
    return Promise.resolve(impl(captured.url));
  }) as typeof fetch;
  try {
    return await run(captured);
  } finally {
    globalThis.fetch = original;
  }
};

const SUCCESS_TIMESTAMP = 1_700_000_000; // unix seconds

const successBody = (conversionRates: Record<string, number>) => ({
  base_code: "USD",
  conversion_rates: conversionRates,
  result: "success" as const,
  time_last_update_unix: SUCCESS_TIMESTAMP,
});

/** Index the inverted rates by currency for terse assertions. */
const byCurrency = (rates: ReadonlyArray<FxRateLookup>): Record<string, FxRateLookup> =>
  Object.fromEntries(rates.map((r) => [r.currency, r]));

describe("createExchangeRateApiFxRateFetcher — URL construction", () => {
  it("builds baseUrl + url-encoded apiKey + /latest/USD", async () => {
    const fetcher = createExchangeRateApiFxRateFetcher({
      apiKey: "abc123",
      baseUrl: "https://example.com/v6",
    });
    await withFetch(
      () => jsonResponse(successBody({})),
      async (captured) => {
        await Effect.runPromise(fetcher.fetchLatestUsdRates());
        expect(captured.url).toBe("https://example.com/v6/abc123/latest/USD");
      },
    );
  });

  it("trims trailing slashes from baseUrl", async () => {
    const fetcher = createExchangeRateApiFxRateFetcher({
      apiKey: "key",
      baseUrl: "https://example.com/v6///",
    });
    await withFetch(
      () => jsonResponse(successBody({})),
      async (captured) => {
        await Effect.runPromise(fetcher.fetchLatestUsdRates());
        expect(captured.url).toBe("https://example.com/v6/key/latest/USD");
      },
    );
  });

  it("falls back to the default exchangerate-api baseUrl when none is given", async () => {
    const fetcher = createExchangeRateApiFxRateFetcher({ apiKey: "key" });
    await withFetch(
      () => jsonResponse(successBody({})),
      async (captured) => {
        await Effect.runPromise(fetcher.fetchLatestUsdRates());
        expect(captured.url).toBe("https://v6.exchangerate-api.com/v6/key/latest/USD");
      },
    );
  });

  it("url-encodes an apiKey containing reserved characters", async () => {
    const fetcher = createExchangeRateApiFxRateFetcher({
      apiKey: "a b/c?d",
      baseUrl: "https://example.com/v6",
    });
    await withFetch(
      () => jsonResponse(successBody({})),
      async (captured) => {
        await Effect.runPromise(fetcher.fetchLatestUsdRates());
        expect(captured.url).toBe("https://example.com/v6/a%20b%2Fc%3Fd/latest/USD");
      },
    );
  });
});

describe("createExchangeRateApiFxRateFetcher — rate inversion (success path)", () => {
  it("inverts USD→X quotes to X→USD rates scaled by FX_RATE_PRECISION", async () => {
    const fetcher = createExchangeRateApiFxRateFetcher({ apiKey: "k" });
    await withFetch(
      () => jsonResponse(successBody({ EUR: 2 })), // 1 USD = 2 EUR ⇒ 1 EUR = 0.5 USD
      async () => {
        const rates = await Effect.runPromise(fetcher.fetchLatestUsdRates());
        const eur = byCurrency(rates).EUR;
        expect(eur).toBeDefined();
        expect(eur?.rate).toBe(0.5 * FX_RATE_PRECISION);
      },
    );
  });

  it("rounds the scaled rate to the nearest integer", async () => {
    const fetcher = createExchangeRateApiFxRateFetcher({ apiKey: "k" });
    // 1 USD = 3 X ⇒ 1 X = 0.333333… USD ⇒ round(333333.33…) = 333333
    await withFetch(
      () => jsonResponse(successBody({ XAF: 3 })),
      async () => {
        const rates = await Effect.runPromise(fetcher.fetchLatestUsdRates());
        expect(byCurrency(rates).XAF?.rate).toBe(Math.round((1 / 3) * FX_RATE_PRECISION));
      },
    );
  });

  it("emits USD as the identity rate (1.0 × FX_RATE_PRECISION)", async () => {
    const fetcher = createExchangeRateApiFxRateFetcher({ apiKey: "k" });
    await withFetch(
      () => jsonResponse(successBody({ USD: 1 })),
      async () => {
        const rates = await Effect.runPromise(fetcher.fetchLatestUsdRates());
        expect(byCurrency(rates).USD?.rate).toBe(FX_RATE_PRECISION);
      },
    );
  });

  it("uppercases the currency code", async () => {
    const fetcher = createExchangeRateApiFxRateFetcher({ apiKey: "k" });
    await withFetch(
      () => jsonResponse(successBody({ gbp: 0.8 })),
      async () => {
        const rates = await Effect.runPromise(fetcher.fetchLatestUsdRates());
        expect(rates.map((r) => r.currency)).toContain("GBP");
        expect(rates.map((r) => r.currency)).not.toContain("gbp");
      },
    );
  });

  it("skips zero, negative and non-finite quotes so a bad entry can't poison the cache", async () => {
    const fetcher = createExchangeRateApiFxRateFetcher({ apiKey: "k" });
    await withFetch(
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
      async () => {
        const rates = await Effect.runPromise(fetcher.fetchLatestUsdRates());
        const codes = rates.map((r) => r.currency);
        expect(codes).toEqual(["EUR"]);
      },
    );
  });

  it("skips non-numeric entries in conversion_rates", async () => {
    const fetcher = createExchangeRateApiFxRateFetcher({ apiKey: "k" });
    await withFetch(
      // A provider response with a stray string value — must be dropped.
      () => jsonResponse(successBody({ BAD: "oops" as unknown as number, EUR: 2 })),
      async () => {
        const rates = await Effect.runPromise(fetcher.fetchLatestUsdRates());
        expect(rates.map((r) => r.currency)).toEqual(["EUR"]);
      },
    );
  });

  it("derives asOfDate from time_last_update_unix (×1000, truncated to UTC day)", async () => {
    const fetcher = createExchangeRateApiFxRateFetcher({ apiKey: "k" });
    await withFetch(
      () => jsonResponse(successBody({ EUR: 2 })),
      async () => {
        const rates = await Effect.runPromise(fetcher.fetchLatestUsdRates());
        const ms = SUCCESS_TIMESTAMP * 1000;
        const d = new Date(ms);
        const expected = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
        expect(byCurrency(rates).EUR?.asOfDate.getTime()).toBe(expected.getTime());
        // truncated to midnight UTC
        const actual = byCurrency(rates).EUR?.asOfDate;
        expect(actual?.getUTCHours()).toBe(0);
        expect(actual?.getUTCMinutes()).toBe(0);
        expect(actual?.getUTCSeconds()).toBe(0);
      },
    );
  });

  it("stamps a source label of exchange-rate-api:latest:<unix>", async () => {
    const fetcher = createExchangeRateApiFxRateFetcher({ apiKey: "k" });
    await withFetch(
      () => jsonResponse(successBody({ EUR: 2 })),
      async () => {
        const rates = await Effect.runPromise(fetcher.fetchLatestUsdRates());
        expect(byCurrency(rates).EUR?.source).toBe(`exchange-rate-api:latest:${SUCCESS_TIMESTAMP}`);
      },
    );
  });
});

describe("createExchangeRateApiFxRateFetcher — failure paths", () => {
  it("fails with FxRateServiceError carrying the error-type on a provider error", async () => {
    const fetcher = createExchangeRateApiFxRateFetcher({ apiKey: "k" });
    await withFetch(
      () => jsonResponse({ "error-type": "invalid-key", result: "error" }),
      async () => {
        // `Effect.flip` moves the typed error into the success channel.
        const error = await Effect.runPromise(fetcher.fetchLatestUsdRates().pipe(Effect.flip));
        expect(error).toBeInstanceOf(FxRateServiceError);
        expect(error.cause).toContain("invalid-key");
      },
    );
  });

  it("tolerates the snake_case error_type variant", async () => {
    const fetcher = createExchangeRateApiFxRateFetcher({ apiKey: "k" });
    await withFetch(
      () => jsonResponse({ error_type: "quota-reached", result: "error" }),
      async () => {
        const error = await Effect.runPromise(fetcher.fetchLatestUsdRates().pipe(Effect.flip));
        expect(error).toBeInstanceOf(FxRateServiceError);
        expect(error.cause).toContain("quota-reached");
      },
    );
  });

  it("reports 'unknown' when a provider error carries no error type", async () => {
    const fetcher = createExchangeRateApiFxRateFetcher({ apiKey: "k" });
    await withFetch(
      () => jsonResponse({ result: "error" }),
      async () => {
        const error = await Effect.runPromise(fetcher.fetchLatestUsdRates().pipe(Effect.flip));
        expect(error).toBeInstanceOf(FxRateServiceError);
        expect(error.cause).toContain("unknown");
      },
    );
  });

  it("fails with FxRateServiceError on a non-200 HTTP response", async () => {
    const fetcher = createExchangeRateApiFxRateFetcher({ apiKey: "k" });
    await withFetch(
      () => jsonResponse({}, { ok: false, status: 429 }),
      async () => {
        const error = await Effect.runPromise(fetcher.fetchLatestUsdRates().pipe(Effect.flip));
        expect(error).toBeInstanceOf(FxRateServiceError);
        expect(error.cause).toContain("429");
      },
    );
  });

  it("wraps a network failure (fetch rejects) into FxRateServiceError with the message", async () => {
    const fetcher = createExchangeRateApiFxRateFetcher({ apiKey: "k" });
    await withFetch(
      () => {
        throw new Error("ECONNREFUSED");
      },
      async () => {
        const error = await Effect.runPromise(fetcher.fetchLatestUsdRates().pipe(Effect.flip));
        expect(error).toBeInstanceOf(FxRateServiceError);
        expect(error.cause).toContain("ECONNREFUSED");
      },
    );
  });
});
