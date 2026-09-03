import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { parseISO4217CurrencyCode } from "@voidhash/lib/constants";

import { ExchangeRate, MinorAmount } from "../../domain/Money.ts";
import { PurchaseProcessingMoneyUsd } from "../../domain/PurchaseProcessing.ts";
import { FX_RATE_PRECISION, type FxRateLookup } from "../../fx/domain/FxRate.ts";
import type { FxRateServiceError } from "../../fx/application/FxRates.ts";

/**
 * Structural subset of the FX service the provider money builders need. The
 * resolved instance is passed in so the FX requirement never propagates into
 * every provider method's requirement channel.
 */
export interface FxRateLookupShape {
  readonly getUsdRate: (input: {
    readonly currency: string;
    readonly asOf: Date;
  }) => Effect.Effect<Option.Option<FxRateLookup>, FxRateServiceError>;
}

/** The five-amount breakdown every provider normalizes to, in the original currency's minor units. */
export interface MoneyBreakdown {
  readonly grossAmount: number;
  readonly storeCommissionAmount: number;
  readonly taxAmount: number;
  readonly proceedsAmount: number;
  readonly proceedsAfterTaxAmount: number;
}

/**
 * USD-cent value of a native minor-unit amount. The FX rate is major-per-major
 * (USD per one major unit, times {@link FX_RATE_PRECISION}) while `amount` is
 * in the source currency's minor units and the result must be in US cents, so
 * the conversion scales by `10 ** (2 - exponent)`. The factor is split into an
 * integer numerator and denominator so three-decimal currencies stay exact.
 */
export const convertMinorUnitsToUsdCents = (
  amount: number,
  rate: number,
  minorUnitExponent = 2,
): number => {
  const numerator = 10 ** Math.max(0, 2 - minorUnitExponent);
  const denominator = 10 ** Math.max(0, minorUnitExponent - 2);
  return Math.round((amount * rate * numerator) / (FX_RATE_PRECISION * denominator));
};

/** Mirrors a breakdown into USD at `exchangeRate`, rounding each amount independently. */
export const buildUsdBreakdown = (
  amounts: MoneyBreakdown,
  exchangeRate: number,
  minorUnitExponent = 2,
): PurchaseProcessingMoneyUsd =>
  new PurchaseProcessingMoneyUsd({
    exchangeRate: ExchangeRate.make(exchangeRate),
    grossAmount: MinorAmount.make(
      convertMinorUnitsToUsdCents(amounts.grossAmount, exchangeRate, minorUnitExponent),
    ),
    proceedsAfterTaxAmount: MinorAmount.make(
      convertMinorUnitsToUsdCents(amounts.proceedsAfterTaxAmount, exchangeRate, minorUnitExponent),
    ),
    proceedsAmount: MinorAmount.make(
      convertMinorUnitsToUsdCents(amounts.proceedsAmount, exchangeRate, minorUnitExponent),
    ),
    storeCommissionAmount: MinorAmount.make(
      convertMinorUnitsToUsdCents(amounts.storeCommissionAmount, exchangeRate, minorUnitExponent),
    ),
    taxAmount: MinorAmount.make(
      convertMinorUnitsToUsdCents(amounts.taxAmount, exchangeRate, minorUnitExponent),
    ),
  });

/** Validates a provider-reported currency, yielding none for anything that is not ISO 4217. */
export const parseProviderCurrency = (raw: string): Effect.Effect<Option.Option<string>> =>
  parseISO4217CurrencyCode(raw).pipe(
    Effect.map(Option.some),
    Effect.catchTag("InvalidISO4217CurrencyCodeError", () => Effect.succeed(Option.none<string>())),
  );
