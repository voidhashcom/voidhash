import * as Arr from "effect/Array";
import * as R from "effect/Record";
import { PurchaseType } from "@voidhash/lib";
import { pick } from "@voidhash/lib/lang";
import * as Brand from "effect/Brand";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import type * as Schema from "effect/Schema";

import {
  PurchaseActionContext,
  TransferPurchaseInput,
  TransferSubscriptionInput,
} from "../../domain/PurchaseAction.ts";
import type { CurrencyCode, ExchangeRate, MinorAmount } from "../../domain/Money.ts";
import {
  PurchaseProcessingMoney,
  PurchaseProcessingMoneyUsd,
  type PurchaseProcessingResult,
} from "../../domain/PurchaseProcessing.ts";

/** Money columns required to reconstruct a transaction's domain value. */
type StoredNull = typeof Schema.Null.Type;

export interface StoredTransactionMoneyFields {
  readonly currency: string | StoredNull;
  readonly storefront: string | StoredNull;
  readonly grossAmount: number;
  readonly storeCommissionAmount: number;
  readonly taxAmount: number;
  readonly proceedsAmount: number;
  readonly proceedsAfterTaxAmount: number;
  readonly grossAmountUsd: number | StoredNull;
  readonly storeCommissionAmountUsd: number | StoredNull;
  readonly taxAmountUsd: number | StoredNull;
  readonly proceedsAmountUsd: number | StoredNull;
  readonly proceedsAfterTaxAmountUsd: number | StoredNull;
  readonly exchangeRate: number | StoredNull;
}

const minor = Brand.nominal<typeof MinorAmount.Type>();
const usdRate = Brand.nominal<typeof ExchangeRate.Type>();
const currency = Brand.nominal<typeof CurrencyCode.Type>();

/** Maps a normalized purchase variant to the persisted numeric purchase type. */
export const purchaseTypeFor = (variant: "one-time" | "consumable") =>
  pick(variant === "consumable", PurchaseType.OneTimeConsumable, PurchaseType.OneTime);

/** Reconstructs a complete USD mirror, treating partial stored mirrors as absent. */
export const usdFromStoredTransaction = (
  row: StoredTransactionMoneyFields,
): Option.Option<PurchaseProcessingMoneyUsd> => {
  if (
    row.exchangeRate === null ||
    row.grossAmountUsd === null ||
    row.storeCommissionAmountUsd === null ||
    row.taxAmountUsd === null ||
    row.proceedsAmountUsd === null ||
    row.proceedsAfterTaxAmountUsd === null
  ) {
    return Option.none();
  }
  return Option.some(
    new PurchaseProcessingMoneyUsd({
      exchangeRate: usdRate(row.exchangeRate),
      grossAmount: minor(row.grossAmountUsd),
      proceedsAfterTaxAmount: minor(row.proceedsAfterTaxAmountUsd),
      proceedsAmount: minor(row.proceedsAmountUsd),
      storeCommissionAmount: minor(row.storeCommissionAmountUsd),
      taxAmount: minor(row.taxAmountUsd),
    }),
  );
};

/**
 * Reconstructs normalized money from a persisted transaction row. Absent when
 * the row was observed without a money breakdown (`currency` is `null`), so
 * downstream events carry no amounts instead of a fabricated zero.
 */
export const moneyFromStoredTransaction = (
  row: StoredTransactionMoneyFields,
): Option.Option<PurchaseProcessingMoney> => {
  if (row.currency === null) return Option.none();
  return Option.some(
    new PurchaseProcessingMoney({
      currency: currency(row.currency),
      grossAmount: minor(row.grossAmount),
      proceedsAfterTaxAmount: minor(row.proceedsAfterTaxAmount),
      proceedsAmount: minor(row.proceedsAmount),
      storeCommissionAmount: minor(row.storeCommissionAmount),
      storefront: Option.fromNullishOr(row.storefront),
      taxAmount: minor(row.taxAmount),
      usd: usdFromStoredTransaction(row),
    }),
  );
};

/** Persisted money columns for a normalized money value; absent money stores zeros and a null currency. */
export const storedMoneyColumns = (money: Option.Option<PurchaseProcessingMoney>) => {
  const value = Option.getOrUndefined(money);
  const usd = Option.getOrUndefined(Option.flatMap(money, (some) => some.usd));
  return {
    amount: value?.grossAmount ?? 0,
    amountUsd: usd?.grossAmount ?? null,
    currency: value?.currency ?? null,
    exchangeRate: usd?.exchangeRate ?? null,
    grossAmount: value?.grossAmount ?? 0,
    grossAmountUsd: usd?.grossAmount ?? null,
    proceedsAfterTaxAmount: value?.proceedsAfterTaxAmount ?? 0,
    proceedsAfterTaxAmountUsd: usd?.proceedsAfterTaxAmount ?? null,
    proceedsAmount: value?.proceedsAmount ?? 0,
    proceedsAmountUsd: usd?.proceedsAmount ?? null,
    storeCommissionAmount: value?.storeCommissionAmount ?? 0,
    storeCommissionAmountUsd: usd?.storeCommissionAmount ?? null,
    storefront: Option.getOrNull(Option.flatMap(money, (some) => some.storefront)),
    taxAmount: value?.taxAmount ?? 0,
    taxAmountUsd: usd?.taxAmount ?? null,
  };
};

/** Unwraps nested infrastructure errors to their most specific available cause. */
export const describePurchaseErrorCause = (error: unknown): string => {
  const describe = (current: unknown, depth: number): string => {
    if (depth === 4 || !P.hasProperty(current, "cause") || current.cause == null) {
      return String(current);
    }
    return describe(current.cause, depth + 1);
  };
  return describe(error, 0);
};

/** Classifies a purchase result without changing its domain-level ignored predicate. */
export const purchaseProcessingResultKind = (result: PurchaseProcessingResult) => {
  if (result.idempotent) return "idempotent";
  if (
    Arr.isReadonlyArrayEmpty(result.analyticsEventIds) &&
    Option.isNone(result.purchaseId) &&
    Option.isNone(result.subscriptionId) &&
    Option.isNone(result.transactionId)
  ) {
    return "ignored";
  }
  return "applied";
};

const compactSpanAttributes = (attributes: Record<string, unknown>) =>
  R.fromEntries(R.toEntries(attributes).filter(([, value]) => value !== undefined));

const optionSpanAttribute = <A>(
  value: Option.Option<A>,
  map: (value: A) => unknown = (some) => some,
): unknown => Option.match(value, { onNone: () => undefined, onSome: (some) => map(some) });

/** Builds stable tracing attributes for a normalized purchase action. */
export const purchaseActionSpanAttributes = (input: typeof PurchaseActionContext.Type) =>
  compactSpanAttributes({
    "purchase.idempotency_key": input.idempotencyKey,
    "purchase.payment_provider_configuration_id": input.paymentProviderConfigurationId,
    "purchase.person_id": input.personId,
    "purchase.project_id": input.projectId,
    "purchase.provider_event_type": input.providerEventType,
    "purchase.provider_subscription_id": optionSpanAttribute(input.providerSubscriptionId),
    "purchase.provider_transaction_id": optionSpanAttribute(input.providerTransactionId),
    "purchase.source": input.source,
    "voidhash.organization.id": input.organizationId,
    "voidhash.payment_provider.configuration_id": input.paymentProviderConfigurationId,
    "voidhash.payment_provider.id": input.providerId,
    "voidhash.person.id": input.personId,
    "voidhash.project.id": input.projectId,
    "voidhash.purchase.event_type": input.providerEventType,
    "voidhash.purchase.idempotency_key": input.idempotencyKey,
    "voidhash.purchase.source": input.source,
    "voidhash.subscription.provider_subscription_id": optionSpanAttribute(
      input.providerSubscriptionId,
    ),
    "voidhash.transaction.provider_transaction_id": optionSpanAttribute(
      input.providerTransactionId,
    ),
  });

/** Builds stable tracing attributes for a purchase-processing result. */
export const purchaseProcessingResultSpanAttributes = (result: PurchaseProcessingResult) =>
  compactSpanAttributes({
    "purchase.purchase_id": optionSpanAttribute(result.purchaseId),
    "purchase.result": purchaseProcessingResultKind(result),
    "purchase.subscription_id": optionSpanAttribute(result.subscriptionId),
    "purchase.transaction_id": optionSpanAttribute(result.transactionId),
    "voidhash.person.id": result.personId,
    "voidhash.purchase.id": optionSpanAttribute(result.purchaseId),
    "voidhash.subscription.id": optionSpanAttribute(result.subscriptionId),
    "voidhash.transaction.id": optionSpanAttribute(result.transactionId),
  });

/** Builds stable tracing attributes for a purchase or subscription transfer. */
export const transferSpanAttributes = (
  input: typeof TransferSubscriptionInput.Type | typeof TransferPurchaseInput.Type,
) => {
  let resourceId: string;
  if ("purchaseId" in input) resourceId = input.purchaseId;
  else resourceId = input.subscriptionId;
  return compactSpanAttributes({
    "purchase.payment_provider_configuration_id": input.paymentProviderConfigurationId,
    "purchase.project_id": input.projectId,
    "purchase.source": input.source,
    "purchase.transfer.from_person_id": input.fromPersonId,
    "purchase.transfer.mode": input.transferMode,
    "purchase.transfer.resource_id": resourceId,
    "purchase.transfer.to_person_id": input.toPersonId,
    "voidhash.organization.id": input.organizationId,
    "voidhash.payment_provider.configuration_id": input.paymentProviderConfigurationId,
    "voidhash.payment_provider.id": input.providerId,
    "voidhash.person.from_id": input.fromPersonId,
    "voidhash.person.to_id": input.toPersonId,
    "voidhash.project.id": input.projectId,
    "voidhash.purchase.source": input.source,
    "voidhash.transfer.mode": input.transferMode,
    "voidhash.transfer.resource_id": resourceId,
  });
};

/** Returns the provider-owned resource identifier used by a transfer action. */
export const transferResourceId = (
  input: typeof TransferSubscriptionInput.Type | typeof TransferPurchaseInput.Type,
) => {
  if ("purchaseId" in input) return input.purchaseId;
  return input.subscriptionId;
};
