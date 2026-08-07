/**
 * Integration tests for {@link FxRateService} and its bundled
 * {@link createExchangeRateApiFxRateFetcher}, run against the real backend stack
 * provisioned once by `test/_testing/globalSetup.ts` (live PlanetScale DB).
 *
 * The service has no auth guards and writes only to the global, project-less
 * `fx_rate` table, so these tests verify the *persisted* side effects and the
 * two-tier cache behaviour rather than permissions:
 *  - the `fx_rate` rows written by `refreshLatest` / `ensureSeeded`,
 *  - `getUsdRate`'s identity short-circuit, UTC-day truncation, DB-backed cache
 *    hit, and TTL-memoized negative on a miss,
 *  - `onDuplicateKeyUpdate` idempotence on the `(currency, as_of_date)` unique
 *    index.
 *
 * Conventions used throughout:
 *  - `fx_rate` has no `projectId`, so rows cannot be scoped to the fixture
 *    project. Instead every test stamps its rows with a unique 3-char test
 *    currency AND a unique `asOfDate` in a future-but-still-valid MySQL
 *    `TIMESTAMP` band (`[~2030, 2037]`, below the 2038-01-19 cap), and cleans up
 *    after itself via {@link withFxCleanup} (deleting by id, success or
 *    failure). Assertions stay membership-based (by currency / by id), never
 *    table-wide counts, so a leftover row from a crashed run can't collide.
 *  - The in-memory {@link FxRateService} cache is per-service-instance: each
 *    test gets a fresh one via its own `Effect.provide(...layer)`. Negatives are
 *    memoized for the TTL, so tests insert the DB row *before* the first
 *    `getUsdRate` when they want to observe a hit.
 *  - The upstream ExchangeRate-API is a paid, quota-limited external service we
 *    must not call. `refreshLatest` / `ensureSeeded` are driven through an
 *    in-test {@link FxRateFetcher} (no HTTP); the fetcher itself is exercised
 *    end-to-end with the global `fetch` stubbed to return controlled provider
 *    responses, so its real JSON parsing, URL building, rate inversion and
 *    error mapping all run for real against simulated upstream payloads.
 *  - Typed failures are asserted with `Effect.flip` (project convention),
 *    narrowing the swapped error with `instanceof` before reading its fields.
 */
import { createId } from "@paralleldrive/cuid2";
import { Clock, DateTime, Effect, Option, Schema } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  FxRateService,
  FxRateServiceError,
  type FxRateFetcher,
} from "@voidhash/core/services";
import {
  FX_RATE_PRECISION,
  USD_IDENTITY_RATE,
  type FxRateLookup,
} from "@voidhash/core/domain/fxRate/FxRate";
import { Db, eq, fxRates, inArray } from "@voidhash/db";

import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";

import { createExchangeRateApiFxRateFetcher } from "../../../src/services/fxRates/exchange-rate-api-fetcher.ts";

const { test } = CoreIntegrationTestHarness.make();

/**
 * Monotonic counter so the per-test currency code and `asOfDate` stay unique
 * even within the same millisecond (and across concurrent runs against the
 * shared DB, thanks to the unique far-future date component).
 */
let seq = 0;

/**
 * A 3-char test currency code (fits `fx_rate.currency` `varchar(3)`). Bumps the
 * shared `seq` so two successive calls (e.g. `currencyA`/`currencyB` in one
 * test) get *distinct* codes — otherwise both would map to the same
 * `(currency, asOfDate)` pair and the second insert would no-op via the unique
 * index, breaking per-currency read-backs.
 */
const uniqueCurrency = (): string => `Z${(seq++ % 100).toString().padStart(2, "0")}`;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Per-run day offset (in days). The `fx_rate.as_of_date` column is a MySQL
 * `TIMESTAMP` (4-byte, valid only for `1970-01-01` .. `2038-01-19 03:14:07`
 * UTC), so the `asOfDate` we insert MUST land inside that window or the row is
 * rejected (`Incorrect datetime value`) at write time. We therefore anchor near
 * the *top* of the range and step *backward* by a per-run salt + call count,
 * carving a `[~2030, 2037]` band that is comfortably in range, well past real
 * ~2026 FX data, and unlikely to collide with a leftover row from a crashed
 * prior run. The salt is bounded so `base - offset` never underflows out of the
 * valid window for this file's call count.
 */
const runSalt = createId()
  .split("")
  .reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) % 2_000, 7);

/** A `Date` at `millis`, built without touching the `Date` global. */
const dateAt = (millis: number): Date => DateTime.toDateUtc(DateTime.makeUnsafe(millis));

/** Serializes a stubbed provider body the way `JSON.stringify` used to. */
const encodeJson = Schema.encodeSync(Schema.UnknownFromJsonString);

/**
 * A unique midnight-UTC `asOfDate` in the future-but-valid MySQL `TIMESTAMP`
 * band, derived from the run salt and call count so `(currency, asOfDate)` never
 * collides with real data, other tests, or other runs. Midnight UTC means the
 * value round-trips losslessly through the second-precision (no `fsp`) column.
 */
const uniqueDay = (): Date => {
  const base = Date.UTC(2037, 0, 1);
  return dateAt(base - (runSalt + seq++) * ONE_DAY_MS);
};

/** Read the `fx_rate` row for a `(currency, asOfDate)` pair. */
const findByPair = (currency: string, asOfDate: Date) =>
  Effect.gen(function* () {
    const db = yield* Db;
    // `asOfDate` is a Date (object) column, so the v2 shorthand `{ asOfDate }`
    // resolves to `never` — object-typed columns need the explicit `{ eq }` form.
    return yield* db.query.fxRates.findFirst({
      where: { currency, asOfDate: { eq: asOfDate } },
    });
  });

/** All `fx_rate` rows for a given test currency. */
const findByCurrency = (currency: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.select().from(fxRates).where(eq(fxRates.currency, currency));
  });

/**
 * Delete the given `fx_rate` rows. Each delete is `ignore`d so a missing row
 * never turns the finalizer into a failure.
 */
const cleanupRows = (ids: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    if (ids.length === 0) return;
    const db = yield* Db;
    yield* db
      .delete(fxRates)
      .where(inArray(fxRates.id, [...ids]))
      .pipe(Effect.ignore);
  });

/**
 * Wrap a test body so every `fx_rate` row it creates is removed afterward,
 * regardless of how the test exits. Pass each created row id to `track`; cleanup
 * reads the collected ids lazily at finalization via `Effect.ensuring`, so it
 * sees every id tracked while the body ran (including on failure).
 */
const withFxCleanup = <E, R>(
  body: (track: (id: string) => void) => Effect.Effect<void, E, R>,
): Effect.Effect<void, E, R | Db> => {
  const createdIds: string[] = [];
  return body((id) => {
    createdIds.push(id);
  }).pipe(Effect.ensuring(cleanupRows(createdIds)));
};

/**
 * Insert an `fx_rate` row directly (bypassing the service) so cache reads have
 * a durable row to find. Returns the generated id and tracks it for cleanup.
 */
const seedRow = (
  track: (id: string) => void,
  input: {
    readonly currency: string;
    readonly asOfDate: Date;
    readonly usdRate: number;
    readonly source: string;
  },
) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const id = `fx_test_${yield* Clock.currentTimeMillis}_${seq++}`;
    track(id);
    const fetchedAt = yield* DateTime.nowAsDate;
    yield* db.insert(fxRates).values({
      asOfDate: input.asOfDate,
      currency: input.currency,
      fetchedAt,
      id,
      source: input.source,
      usdRate: input.usdRate,
    });
    return id;
  });

/** A static {@link FxRateFetcher} returning the given rates with no HTTP. */
const staticFetcher = (rates: ReadonlyArray<FxRateLookup>): FxRateFetcher => ({
  fetchLatestUsdRates: () => Effect.succeed(rates),
});

/** A {@link FxRateFetcher} that always fails, for error-path coverage. */
const failingFetcher = (cause: string): FxRateFetcher => ({
  fetchLatestUsdRates: () => Effect.fail(new FxRateServiceError({ cause })),
});

describe("FxRateService.getUsdRate", () => {
  test(
    "USD short-circuits to the identity rate without a DB lookup",
    Effect.gen(function* () {
      const svc = yield* FxRateService;
      // A non-midnight timestamp proves asOf is truncated to the UTC day.
      const asOf = dateAt(Date.UTC(2024, 5, 15, 13, 37, 42, 500));

      const result = yield* svc.getUsdRate({ asOf, currency: "usd" });
      expect(Option.isSome(result)).toBe(true);
      const lookup = Option.getOrThrow(result);
      expect(lookup.currency).toBe("USD");
      expect(lookup.rate).toBe(USD_IDENTITY_RATE);
      expect(lookup.source).toBe("identity");
      expect(lookup.asOfDate.getTime()).toBe(Date.UTC(2024, 5, 15));
    }).pipe(Effect.provide(FxRateService.layerWithFetcher(staticFetcher([])))),
  );

  test(
    "returns a DB-backed FxRateLookup with the expected structure",
    withFxCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FxRateService;
        const currency = uniqueCurrency();
        const asOfDate = uniqueDay();
        const usdRate = 1_234_567;

        yield* seedRow(track, { asOfDate, currency, source: "stub", usdRate });

        const result = yield* svc.getUsdRate({ asOf: asOfDate, currency });
        expect(Option.isSome(result)).toBe(true);
        const lookup = Option.getOrThrow(result);
        expect(lookup.currency).toBe(currency);
        expect(lookup.rate).toBe(usdRate);
        expect(lookup.source).toBe("stub");
        expect(lookup.asOfDate.getTime()).toBe(asOfDate.getTime());
      }),
    ).pipe(Effect.provide(FxRateService.layerWithFetcher(staticFetcher([])))),
  );

  test(
    "truncates asOf to midnight UTC so an intraday call still hits the day row",
    withFxCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FxRateService;
        const currency = uniqueCurrency();
        const asOfDate = uniqueDay();

        yield* seedRow(track, { asOfDate, currency, source: "stub", usdRate: 900_000 });

        // Pass a time well past midnight on the same UTC day; it must normalize.
        const intraday = dateAt(asOfDate.getTime() + 18 * 60 * 60 * 1000 + 123);
        const result = yield* svc.getUsdRate({ asOf: intraday, currency });
        expect(Option.isSome(result)).toBe(true);
        expect(Option.getOrThrow(result).rate).toBe(900_000);
      }),
    ).pipe(Effect.provide(FxRateService.layerWithFetcher(staticFetcher([])))),
  );

  test(
    "returns Option.none() on a cache miss (no error, no upstream fetch)",
    Effect.gen(function* () {
      const svc = yield* FxRateService;
      // No row seeded for this currency: durable + memory tiers both miss.
      const result = yield* svc.getUsdRate({ asOf: uniqueDay(), currency: uniqueCurrency() });
      expect(Option.isNone(result)).toBe(true);
    }).pipe(Effect.provide(FxRateService.layerWithFetcher(staticFetcher([])))),
  );

  test(
    "memoizes a negative miss for the TTL even after the DB row appears",
    withFxCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FxRateService;
        const currency = uniqueCurrency();
        const asOfDate = uniqueDay();

        // First lookup misses both tiers and caches Option.none() for the TTL.
        const first = yield* svc.getUsdRate({ asOf: asOfDate, currency });
        expect(Option.isNone(first)).toBe(true);

        // Now the durable row exists, but the in-memory negative is still warm.
        yield* seedRow(track, { asOfDate, currency, source: "stub", usdRate: 500_000 });
        const second = yield* svc.getUsdRate({ asOf: asOfDate, currency });
        expect(Option.isNone(second)).toBe(true);

        // The row really is in the DB — the second none() came from the cache.
        const row = yield* findByPair(currency, asOfDate);
        expect(row?.usdRate).toBe(500_000);
      }),
    ).pipe(Effect.provide(FxRateService.layerWithFetcher(staticFetcher([])))),
  );

  test(
    "carries forward the most recent earlier rate when the exact day has no row",
    withFxCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FxRateService;
        const currency = uniqueCurrency();
        const queryDay = uniqueDay();
        // Only an earlier day (within the carry-forward window) has a rate; the
        // exact query day has none — e.g. the purchase landed before the daily
        // sync, or on a provider holiday.
        const seededDay = dateAt(queryDay.getTime() - 2 * ONE_DAY_MS);
        yield* seedRow(track, {
          asOfDate: seededDay,
          currency,
          source: "stub",
          usdRate: 1_300_000,
        });

        const result = yield* svc.getUsdRate({ asOf: queryDay, currency });
        expect(Option.isSome(result)).toBe(true);
        const lookup = Option.getOrThrow(result);
        // The carried rate's value is reused, tagged as carried, and dated to the
        // actual (earlier) rate day for observability.
        expect(lookup.rate).toBe(1_300_000);
        expect(lookup.source).toBe("stub:carry_forward");
        expect(lookup.asOfDate.getTime()).toBe(seededDay.getTime());
      }),
    ).pipe(Effect.provide(FxRateService.layerWithFetcher(staticFetcher([])))),
  );

  test(
    "does not carry forward a rate older than the staleness window (returns none)",
    withFxCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* FxRateService;
        const currency = uniqueCurrency();
        const queryDay = uniqueDay();
        // 10 days earlier — beyond the 7-day carry-forward window, so the lookup
        // must fall through to none rather than reuse a too-stale rate.
        const staleDay = dateAt(queryDay.getTime() - 10 * ONE_DAY_MS);
        yield* seedRow(track, { asOfDate: staleDay, currency, source: "stub", usdRate: 1_400_000 });

        const result = yield* svc.getUsdRate({ asOf: queryDay, currency });
        expect(Option.isNone(result)).toBe(true);
      }),
    ).pipe(Effect.provide(FxRateService.layerWithFetcher(staticFetcher([])))),
  );
});

describe("FxRateService.refreshLatest", () => {
  test(
    "persists every fetched rate, warms the in-memory cache, and returns the count",
    withFxCleanup((track) =>
      Effect.gen(function* () {
        const currencyA = uniqueCurrency();
        const currencyB = uniqueCurrency();
        const asOfDate = uniqueDay();
        const rates: ReadonlyArray<FxRateLookup> = [
          { asOfDate, currency: currencyA, rate: 1_100_000, source: "stub-refresh" },
          { asOfDate, currency: currencyB, rate: 1_200_000, source: "stub-refresh" },
        ];

        const svc = yield* Effect.provide(
          FxRateService,
          FxRateService.layerWithFetcher(staticFetcher(rates)),
        );

        const count = yield* svc.refreshLatest();
        expect(count).toBe(2);

        // Track persisted ids for cleanup and verify the durable rows.
        const rowA = yield* findByPair(currencyA, asOfDate);
        const rowB = yield* findByPair(currencyB, asOfDate);
        expect(rowA).toBeDefined();
        expect(rowB).toBeDefined();
        if (rowA) track(rowA.id);
        if (rowB) track(rowB.id);
        expect(rowA?.usdRate).toBe(1_100_000);
        expect(rowA?.source).toBe("stub-refresh");
        expect(rowB?.usdRate).toBe(1_200_000);

        // The in-memory cache was warmed: getUsdRate returns the hit directly.
        const hit = yield* svc.getUsdRate({ asOf: asOfDate, currency: currencyA });
        expect(Option.isSome(hit)).toBe(true);
        expect(Option.getOrThrow(hit).rate).toBe(1_100_000);
      }),
    ),
  );

  test(
    "is idempotent: a duplicate (currency, asOfDate) no-ops via onDuplicateKeyUpdate",
    withFxCleanup((track) =>
      Effect.gen(function* () {
        const currency = uniqueCurrency();
        const asOfDate = uniqueDay();
        const rates: ReadonlyArray<FxRateLookup> = [
          { asOfDate, currency, rate: 1_050_000, source: "stub-refresh" },
        ];

        const svc = yield* Effect.provide(
          FxRateService,
          FxRateService.layerWithFetcher(staticFetcher(rates)),
        );

        const firstCount = yield* svc.refreshLatest();
        expect(firstCount).toBe(1);
        const firstRow = yield* findByPair(currency, asOfDate);
        expect(firstRow).toBeDefined();
        if (firstRow) track(firstRow.id);

        // Second refresh with the same key must not raise ER_DUP_ENTRY and must
        // not create a second row (the unique index is honoured).
        const secondCount = yield* svc.refreshLatest();
        expect(secondCount).toBe(1);

        const rows = yield* findByCurrency(currency);
        const forDay = rows.filter((row) => row.asOfDate.getTime() === asOfDate.getTime());
        expect(forDay.length).toBe(1);
        // The original id is preserved by the `id = id` no-op update.
        expect(forDay[0]?.id).toBe(firstRow?.id);
      }),
    ),
  );

  test(
    "wraps an upstream fetcher failure as FxRateServiceError and writes nothing",
    Effect.gen(function* () {
      const currency = uniqueCurrency();
      const asOfDate = uniqueDay();

      const svc = yield* Effect.provide(
        FxRateService,
        FxRateService.layerWithFetcher(failingFetcher("upstream exploded")),
      );

      const error = yield* Effect.flip(svc.refreshLatest());
      expect(error).toBeInstanceOf(FxRateServiceError);
      if (error instanceof FxRateServiceError) {
        expect(error.cause).toContain("upstream exploded");
      }

      // No rate persisted for this never-seen currency.
      const rows = yield* findByCurrency(currency);
      expect(rows.some((row) => row.asOfDate.getTime() === asOfDate.getTime())).toBe(false);
    }),
  );
});

describe("FxRateService.ensureSeeded", () => {
  test(
    "returns 0 without persisting when the durable cache is already populated",
    withFxCleanup((track) =>
      Effect.gen(function* () {
        // The shared fx_rate table is populated by the seed below (and very
        // likely by prior tests), so ensureSeeded must treat it as populated.
        const currency = uniqueCurrency();
        const asOfDate = uniqueDay();
        yield* seedRow(track, { asOfDate, currency, source: "stub", usdRate: 1_000_000 });

        // A fetcher that would create a recognisable extra row IF (wrongly) called.
        const sentinelCurrency = uniqueCurrency();
        const sentinelDay = uniqueDay();
        const svc = yield* Effect.provide(
          FxRateService,
          FxRateService.layerWithFetcher(
            staticFetcher([
              {
                asOfDate: sentinelDay,
                currency: sentinelCurrency,
                rate: 1,
                source: "should-not-run",
              },
            ]),
          ),
        );

        const seeded = yield* svc.ensureSeeded();
        expect(seeded).toBe(0);

        // The sentinel rate was never persisted: refreshLatest was skipped.
        const sentinelRows = yield* findByCurrency(sentinelCurrency);
        expect(sentinelRows.length).toBe(0);
      }),
    ),
  );

  // `it.todo` (raw vitest) rather than the harness `test`, whose typed wrapper
  // does not expose `.todo`.
  it.todo(
    "seeds from upstream when the fx_rate table is empty (returns the seeded count): " +
      "ensureSeeded's empty-table branch reads `findFirst()` table-wide with no filter, " +
      "so it only fires when the shared, never-truncated `fx_rate` table has zero rows. " +
      "That global precondition cannot be guaranteed in the shared integration DB without " +
      "destructively truncating the table (which would race other tests/runs), so the " +
      "empty-table seed path is deferred. The seeding mechanics it delegates to are already " +
      "covered by the refreshLatest tests above.",
  );
});

/**
 * Fetcher-level tests. The upstream ExchangeRate-API is a paid, quota-limited
 * external service, so the global `fetch` is replaced with a stub returning a
 * controlled provider payload. Everything else — URL construction, JSON
 * parsing, USD-base inversion, precision scaling and error mapping — is the
 * fetcher's *real* code running against that simulated response. These run via
 * raw vitest `it` + `Effect.runPromise` (no harness DB) since the fetcher has
 * no service dependencies.
 */
describe("createExchangeRateApiFxRateFetcher", () => {
  /** The most recent URL the fetcher passed to `fetch`. */
  let lastUrl: string | undefined;

  /**
   * Install a `fetch` stub that returns the given JSON body / status for the
   * next call and records the requested URL. `Response` is a DOM global.
   */
  const stubFetchJson = (status: number, body: unknown) => {
    lastUrl = undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((input: unknown) => {
        lastUrl = String(input);
        return Effect.runPromise(
          Effect.succeed(
            new Response(encodeJson(body), {
              headers: { "Content-Type": "application/json" },
              status,
            }),
          ),
        );
      }),
    );
  };

  /** Install a `fetch` stub that rejects, simulating a network failure. */
  const stubFetchReject = (message: string) => {
    lastUrl = undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Effect.runPromise(Effect.die(new Error(message)))),
    );
  };

  // Each test installs one of the two stubs as its first statement, and both
  // reset `lastUrl`, so no `beforeEach` is needed to clear it.
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds the /<apiKey>/latest/USD URL and inverts USD->X quotes to X->USD with FX precision", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        stubFetchJson(200, {
          base_code: "USD",
          conversion_rates: { EUR: 0.5, USD: 1 },
          result: "success",
          time_last_update_unix: 1_700_000_000,
        });

        const fetcher = createExchangeRateApiFxRateFetcher({
          apiKey: "test/key",
          // Trailing slash is intentional: the fetcher must trim it when building the URL.
          baseUrl: "https://example.test/v6/",
        });
        const rates = yield* fetcher.fetchLatestUsdRates();

        // URL: trailing slash trimmed, apiKey url-encoded, `/latest/USD` appended.
        expect(lastUrl).toBe("https://example.test/v6/test%2Fkey/latest/USD");

        const eur = rates.find((rate) => rate.currency === "EUR");
        const usd = rates.find((rate) => rate.currency === "USD");
        // 1 USD buys 0.5 EUR per quote => EUR->USD = 1/0.5 = 2.0.
        expect(eur?.rate).toBe(Math.round(2 * FX_RATE_PRECISION));
        // USD maps to the identity rate, not 1/1 via inversion of its own quote.
        expect(usd?.rate).toBe(FX_RATE_PRECISION);
        // asOfDate is the upstream timestamp truncated to midnight UTC.
        expect(eur?.asOfDate.getTime()).toBe(Date.UTC(2023, 10, 14));
        expect(eur?.source).toBe("exchange-rate-api:latest:1700000000");
      }),
    ));

  it("skips zero, negative and non-number quotes so they never poison the cache", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        stubFetchJson(200, {
          base_code: "USD",
          conversion_rates: { AAA: 0, BBB: -2, CCC: 4, DDD: "bad" },
          result: "success",
          time_last_update_unix: 1_700_000_000,
        });

        const fetcher = createExchangeRateApiFxRateFetcher({ apiKey: "k" });
        const rates = yield* fetcher.fetchLatestUsdRates();
        const codes = rates.map((rate) => rate.currency);

        expect(codes).toContain("CCC");
        expect(codes).not.toContain("AAA"); // zero quote skipped
        expect(codes).not.toContain("BBB"); // negative quote skipped
        expect(codes).not.toContain("DDD"); // non-number quote skipped
        expect(rates.find((rate) => rate.currency === "CCC")?.rate).toBe(
          Math.round((1 / 4) * FX_RATE_PRECISION),
        );
      }),
    ));

  it("maps an upstream error response to FxRateServiceError carrying the error type", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        stubFetchJson(200, { "error-type": "invalid-key", result: "error" });

        const fetcher = createExchangeRateApiFxRateFetcher({ apiKey: "k" });
        const error = yield* Effect.flip(fetcher.fetchLatestUsdRates());
        expect(error).toBeInstanceOf(FxRateServiceError);
        if (error instanceof FxRateServiceError) {
          expect(error.cause).toContain("invalid-key");
        }
      }),
    ));

  it("maps a non-200 HTTP response to FxRateServiceError", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        stubFetchJson(503, { result: "error" });

        const fetcher = createExchangeRateApiFxRateFetcher({ apiKey: "k" });
        const error = yield* Effect.flip(fetcher.fetchLatestUsdRates());
        expect(error).toBeInstanceOf(FxRateServiceError);
        if (error instanceof FxRateServiceError) {
          expect(error.cause).toContain("503");
        }
      }),
    ));

  it("maps a network/fetch failure to FxRateServiceError carrying the cause message", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        stubFetchReject("connection refused");

        const fetcher = createExchangeRateApiFxRateFetcher({ apiKey: "k" });
        const error = yield* Effect.flip(fetcher.fetchLatestUsdRates());
        expect(error).toBeInstanceOf(FxRateServiceError);
        if (error instanceof FxRateServiceError) {
          expect(error.cause).toContain("ExchangeRate API fetch failed");
          expect(error.cause).toContain("connection refused");
        }
      }),
    ));
});
