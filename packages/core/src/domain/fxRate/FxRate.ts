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
