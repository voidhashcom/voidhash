/**
 * Pure unit tests for the Stripe money normalizer. `buildStripeMoney` runs
 * offline against a fake `FxRateService` (identity USD rate, `none` for every
 * other currency) so the five-amount breakdown and the USD mirror are exercised
 * without touching the DB or the upstream FX provider.
 *
 * Stripe reports amounts directly in minor units (no `/10` Apple scaling), so
 * the asserted values are the raw inputs: commission = `feeMinor ?? 0`,
 * proceeds = gross − commission, proceedsAfterTax = proceeds − tax.
 */
import { Effect, Option } from "effect";

import { describe, expect, it } from "vite-plus/test";

import { FX_RATE_PRECISION, type FxRateLookup } from "../../../domain/fxRate/FxRate.ts";
import { buildStripeMoney, type FxRateLookupShape } from "./money.ts";

/**
 * Fake `FxRateService` shape: identity rate for USD (so USD purchases resolve
 * to a `1.0` mirror), `Option.none()` for everything else (so non-USD
 * currencies exercise the FX-less branch). `currency` arrives already
 * upper-cased from `buildStripeMoney`'s `parseISO4217CurrencyCode` step.
 */
const fxRateService: FxRateLookupShape = {
  getUsdRate: ({ currency }: { readonly currency: string; readonly asOf: Date }) =>
    Effect.succeed(
      currency === "USD"
        ? Option.some<FxRateLookup>({
            asOfDate: new Date("2026-01-01T00:00:00.000Z"),
            currency: "USD",
            rate: FX_RATE_PRECISION,
            source: "identity",
          })
        : Option.none<FxRateLookup>(),
    ),
};

const occurredAt = new Date("2026-01-01T12:00:00.000Z");

const run = <A, E>(effect: Effect.Effect<A, E>): A => Effect.runSync(effect);

describe("buildStripeMoney", () => {
  it("builds the full breakdown with the USD mirror for a USD amount", () => {
    const result = run(
      buildStripeMoney({
        currency: "usd",
        feeMinor: 30,
        fxRateService,
        grossMinor: 1000,
        occurredAt,
        taxMinor: 100,
      }),
    );
    expect(Option.isSome(result)).toBe(true);
    const money = Option.getOrThrow(result);
    expect(money.currency).toBe("USD");
    expect(money.grossAmount).toBe(1000);
    expect(money.taxAmount).toBe(100);
    expect(money.storeCommissionAmount).toBe(30);
    expect(money.proceedsAmount).toBe(970);
    expect(money.proceedsAfterTaxAmount).toBe(870);
    expect(Option.isNone(money.storefront)).toBe(true);

    expect(Option.isSome(money.usd)).toBe(true);
    const usd = Option.getOrThrow(money.usd);
    expect(usd.exchangeRate).toBe(FX_RATE_PRECISION);
    // Identity rate (1.0) → USD amounts mirror the original-currency amounts.
    expect(usd.grossAmount).toBe(1000);
    expect(usd.taxAmount).toBe(100);
    expect(usd.storeCommissionAmount).toBe(30);
    expect(usd.proceedsAmount).toBe(970);
    expect(usd.proceedsAfterTaxAmount).toBe(870);
  });

  it("treats an undefined fee as zero commission (proceeds === gross)", () => {
    const result = run(
      buildStripeMoney({
        currency: "usd",
        feeMinor: undefined,
        fxRateService,
        grossMinor: 1000,
        occurredAt,
        taxMinor: 100,
      }),
    );
    const money = Option.getOrThrow(result);
    expect(money.storeCommissionAmount).toBe(0);
    expect(money.proceedsAmount).toBe(1000);
    expect(money.proceedsAfterTaxAmount).toBe(900);

    const usd = Option.getOrThrow(money.usd);
    expect(usd.storeCommissionAmount).toBe(0);
    expect(usd.proceedsAmount).toBe(1000);
  });

  it("leaves the USD mirror absent when no FX rate is available", () => {
    const result = run(
      buildStripeMoney({
        currency: "eur",
        feeMinor: 30,
        fxRateService,
        grossMinor: 1000,
        occurredAt,
        taxMinor: 100,
      }),
    );
    expect(Option.isSome(result)).toBe(true);
    const money = Option.getOrThrow(result);
    // Original-currency amounts are still present...
    expect(money.currency).toBe("EUR");
    expect(money.grossAmount).toBe(1000);
    expect(money.taxAmount).toBe(100);
    expect(money.storeCommissionAmount).toBe(30);
    expect(money.proceedsAmount).toBe(970);
    expect(money.proceedsAfterTaxAmount).toBe(870);
    // ...but the USD mirror is dropped rather than zeroed.
    expect(Option.isNone(money.usd)).toBe(true);
  });

  it("returns Option.none() for an invalid currency", () => {
    const result = run(
      buildStripeMoney({
        currency: "zz",
        feeMinor: 30,
        fxRateService,
        grossMinor: 1000,
        occurredAt,
        taxMinor: 100,
      }),
    );
    expect(Option.isNone(result)).toBe(true);
  });

  it("builds an all-zero breakdown for a zero-gross (free trial) amount", () => {
    const result = run(
      buildStripeMoney({
        currency: "usd",
        feeMinor: 0,
        fxRateService,
        grossMinor: 0,
        occurredAt,
        taxMinor: 0,
      }),
    );
    expect(Option.isSome(result)).toBe(true);
    const money = Option.getOrThrow(result);
    expect(money.grossAmount).toBe(0);
    expect(money.taxAmount).toBe(0);
    expect(money.storeCommissionAmount).toBe(0);
    expect(money.proceedsAmount).toBe(0);
    expect(money.proceedsAfterTaxAmount).toBe(0);

    const usd = Option.getOrThrow(money.usd);
    expect(usd.grossAmount).toBe(0);
    expect(usd.proceedsAfterTaxAmount).toBe(0);
  });
});
