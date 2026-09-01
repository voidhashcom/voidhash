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
import { getCurrencyMinorUnitExponent, parseISO4217CurrencyCode } from "@voidhash/lib/constants";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { PurchaseProcessingMoney, PurchaseProcessingMoneyUsd } from "@voidhash/core-v2";
import { CurrencyCode, ExchangeRate, FX_RATE_PRECISION, MinorAmount } from "@voidhash/core-v2";
import type { FxRateLookupShape } from "../app-store/money.ts";

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
 * Converts a Google `Money` (`{ currencyCode, units` = whole major units,
 * `nanos` = billionths of a major unit`}`) to that currency's true ISO 4217
 * minor units: yen for JPY (0 decimals), cents for USD (2), fils for KWD (3).
 * Returns `None` when the currency or amount components are absent.
 */
export const googleMoneyToMinorUnits = (
  money: MoneyType,
): Option.Option<{ readonly minorUnits: number; readonly currency: string }> => {
  if (!money.currencyCode) return Option.none();
  if (money.units === undefined && money.nanos === undefined) return Option.none();
  const units = Number(money.units ?? "0");
  if (Number.isNaN(units)) return Option.none();
  const nanos = money.nanos ?? 0;
  const scale = 10 ** getCurrencyMinorUnitExponent(money.currencyCode);
  const minorUnits = Math.round(units * scale + (nanos * scale) / 1e9);
  return Option.some({ currency: money.currencyCode, minorUnits });
};

/**
 * USD-cent value of a native minor-unit amount.
 *
 * The FX rate is *major-per-major* (USD per one major unit, ×
 * {@link FX_RATE_PRECISION}) while `amount` is in the source currency's minor
 * units and the result must be in US **cents** (exponent 2). So the conversion
 * is `amount / 10 ** exponent × rate / FX_RATE_PRECISION × 100`, i.e. a factor
 * of `10 ** (2 - exponent)`. Splitting that factor into an integer numerator
 * and an integer denominator (rather than a single `10 ** (2 - exponent)`,
 * which is fractional for 3-decimal currencies) keeps the arithmetic exact and
 * keeps `amount × rate × numerator` at the same magnitude it had under the old
 * fixed-2-decimal convention — an amount 100× smaller is multiplied by 100 —
 * so the safe-integer headroom is unchanged.
 */
const convertToUsd = (amount: number, rate: number, minorUnitExponent: number): number => {
  const numerator = 10 ** Math.max(0, 2 - minorUnitExponent);
  const denominator = 10 ** Math.max(0, minorUnitExponent - 2);
  return Math.round((amount * rate * numerator) / (FX_RATE_PRECISION * denominator));
};

const buildUsdBreakdown = (
  amounts: {
    readonly grossAmount: number;
    readonly storeCommissionAmount: number;
    readonly taxAmount: number;
    readonly proceedsAmount: number;
    readonly proceedsAfterTaxAmount: number;
  },
  exchangeRate: number,
  minorUnitExponent: number,
): PurchaseProcessingMoneyUsd =>
  new PurchaseProcessingMoneyUsd({
    exchangeRate: ExchangeRate.make(exchangeRate),
    grossAmount: MinorAmount.make(
      convertToUsd(amounts.grossAmount, exchangeRate, minorUnitExponent),
    ),
    proceedsAfterTaxAmount: MinorAmount.make(
      convertToUsd(amounts.proceedsAfterTaxAmount, exchangeRate, minorUnitExponent),
    ),
    proceedsAmount: MinorAmount.make(
      convertToUsd(amounts.proceedsAmount, exchangeRate, minorUnitExponent),
    ),
    storeCommissionAmount: MinorAmount.make(
      convertToUsd(amounts.storeCommissionAmount, exchangeRate, minorUnitExponent),
    ),
    taxAmount: MinorAmount.make(convertToUsd(amounts.taxAmount, exchangeRate, minorUnitExponent)),
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
    const minorUnitExponent = getCurrencyMinorUnitExponent(currency);
    const usd = Option.map(fxLookup, (lookup) =>
      buildUsdBreakdown(
        { grossAmount, proceedsAfterTaxAmount, proceedsAmount, storeCommissionAmount, taxAmount },
        lookup.rate,
        minorUnitExponent,
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
