/**
 * Provider-specific money normalization for Google Play purchases.
 *
 * Google does not return the paid amount on the purchase response, so the
 * caller resolves the developer-set regional list price from the monetization
 * catalog and passes it here as already-converted minor units. This module
 * applies the commission tier, derives proceeds, and converts to USD:
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
import { getCurrencyMinorUnitExponent } from "@voidhash/lib/constants";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { CurrencyCode, MinorAmount } from "../../../domain/Money.ts";
import { PurchaseProcessingMoney } from "../../../domain/PurchaseProcessing.ts";
import {
  buildUsdBreakdown,
  parseProviderCurrency,
  type FxRateLookupShape,
} from "../../domain/ProviderMoney.ts";

/**
 * Google Play's standard commission is 15% on subscriptions and on the first
 * $1M of an account's annual revenue; 30% applies only above that threshold —
 * which we can't observe per transaction. We therefore default to the reduced
 * 15% rate, which is correct for subscriptions and for the vast majority of
 * developers. The standard rate is exposed for completeness / future config.
 */
export const GOOGLE_PLAY_COMMISSION_REDUCED_BPS = 1_500;
export const GOOGLE_PLAY_COMMISSION_STANDARD_BPS = 3_000;

export const resolveGooglePlayCommissionRateBps = (_input: {
  readonly productType: "subscription" | "product";
}): number => GOOGLE_PLAY_COMMISSION_REDUCED_BPS;

/** Google's `Money` wire shape: whole major units plus billionths of a major unit. */
export interface GoogleMoney {
  readonly currencyCode?: string;
  readonly units?: string;
  readonly nanos?: number;
}

/**
 * Converts a Google `Money` to that currency's true ISO 4217 minor units: yen
 * for JPY (0 decimals), cents for USD (2), fils for KWD (3). Returns `None`
 * when the currency or amount components are absent.
 */
export const googleMoneyToMinorUnits = (
  money: GoogleMoney,
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
    const currencyOp = yield* parseProviderCurrency(input.currency.value);
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
