import { Effect, Option } from "effect";

import { describe, expect, it } from "../../../testing/effect-vitest.ts";
import type { FxRateLookupShape } from "../appStore/money.ts";
import {
  GOOGLE_PLAY_COMMISSION_REDUCED_BPS,
  buildGooglePlayMoney,
  googleMoneyToMinorUnits,
  resolveGooglePlayCommissionRateBps,
} from "./money.ts";

const stubFxAt = (rate: number): FxRateLookupShape => ({
  getUsdRate: (input) =>
    Effect.succeed(
      Option.some({
        asOfDate: input.asOf,
        currency: input.currency,
        rate,
        source: "test",
      }),
    ),
});

const fxNone: FxRateLookupShape = {
  getUsdRate: () => Effect.succeed(Option.none()),
};

const OCCURRED_AT = new Date("2024-02-15T12:00:00Z");

describe("googleMoneyToMinorUnits", () => {
  it("converts units + nanos into 2-decimal minor units", () => {
    expect(
      googleMoneyToMinorUnits({ currencyCode: "USD", nanos: 990_000_000, units: "9" }),
    ).toEqual(Option.some({ currency: "USD", minorUnits: 999 }));
  });

  it("handles sub-unit-only amounts", () => {
    expect(
      googleMoneyToMinorUnits({ currencyCode: "USD", nanos: 990_000_000, units: "0" }),
    ).toEqual(Option.some({ currency: "USD", minorUnits: 99 }));
  });

  it("returns none when the currency is absent", () => {
    expect(googleMoneyToMinorUnits({ nanos: 990_000_000, units: "9" })).toEqual(Option.none());
  });

  it("returns none when both amount components are absent", () => {
    expect(googleMoneyToMinorUnits({ currencyCode: "USD" })).toEqual(Option.none());
  });
});

describe("resolveGooglePlayCommissionRateBps", () => {
  it("uses the reduced 15% rate", () => {
    expect(resolveGooglePlayCommissionRateBps({ productType: "subscription" })).toBe(
      GOOGLE_PLAY_COMMISSION_REDUCED_BPS,
    );
    expect(resolveGooglePlayCommissionRateBps({ productType: "product" })).toBe(1_500);
  });
});

describe("buildGooglePlayMoney", () => {
  it.effect("builds the breakdown + USD mirror at parity FX", () =>
    Effect.gen(function* () {
      const money = yield* buildGooglePlayMoney({
        commissionRateBps: 1_500,
        currency: Option.some("USD"),
        fxRateService: stubFxAt(1_000_000),
        isTrial: false,
        occurredAt: OCCURRED_AT,
        priceMinorUnits: Option.some(999),
        storefront: Option.some("US"),
      });
      const value = Option.getOrThrow(money);
      expect(value.grossAmount).toBe(999);
      expect(value.storeCommissionAmount).toBe(150); // round(999 * 0.15)
      expect(value.taxAmount).toBe(0);
      expect(value.proceedsAmount).toBe(849);
      expect(value.proceedsAfterTaxAmount).toBe(849);
      const usd = Option.getOrThrow(value.usd);
      expect(usd.grossAmount).toBe(999);
      expect(usd.storeCommissionAmount).toBe(150);
    }),
  );

  it.effect("scales the USD mirror by the FX rate for a non-USD currency", () =>
    Effect.gen(function* () {
      const money = yield* buildGooglePlayMoney({
        commissionRateBps: 1_500,
        currency: Option.some("EUR"),
        fxRateService: stubFxAt(1_100_000), // 1 EUR = 1.1 USD
        isTrial: false,
        occurredAt: OCCURRED_AT,
        priceMinorUnits: Option.some(1_000),
        storefront: Option.some("DE"),
      });
      const value = Option.getOrThrow(money);
      expect(value.grossAmount).toBe(1_000);
      const usd = Option.getOrThrow(value.usd);
      expect(usd.grossAmount).toBe(1_100); // round(1000 * 1.1)
    }),
  );

  it.effect("returns none for a trial (no revenue on a free/intro period)", () =>
    Effect.gen(function* () {
      const money = yield* buildGooglePlayMoney({
        commissionRateBps: 1_500,
        currency: Option.some("USD"),
        fxRateService: stubFxAt(1_000_000),
        isTrial: true,
        occurredAt: OCCURRED_AT,
        priceMinorUnits: Option.some(999),
        storefront: Option.some("US"),
      });
      expect(Option.isNone(money)).toBe(true);
    }),
  );

  it.effect("returns none when the price is unknown", () =>
    Effect.gen(function* () {
      const money = yield* buildGooglePlayMoney({
        commissionRateBps: 1_500,
        currency: Option.some("USD"),
        fxRateService: stubFxAt(1_000_000),
        isTrial: false,
        occurredAt: OCCURRED_AT,
        priceMinorUnits: Option.none(),
        storefront: Option.some("US"),
      });
      expect(Option.isNone(money)).toBe(true);
    }),
  );

  it.effect("emits money with usd:none when no FX rate exists (never guesses USD)", () =>
    Effect.gen(function* () {
      const money = yield* buildGooglePlayMoney({
        commissionRateBps: 1_500,
        currency: Option.some("USD"),
        fxRateService: fxNone,
        isTrial: false,
        occurredAt: OCCURRED_AT,
        priceMinorUnits: Option.some(999),
        storefront: Option.some("US"),
      });
      const value = Option.getOrThrow(money);
      expect(value.grossAmount).toBe(999);
      expect(Option.isNone(value.usd)).toBe(true);
    }),
  );

  it.effect("returns none for an unparseable currency", () =>
    Effect.gen(function* () {
      const money = yield* buildGooglePlayMoney({
        commissionRateBps: 1_500,
        currency: Option.some("ZZZ"),
        fxRateService: stubFxAt(1_000_000),
        isTrial: false,
        occurredAt: OCCURRED_AT,
        priceMinorUnits: Option.some(999),
        storefront: Option.some("US"),
      });
      expect(Option.isNone(money)).toBe(true);
    }),
  );
});
