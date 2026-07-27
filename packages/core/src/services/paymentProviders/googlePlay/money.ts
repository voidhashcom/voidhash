/**
 * Provider-specific money normalization for Google Play purchases.
 *
 * Google does not return the paid amount on the purchase response, so the
 * caller resolves the developer-set regional list price from the monetization
 * catalog (see `sdk-context.ts`) and passes it here as already-converted minor
 * units. This module applies the commission tier, derives proceeds, and
 * converts to USD via {@link FxRateService}:
 *
 *   gross  = list price (buyer-facing, region currency)
 *   tax    = 0  (Google nets tax server-side; not exposed per transaction)
 *   comm.  = gross × commissionRate (15% standard / 30% large-account)
 *   proc.  = gross - comm.
 *   procT. = gross - comm. - tax
 *
 * Returns `Option.none()` when price/currency are absent or the purchase is a
 * (potentially free) trial/intro period — downstream layers leave money fields
 * blank rather than emit a guessed or zero amount.
 */
import type { MoneyType } from "@voidhash/google-play-server-sdk";
import { parseISO4217CurrencyCode } from "@voidhash/lib/constants";
import { Effect, Option } from "effect";

import {
  PurchaseProcessingMoney,
  PurchaseProcessingMoneyUsd,
} from "../../../domain/purchaseProcessing/PurchaseProcessing.ts";
import { CurrencyCode, ExchangeRate, MinorAmount } from "../../../domain/shared/Money.ts";
import { FX_RATE_PRECISION } from "../../../domain/fxRate/FxRate.ts";
import type { FxRateLookupShape } from "../appStore/money.ts";

/**
 * Google Play's standard commission is 15% on subscriptions and on the first
 * $1M of an account's annual revenue; 30% applies only above that threshold —
 * which we can't observe per transaction. We therefore default to the reduced
 * 15% rate, which is correct for subscriptions and for the vast majority of
 * developers. The standard rate is exposed for completeness / future config.
 */
export const GOOGLE_PLAY_COMMISSION_REDUCED_BPS = 1_500; // 15.00%
export const GOOGLE_PLAY_COMMISSION_STANDARD_BPS = 3_000; // 30.00%

export const resolveGooglePlayCommissionRateBps = (_input: {
  readonly productType: "subscription" | "product";
}): number => GOOGLE_PLAY_COMMISSION_REDUCED_BPS;

/**
 * Converts a Google `Money` (`{ currencyCode, units, nanos }`) to 2-decimal
 * minor units (cents). Matches the codebase-wide minor-unit convention (the
 * App Store path makes the same 2-decimal assumption). Returns `None` when the
 * currency or amount components are absent.
 */
export const googleMoneyToMinorUnits = (
  money: MoneyType,
): Option.Option<{ readonly minorUnits: number; readonly currency: string }> => {
  if (!money.currencyCode) return Option.none();
  if (money.units === undefined && money.nanos === undefined) return Option.none();
  const units = Number(money.units ?? "0");
  if (Number.isNaN(units)) return Option.none();
  const nanos = money.nanos ?? 0;
  const minorUnits = Math.round(units * 100 + nanos / 1e7);
  return Option.some({ currency: money.currencyCode, minorUnits });
};

const convertToUsd = (amount: number, rate: number): number =>
  Math.round((amount * rate) / FX_RATE_PRECISION);

const buildUsdBreakdown = (
  amounts: {
    readonly grossAmount: number;
    readonly storeCommissionAmount: number;
    readonly taxAmount: number;
    readonly proceedsAmount: number;
    readonly proceedsAfterTaxAmount: number;
  },
  exchangeRate: number,
): PurchaseProcessingMoneyUsd =>
  new PurchaseProcessingMoneyUsd({
    exchangeRate: ExchangeRate.make(exchangeRate),
    grossAmount: MinorAmount.make(convertToUsd(amounts.grossAmount, exchangeRate)),
    proceedsAfterTaxAmount: MinorAmount.make(
      convertToUsd(amounts.proceedsAfterTaxAmount, exchangeRate),
    ),
    proceedsAmount: MinorAmount.make(convertToUsd(amounts.proceedsAmount, exchangeRate)),
    storeCommissionAmount: MinorAmount.make(
      convertToUsd(amounts.storeCommissionAmount, exchangeRate),
    ),
    taxAmount: MinorAmount.make(convertToUsd(amounts.taxAmount, exchangeRate)),
  });

/**
 * Builds the full money record for a Google Play purchase from an
 * already-resolved minor-unit price.
 *
 * Returns `Option.none()` when `priceMinorUnits` / `currency` are absent or
 * `isTrial` is set (a free/intro period generates no revenue; revenue is
 * captured at the first renewal). Returns the populated record with
 * `usd: Option.none()` when the FX service has no rate for the currency on the
 * purchase date — never falls back to the raw amount as USD.
 */
export const buildGooglePlayMoney = (input: {
  readonly priceMinorUnits: Option.Option<number>;
  readonly currency: Option.Option<string>;
  readonly storefront: Option.Option<string>;
  readonly isTrial: boolean;
  readonly commissionRateBps: number;
  readonly occurredAt: Date;
  readonly fxRateService: FxRateLookupShape;
}) =>
  Effect.gen(function* () {
    if (input.isTrial) {
      return Option.none<PurchaseProcessingMoney>();
    }
    if (Option.isNone(input.priceMinorUnits) || Option.isNone(input.currency)) {
      return Option.none<PurchaseProcessingMoney>();
    }
    const currencyOp = yield* parseISO4217CurrencyCode(input.currency.value).pipe(
      Effect.map(Option.some),
      Effect.catchTag("InvalidISO4217CurrencyCodeError", () => Effect.succeedNone),
    );
    if (Option.isNone(currencyOp)) {
      return Option.none<PurchaseProcessingMoney>();
    }
    const currency = currencyOp.value;

    const grossAmount = Math.max(0, input.priceMinorUnits.value);
    const storeCommissionAmount = Math.round((grossAmount * input.commissionRateBps) / 10_000);
    const taxAmount = 0;
    const proceedsAmount = grossAmount - storeCommissionAmount;
    const proceedsAfterTaxAmount = proceedsAmount - taxAmount;

    const fxLookup = yield* input.fxRateService.getUsdRate({
      asOf: input.occurredAt,
      currency,
    });
    const usd = Option.map(fxLookup, (lookup) =>
      buildUsdBreakdown(
        { grossAmount, proceedsAfterTaxAmount, proceedsAmount, storeCommissionAmount, taxAmount },
        lookup.rate,
      ),
    );

    return Option.some(
      new PurchaseProcessingMoney({
        currency: CurrencyCode.make(currency),
        grossAmount: MinorAmount.make(grossAmount),
        proceedsAfterTaxAmount: MinorAmount.make(proceedsAfterTaxAmount),
        proceedsAmount: MinorAmount.make(proceedsAmount),
        storeCommissionAmount: MinorAmount.make(storeCommissionAmount),
        storefront: input.storefront,
        taxAmount: MinorAmount.make(taxAmount),
        usd,
      }),
    );
  });
