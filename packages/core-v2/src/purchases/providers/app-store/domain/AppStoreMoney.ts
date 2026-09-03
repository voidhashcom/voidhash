/**
 * Provider-specific money normalization for Apple App Store transactions.
 *
 * Translates the single `price` field on a decoded JWS into the five-amount
 * breakdown the platform-neutral purchase-processing layer expects:
 *
 *   gross  = price                                  (what the customer paid)
 *   tax    = back-computed from storefront VAT      (Apple does not break out)
 *   comm.  = gross × commissionRate                 (15% SBP / year-2+, else 30%)
 *   proc.  = gross - comm.
 *   procT. = gross - comm. - tax
 *
 * Inputs that are missing on the JWS (no price, no currency) yield
 * `Option.none()` so downstream layers leave money fields blank rather than
 * emit zeros. The decoded JWS is consumed structurally so this module stays
 * free of the App Store SDK.
 */
import { getStorefrontVatRateBps } from "@voidhash/lib/constants";
import { pick } from "@voidhash/lib/lang";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import type * as Schema from "effect/Schema";

import { CurrencyCode, MinorAmount } from "../../../domain/Money.ts";
import { PurchaseProcessingMoney } from "../../../domain/PurchaseProcessing.ts";
import {
  buildUsdBreakdown,
  parseProviderCurrency,
  type FxRateLookupShape,
} from "../../domain/ProviderMoney.ts";

/** Apple's `price` field on a decoded JWS is in milliunits (10× minor units). */
const APPLE_PRICE_DENOMINATOR = 10;

/** Apple's `revocationPercentage` is in milliunits (100% = 100_000). */
const APPLE_REVOCATION_FULL = 100_000;

export const APPLE_COMMISSION_STANDARD_BPS = 3_000;
export const APPLE_COMMISSION_REDUCED_BPS = 1_500;

/** Apple's `type` value for auto-renewable subscriptions. */
export const APPLE_AUTO_RENEWABLE_SUBSCRIPTION_TYPE = "Auto-Renewable Subscription";

/** Apple's `inAppOwnershipType` value for family-shared entitlements. */
export const APPLE_FAMILY_SHARED_OWNERSHIP = "FAMILY_SHARED";

/** One Gregorian year in milliseconds (365.25 days). Used for the year-2+ rule. */
const ONE_YEAR_MS = Math.round(365.25 * 24 * 60 * 60 * 1_000);

/** Fields of a decoded App Store JWS transaction that money normalization reads. */
export interface AppStoreMoneyTransaction {
  readonly currency: Option.Option<string>;
  readonly inAppOwnershipType: Option.Option<string>;
  readonly originalPurchaseDate: Option.Option<number>;
  readonly price: Option.Option<number>;
  readonly purchaseDate: Option.Option<number>;
  readonly revocationPercentage: Option.Option<number>;
  readonly storefront: Option.Option<string>;
  readonly type: Option.Option<string>;
}

/**
 * Subset of the App Store global configuration needed to compute the
 * commission rate.
 */
export interface AppleCommissionConfiguration {
  readonly appleSmallBusinessProgramStartDate?: string;
  readonly hasAppleSmallBusinessProgramEndDate: boolean;
  readonly appleSmallBusinessProgramEndDate?: string;
}

/** Parses an operator-supplied date string, returning `undefined` when unparseable. */
const parseConfiguredDate = (value: string): Date | typeof Schema.Undefined.Type => {
  const parsed = DateTime.make(value);
  if (Option.isNone(parsed)) return undefined;
  return DateTime.toDateUtc(parsed.value);
};

const isSmallBusinessProgramActiveAt = (
  config: AppleCommissionConfiguration,
  at: Date,
): boolean => {
  const startStr = config.appleSmallBusinessProgramStartDate;
  if (!startStr) return false;
  const start = parseConfiguredDate(startStr);
  if (!start) return false;
  if (at < start) return false;
  if (!config.hasAppleSmallBusinessProgramEndDate) return true;
  const endStr = config.appleSmallBusinessProgramEndDate;
  if (!endStr) return true;
  const end = parseConfiguredDate(endStr);
  if (!end) return true;
  return at <= end;
};

const isYearTwoOrLaterAutoRenewable = (decoded: AppStoreMoneyTransaction): boolean => {
  if (!Option.contains(decoded.type, APPLE_AUTO_RENEWABLE_SUBSCRIPTION_TYPE)) return false;
  const original = Option.getOrUndefined(decoded.originalPurchaseDate);
  const current = Option.getOrUndefined(decoded.purchaseDate);
  if (original === undefined || current === undefined) return false;
  return current - original > ONE_YEAR_MS;
};

/**
 * Returns Apple's commission rate in basis points for a transaction. 15% when
 * either (a) the bundle was enrolled in the Small Business Program at the
 * transaction date, or (b) the transaction is an auto-renewable subscription
 * whose `originalPurchaseDate` was more than a year before `purchaseDate`
 * (Apple's automatic reduction after year 1). Else 30%.
 */
export const resolveAppleCommissionRateBps = (input: {
  readonly decoded: AppStoreMoneyTransaction;
  readonly globalConfiguration: AppleCommissionConfiguration;
  readonly occurredAt: Date;
}): number => {
  if (isSmallBusinessProgramActiveAt(input.globalConfiguration, input.occurredAt)) {
    return APPLE_COMMISSION_REDUCED_BPS;
  }
  if (isYearTwoOrLaterAutoRenewable(input.decoded)) {
    return APPLE_COMMISSION_REDUCED_BPS;
  }
  return APPLE_COMMISSION_STANDARD_BPS;
};

/**
 * Estimates the VAT / sales tax baked into `grossAmount` using the storefront
 * country's published rate. Apple does not include a tax breakdown in the JWS
 * — where Apple is merchant of record the price the customer paid already
 * has tax included, so we back out:
 *
 *   gross = taxedBase × (1 + rate)
 *   tax   = gross × rate / (1 + rate)
 *
 * Returns 0 for unknown storefronts (most US sales tax falls here; Apple
 * handles US sales tax outside the JWS).
 */
export const estimateAppleTaxAmount = (input: {
  readonly grossAmount: number;
  readonly storefront: Option.Option<string>;
}): number => {
  const rateBps = getStorefrontVatRateBps(input.storefront);
  if (rateBps <= 0) return 0;
  const numerator = input.grossAmount * rateBps;
  const denominator = 10_000 + rateBps;
  return Math.round(numerator / denominator);
};

const scaleAmountByRefundPercentage = (
  amount: number,
  refundPercentageMilliunits: number,
): number => {
  if (refundPercentageMilliunits >= APPLE_REVOCATION_FULL) return amount;
  if (refundPercentageMilliunits <= 0) return 0;
  return Math.round((amount * refundPercentageMilliunits) / APPLE_REVOCATION_FULL);
};

/**
 * Builds the full money record for an App Store JWS transaction.
 *
 * Returns `Option.none()` when the JWS omits either `price` or `currency` —
 * downstream layers leave the money fields blank in that case rather than
 * write zeros. Returns the populated record with `usd: Option.none()` when
 * the FX service has no rate for the currency on the transaction date; the
 * caller still gets gross/commission/tax/proceeds in the original currency.
 *
 * Partial refunds (`revocationPercentage < 100_000`) scale all five amounts
 * proportionally so the analytics event carries the actual delta rather than
 * the full-purchase amounts.
 */
export const buildAppStoreMoney = (input: {
  readonly decoded: AppStoreMoneyTransaction;
  readonly globalConfiguration: AppleCommissionConfiguration;
  readonly occurredAt: Date;
  readonly fxRateService: FxRateLookupShape;
}) =>
  Effect.gen(function* () {
    const priceOp = input.decoded.price;
    const currencyRawOp = input.decoded.currency;
    if (Option.isNone(priceOp) || Option.isNone(currencyRawOp)) {
      return Option.none<PurchaseProcessingMoney>();
    }
    const currencyOp = yield* parseProviderCurrency(currencyRawOp.value);
    if (Option.isNone(currencyOp)) {
      return Option.none<PurchaseProcessingMoney>();
    }
    const currency = currencyOp.value;
    const storefront = input.decoded.storefront;

    const fullGross = Math.round(priceOp.value / APPLE_PRICE_DENOMINATOR);
    const refundPercentage = Option.getOrElse(
      input.decoded.revocationPercentage,
      () => APPLE_REVOCATION_FULL,
    );
    const grossAmount = scaleAmountByRefundPercentage(fullGross, refundPercentage);
    const commissionBps = resolveAppleCommissionRateBps({
      decoded: input.decoded,
      globalConfiguration: input.globalConfiguration,
      occurredAt: input.occurredAt,
    });
    // Family-shared transactions never generate revenue for us — Apple does
    // not credit the developer for the family member's grant. We still record
    // the gross so analytics can see the entitlement, but commission and
    // proceeds are zero.
    const isFamilyShared = Option.contains(
      input.decoded.inAppOwnershipType,
      APPLE_FAMILY_SHARED_OWNERSHIP,
    );
    const storeCommissionAmount = pick(
      isFamilyShared,
      0,
      Math.round((grossAmount * commissionBps) / 10_000),
    );
    const taxAmount = estimateAppleTaxAmount({ grossAmount, storefront });
    const proceedsAmount = grossAmount - storeCommissionAmount;
    // An estimated VAT above the proceeds must not produce a negative amount;
    // `MinorAmount` rejects negatives as a defect.
    const proceedsAfterTaxAmount = Math.max(0, proceedsAmount - taxAmount);

    const fxLookup = yield* input.fxRateService.getUsdRate({ asOf: input.occurredAt, currency });
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
        storefront,
        taxAmount: MinorAmount.make(taxAmount),
        usd,
      }),
    );
  });
