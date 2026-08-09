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
 * The same module owns the FX conversion to USD via {@link FxRateService}.
 * Inputs that are missing on the JWS (no price, no currency) yield
 * `Option.none()` so downstream layers can leave money fields blank rather
 * than emit zeros.
 */
import {
  InAppOwnershipType,
  type JWSTransactionDecodedPayload,
  Type as AppleTransactionType,
} from "@voidhash/app-store-server-sdk";
import { getStorefrontVatRateBps, parseISO4217CurrencyCode } from "@voidhash/lib/constants";
import { pick } from "@voidhash/lib/lang";
import { DateTime, Effect, Option } from "effect";

import {
  PurchaseProcessingMoney,
  PurchaseProcessingMoneyUsd,
} from "../../../domain/purchaseProcessing/PurchaseProcessing.ts";
import { CurrencyCode, ExchangeRate, MinorAmount } from "../../../domain/shared/Money.ts";
import type { DbError } from "@voidhash/db";

import { FX_RATE_PRECISION, type FxRateLookup } from "../../../domain/fxRate/FxRate.ts";
import type { FxRateServiceError } from "../../fxRates/FxRateService.ts";

/** Apple's `price` field on a decoded JWS is in milliunits (10× minor units). */
const APPLE_PRICE_DENOMINATOR = 10;

/** Apple's `revocationPercentage` is in milliunits (100% = 100_000). */
const APPLE_REVOCATION_FULL = 100_000;

/** Commission rates in basis points. */
const APPLE_COMMISSION_STANDARD_BPS = 3_000; // 30.00%
const APPLE_COMMISSION_REDUCED_BPS = 1_500; // 15.00%

/** One Gregorian year in milliseconds (365.25 days). Used for the year-2+ rule. */
const ONE_YEAR_MS = Math.round(365.25 * 24 * 60 * 60 * 1_000);

/**
 * Subset of the App Store global configuration needed to compute the
 * commission rate. Defined structurally so this module doesn't pull in the
 * full payment-provider configuration shape (the broader type lives in
 * `payment-provider.ts` and is internal there).
 */
export interface AppleCommissionConfiguration {
  readonly appleSmallBusinessProgramStartDate?: string;
  readonly appleSmallBusinessProgramHasEndDate: boolean;
  readonly appleSmallBusinessProgramEndDate?: string;
}

/** Parses an operator-supplied date string, returning `undefined` when unparseable. */
const parseConfiguredDate = (value: string): Date | undefined => {
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
  if (!config.appleSmallBusinessProgramHasEndDate) return true;
  const endStr = config.appleSmallBusinessProgramEndDate;
  if (!endStr) return true;
  const end = parseConfiguredDate(endStr);
  if (!end) return true;
  return at <= end;
};

const isYearTwoOrLaterAutoRenewable = (decoded: JWSTransactionDecodedPayload): boolean => {
  const type = Option.getOrUndefined(decoded.type);
  if (type !== AppleTransactionType.AUTO_RENEWABLE_SUBSCRIPTION) return false;
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
  readonly decoded: JWSTransactionDecodedPayload;
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
  const rateBps = getStorefrontVatRateBps(Option.getOrUndefined(input.storefront));
  if (rateBps <= 0) return 0;
  // tax = gross × rate / (1 + rate); rate is `rateBps / 10_000` so
  // tax = gross × rateBps / (10_000 + rateBps).
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
 * Subset of `FxRateService` that {@link buildAppStoreMoney} needs. Defined
 * structurally so callers can pass the already-resolved instance — avoids
 * leaking the `FxRateService` requirement into every method that calls this
 * helper.
 */
export interface FxRateLookupShape {
  readonly getUsdRate: (input: {
    readonly currency: string;
    readonly asOf: Date;
  }) => Effect.Effect<Option.Option<FxRateLookup>, FxRateServiceError | DbError>;
}

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
  readonly decoded: JWSTransactionDecodedPayload;
  readonly globalConfiguration: AppleCommissionConfiguration;
  readonly occurredAt: Date;
  readonly fxRateService: FxRateLookupShape;
}) =>
  Effect.gen(function* () {
    const fxRateService = input.fxRateService;

    const priceOp = input.decoded.price;
    const currencyRawOp = input.decoded.currency;
    if (Option.isNone(priceOp) || Option.isNone(currencyRawOp)) {
      return Option.none<PurchaseProcessingMoney>();
    }
    const currencyOp = yield* parseISO4217CurrencyCode(currencyRawOp.value).pipe(
      Effect.map(Option.some),
      Effect.catchTag("InvalidISO4217CurrencyCodeError", () =>
        Effect.succeed(Option.none<string>()),
      ),
    );
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
    // proceeds are zero. The `family_revoke` analytics path is the only
    // negative delta we ever emit for this kind of transaction.
    const isFamilyShared =
      Option.getOrUndefined(input.decoded.inAppOwnershipType) === InAppOwnershipType.FAMILY_SHARED;
    const storeCommissionAmount = pick(
      isFamilyShared,
      0,
      Math.round((grossAmount * commissionBps) / 10_000),
    );
    const taxAmount = estimateAppleTaxAmount({ grossAmount, storefront });
    const proceedsAmount = grossAmount - storeCommissionAmount;
    const proceedsAfterTaxAmount = proceedsAmount - taxAmount;

    const fxLookup = yield* fxRateService.getUsdRate({ asOf: input.occurredAt, currency });
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
