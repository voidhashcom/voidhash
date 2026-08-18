import {
  ProductType,
  SubscriptionDuration,
  type ProductTypeValue,
  type SubscriptionDurationValue,
} from "@voidhash/lib";
import { Brand, DateTime, Option } from "effect";

import {
  PurchaseProcessingMoney,
  PurchaseProcessingMoneyUsd,
} from "../../../domain/purchaseProcessing/PurchaseProcessing.ts";
import type { CurrencyCode, ExchangeRate, MinorAmount } from "../../../domain/shared/Money.ts";

const minor = Brand.nominal<MinorAmount>();
const exchangeRate = Brand.nominal<ExchangeRate>();
const currency = Brand.nominal<CurrencyCode>();

export const DEVELOPMENT_PRICES = {
  annual: 4_999,
  consumable: 499,
  monthly: 999,
  oneTime: 1_999,
  quarterly: 2_499,
  semiAnnual: 3_999,
  weekly: 499,
};

export interface DevelopmentPrice {
  readonly amount: number;
  readonly currencyCode: "USD";
  readonly duration: "weekly" | "monthly" | "quarterly" | "semi-annual" | "annual" | null;
  readonly period: "week" | "month" | "year" | "lifetime";
  readonly periodCount: number;
  readonly warning: string | null;
}

const durationPrice = (
  duration: SubscriptionDurationValue | null,
): Omit<DevelopmentPrice, "currencyCode"> => {
  switch (duration) {
    case SubscriptionDuration.Weekly:
      return {
        amount: DEVELOPMENT_PRICES.weekly,
        duration: "weekly",
        period: "week",
        periodCount: 1,
        warning: null,
      };
    case SubscriptionDuration.Quarterly:
      return {
        amount: DEVELOPMENT_PRICES.quarterly,
        duration: "quarterly",
        period: "month",
        periodCount: 3,
        warning: null,
      };
    case SubscriptionDuration.SemiAnnual:
      return {
        amount: DEVELOPMENT_PRICES.semiAnnual,
        duration: "semi-annual",
        period: "month",
        periodCount: 6,
        warning: null,
      };
    case SubscriptionDuration.Annual:
      return {
        amount: DEVELOPMENT_PRICES.annual,
        duration: "annual",
        period: "year",
        periodCount: 1,
        warning: null,
      };
    case SubscriptionDuration.Monthly:
      return {
        amount: DEVELOPMENT_PRICES.monthly,
        duration: "monthly",
        period: "month",
        periodCount: 1,
        warning: null,
      };
    case null:
      return {
        amount: DEVELOPMENT_PRICES.monthly,
        duration: "monthly",
        period: "month",
        periodCount: 1,
        warning: "This legacy subscription has no duration and is simulated as monthly.",
      };
  }
};

/** Returns the deterministic development price and billing period for a product. */
export const getDevelopmentPrice = (
  type: ProductTypeValue,
  duration: SubscriptionDurationValue | null,
): DevelopmentPrice => {
  if (type === ProductType.Subscription) {
    return { ...durationPrice(duration), currencyCode: "USD" };
  }
  let amount = DEVELOPMENT_PRICES.oneTime;
  if (type === ProductType.OneTimeConsumable) {
    amount = DEVELOPMENT_PRICES.consumable;
  }
  return {
    amount,
    currencyCode: "USD",
    duration: null,
    period: "lifetime",
    periodCount: 1,
    warning: null,
  };
};

/** Builds a zero-fee USD money breakdown for a development transaction. */
export const makeDevelopmentMoney = (amount: number): PurchaseProcessingMoney => {
  const brandedAmount = minor(amount);
  const zero = minor(0);
  const usd = new PurchaseProcessingMoneyUsd({
    exchangeRate: exchangeRate(1_000_000),
    grossAmount: brandedAmount,
    proceedsAfterTaxAmount: brandedAmount,
    proceedsAmount: brandedAmount,
    storeCommissionAmount: zero,
    taxAmount: zero,
  });
  return new PurchaseProcessingMoney({
    currency: currency("USD"),
    grossAmount: brandedAmount,
    proceedsAfterTaxAmount: brandedAmount,
    proceedsAmount: brandedAmount,
    storefront: Option.some("USA"),
    storeCommissionAmount: zero,
    taxAmount: zero,
    usd: Option.some(usd),
  });
};

/** Advances a date by the product's development billing period. */
export const addDevelopmentBillingPeriod = (date: Date, price: DevelopmentPrice): Date => {
  const dateTime = DateTime.fromDateUnsafe(date);
  if (price.period === "week") {
    return DateTime.toDateUtc(DateTime.add(dateTime, { weeks: price.periodCount }));
  }
  if (price.period === "month") {
    return DateTime.toDateUtc(DateTime.add(dateTime, { months: price.periodCount }));
  }
  if (price.period === "year") {
    return DateTime.toDateUtc(DateTime.add(dateTime, { years: price.periodCount }));
  }
  return DateTime.toDateUtc(dateTime);
};
