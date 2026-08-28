/**
 * Fx-rate domain — the single-rate DTO returned by `FxRateService.getUsdRate`,
 * plus the precision constants that pin how rates are stored in MySQL.
 *
 * `usd_rate` is an `INT` column holding `rate × 1_000_000`, so an exchange
 * rate of `1.234567` is stored as `1234567`. Every read and write uses
 * {@link FX_RATE_PRECISION} as the conversion factor; never round-trip a
 * floating-point quote through the DB without it.
 */

/** USD identity rate: `1.0 × FX_RATE_PRECISION`. */
import { Schema } from "effect";

import { CurrencyCode } from "../../domain/Money.ts";

export const USD_IDENTITY_RATE = 1_000_000;

/** Stored precision multiplier for FX rates (`rate × 1_000_000`). */
export const FX_RATE_PRECISION = 1_000_000;

/**
 * Single `(currency, asOfDate)` rate. `rate` is the integer stored in the
 * `fx_rate.usd_rate` column (i.e. `floor(currency → USD × FX_RATE_PRECISION)`).
 * `asOfDate` is normalized to midnight UTC so the unique `(currency,
 * as_of_date)` index hits regardless of intraday call time.
 */
export interface FxRateLookup {
  readonly currency: string;
  readonly rate: number;
  readonly asOfDate: Date;
  readonly source: string;
}

export const FxRateLookup = Schema.Struct({
  asOfDate: Schema.Date,
  currency: Schema.NonEmptyString,
  rate: Schema.Int.check(Schema.isGreaterThan(0)),
  source: Schema.NonEmptyString,
});

export const FxRateLookups = Schema.Array(FxRateLookup);

/**
 * Write-side counterpart of {@link FxRateLookup}: the same row, but `currency`
 * must be a valid ISO 4217 {@link CurrencyCode}.
 *
 * The read side stays deliberately loose — `currency` is decoded on every FX
 * lookup, so tightening it there would turn a legacy row holding a non-ISO
 * currency into a read-path outage for that currency. Only rows we newly write
 * are held to the tighter contract.
 */
export interface FxRateWrite extends FxRateLookup {
  readonly currency: typeof CurrencyCode.Type;
}

export const FxRateWrite = Schema.Struct({
  asOfDate: Schema.Date,
  currency: CurrencyCode,
  rate: Schema.Int.check(Schema.isGreaterThan(0)),
  source: Schema.NonEmptyString,
});

export const FxRateWrites = Schema.Array(FxRateWrite);
