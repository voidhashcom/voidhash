import * as Schema from "effect/Schema";

/**
 * ISO 4217 alphabetic currency code (e.g., `"USD"`, `"EUR"`). Stored upper-case
 * because that is the canonical wire form used by every payment provider we
 * integrate with; we do not currently support ISO 4217 numeric codes.
 */
export const CurrencyCode = Schema.String.check(Schema.isPattern(/^[A-Z]{3}$/)).pipe(
  Schema.brand("CurrencyCode"),
);
export type CurrencyCode = typeof CurrencyCode.Type;

/**
 * Non-negative integer amount denominated in the currency's smallest unit
 * (cents for USD, yen for JPY, etc.). All money fields in the domain layer
 * use minor units to avoid floating-point rounding; sign conventions (e.g.,
 * refunds emitting negative deltas) are applied at the analytics-mapper
 * boundary, not at construction time.
 */
export const MinorAmount = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)).pipe(
  Schema.brand("MinorAmount"),
);
export type MinorAmount = typeof MinorAmount.Type;

/**
 * `rate * 1_000_000` — six decimal places of precision encoded as a positive
 * integer. Matches the `transaction.exchange_rate` column convention so an
 * exchange rate of `1.234567` is stored as `1234567`.
 */
export const ExchangeRate = Schema.Int.check(Schema.isGreaterThan(0)).pipe(
  Schema.brand("ExchangeRate"),
);
export type ExchangeRate = typeof ExchangeRate.Type;
