import * as Context from "effect/Context";
import * as Schema from "effect/Schema";
import type * as Effect from "effect/Effect";

import type { PurchasePortError } from "./PurchasePortError.ts";

const Id = Schema.NonEmptyString;
const NullableDate = Schema.NullOr(Schema.Date);
type StoredNull = typeof Schema.Null.Type;

/** Product mapping data needed by provider-neutral purchase processing. */
export const PurchaseProductContext = Schema.Struct({
  id: Id,
  paymentProviderConfigurationId: Id,
  productId: Id,
  productProjectId: Id,
  productSlug: Schema.NullOr(Schema.String),
  providerProductKey: Id,
});

/** Person identity data needed by purchase processing and event mapping. */
export const PurchasePersonContext = Schema.Struct({
  id: Id,
  primaryDistinctId: Schema.NullOr(Schema.String),
  projectId: Id,
});

/** Persistence-neutral transaction projection. */
export const PurchaseTransactionRecord = Schema.Struct({
  id: Id,
  personId: Id,
  amount: Schema.Int,
  amountUsd: Schema.NullOr(Schema.Int),
  currency: Schema.String,
  exchangeRate: Schema.NullOr(Schema.Int),
  grossAmount: Schema.Int,
  grossAmountUsd: Schema.NullOr(Schema.Int),
  lastEventOccurredAt: NullableDate,
  occurredAt: Schema.Date,
  paymentProviderConfigurationProductId: Id,
  proceedsAfterTaxAmount: Schema.Int,
  proceedsAfterTaxAmountUsd: Schema.NullOr(Schema.Int),
  proceedsAmount: Schema.Int,
  proceedsAmountUsd: Schema.NullOr(Schema.Int),
  providerEnvironment: Schema.Int,
  refundedAt: NullableDate,
  refundReason: Schema.NullOr(Schema.String),
  revokedAt: NullableDate,
  revocationReason: Schema.NullOr(Schema.String),
  storeCommissionAmount: Schema.Int,
  storeCommissionAmountUsd: Schema.NullOr(Schema.Int),
  storeTransactionId: Schema.NullOr(Schema.String),
  storefront: Schema.NullOr(Schema.String),
  taxAmount: Schema.Int,
  taxAmountUsd: Schema.NullOr(Schema.Int),
});

/** Persistence-neutral subscription projection. */
const PurchaseSubscriptionRecordValue = Schema.Struct({
  billingRetryAt: NullableDate,
  isCancelAtPeriodEnd: Schema.Boolean,
  canceledAt: NullableDate,
  cancellationReason: Schema.NullOr(Schema.String),
  expiresAt: NullableDate,
  extendedTo: NullableDate,
  gracePeriodExpiresAt: NullableDate,
  id: Id,
  initialTransactionId: Id,
  isTrial: Schema.Boolean,
  lastEventOccurredAt: NullableDate,
  latestTransactionId: Id,
  paymentProviderConfigurationProductId: Id,
  pendingPriceAmount: Schema.NullOr(Schema.Int),
  pendingPriceCurrency: Schema.NullOr(Schema.String),
  pendingPriceEffectiveAt: NullableDate,
  pendingProductChangeId: Schema.NullOr(Schema.String),
  personId: Id,
  providerEnvironment: Schema.Int,
  purchasedAt: Schema.Date,
  redeemedOfferAt: NullableDate,
  redeemedOfferId: Schema.NullOr(Schema.String),
  startsAt: Schema.Date,
  status: Schema.Int,
  storeSubscriptionId: Id,
});
export const PurchaseSubscriptionRecord = PurchaseSubscriptionRecordValue.pipe(
  Schema.encodeKeys({ isCancelAtPeriodEnd: "cancelAtPeriodEnd" }),
);

/** Persistence-neutral one-time purchase projection. */
export const PurchaseRecord = Schema.Struct({
  id: Id,
  lastEventOccurredAt: NullableDate,
  paymentProviderConfigurationProductId: Id,
  personId: Id,
  providerEnvironment: Schema.Int,
  providerKey: Id,
  refundedAt: NullableDate,
  refundReason: Schema.NullOr(Schema.String),
  revokedAt: NullableDate,
  revocationReason: Schema.NullOr(Schema.String),
  type: Schema.Int,
});

export type PurchaseProductContext = typeof PurchaseProductContext.Type;
export type PurchasePersonContext = typeof PurchasePersonContext.Type;
export type PurchaseTransactionRecord = typeof PurchaseTransactionRecord.Type;
export type PurchaseSubscriptionRecord = typeof PurchaseSubscriptionRecord.Type;
export type PurchaseRecord = typeof PurchaseRecord.Type;

export interface PurchaseRepositoryUpdateResult {
  readonly affectedRows: number;
}

export interface PurchaseTransactionInsert extends Omit<
  PurchaseTransactionRecord,
  "refundedAt" | "refundReason" | "revokedAt" | "revocationReason" | "storeTransactionId"
> {
  readonly refundedAt?: Date | StoredNull;
  readonly refundReason?: string | StoredNull;
  readonly revokedAt?: Date | StoredNull;
  readonly revocationReason?: string | StoredNull;
  readonly storeTransactionId: string;
}

export interface PurchaseSubscriptionInsert extends PurchaseSubscriptionRecord {}
export interface PurchaseInsert extends PurchaseRecord {}

export type PurchaseSubscriptionUpdate = Partial<
  Omit<PurchaseSubscriptionRecord, "id" | "lastEventOccurredAt">
> & { readonly id: string; readonly occurredAt: Date };

export type PurchaseTransactionUpdate = Partial<
  Omit<PurchaseTransactionRecord, "id" | "lastEventOccurredAt">
> & { readonly id: string; readonly occurredAt: Date };

export type PurchaseUpdate = Partial<Omit<PurchaseRecord, "id" | "lastEventOccurredAt">> & {
  readonly id: string;
  readonly occurredAt: Date;
};

export interface PurchaseStateRepositoryShape {
  readonly resolveConfigurationProduct: (
    id: string,
  ) => Effect.Effect<PurchaseProductContext | typeof Schema.Undefined.Type, PurchasePortError>;
  readonly findPerson: (
    id: string,
  ) => Effect.Effect<PurchasePersonContext | typeof Schema.Undefined.Type, PurchasePortError>;
  readonly resolveDistinctId: (personId: string) => Effect.Effect<string, PurchasePortError>;
  readonly findPublicApiToken: (
    projectId: string,
  ) => Effect.Effect<string | typeof Schema.Undefined.Type, PurchasePortError>;
  readonly findTransactionByProviderTransactionId: (input: {
    readonly paymentProviderConfigurationProductId: string;
    readonly storeTransactionId: string;
  }) => Effect.Effect<PurchaseTransactionRecord | typeof Schema.Undefined.Type, PurchasePortError>;
  readonly insertTransactionIfAbsent: (
    input: PurchaseTransactionInsert,
  ) => Effect.Effect<
    { readonly inserted: boolean; readonly row: PurchaseTransactionRecord },
    PurchasePortError
  >;
  readonly findSubscriptionByStoreSubscriptionId: (input: {
    readonly paymentProviderConfigurationProductId: string;
    readonly storeSubscriptionId: string;
  }) => Effect.Effect<PurchaseSubscriptionRecord | typeof Schema.Undefined.Type, PurchasePortError>;
  readonly findSubscriptionForRenewal: (input: {
    readonly paymentProviderConfigurationProductId: string;
    readonly storeSubscriptionId: string;
  }) => Effect.Effect<PurchaseSubscriptionRecord | typeof Schema.Undefined.Type, PurchasePortError>;
  readonly insertSubscriptionIfAbsent: (
    input: PurchaseSubscriptionInsert,
  ) => Effect.Effect<
    { readonly inserted: boolean; readonly row: PurchaseSubscriptionRecord },
    PurchasePortError
  >;
  readonly updateSubscriptionIfFresher: (
    input: PurchaseSubscriptionUpdate,
  ) => Effect.Effect<PurchaseRepositoryUpdateResult, PurchasePortError>;
  readonly findPurchaseByProviderKey: (input: {
    readonly paymentProviderConfigurationProductId: string;
    readonly providerKey: string;
  }) => Effect.Effect<PurchaseRecord | typeof Schema.Undefined.Type, PurchasePortError>;
  readonly insertPurchaseIfAbsent: (
    input: PurchaseInsert,
  ) => Effect.Effect<
    { readonly inserted: boolean; readonly row: PurchaseRecord },
    PurchasePortError
  >;
  readonly updateTransactionIfFresher: (
    input: PurchaseTransactionUpdate,
  ) => Effect.Effect<PurchaseRepositoryUpdateResult, PurchasePortError>;
  readonly updatePurchaseIfFresher: (
    input: PurchaseUpdate,
  ) => Effect.Effect<PurchaseRepositoryUpdateResult, PurchasePortError>;
  readonly lockSubscriptionForUpdate: (
    id: string,
  ) => Effect.Effect<PurchaseSubscriptionRecord | typeof Schema.Undefined.Type, PurchasePortError>;
  readonly lockPurchaseForUpdate: (
    id: string,
  ) => Effect.Effect<PurchaseRecord | typeof Schema.Undefined.Type, PurchasePortError>;
  readonly countActiveSubscriptions: (personId: string) => Effect.Effect<number, PurchasePortError>;
  readonly countActivePurchases: (personId: string) => Effect.Effect<number, PurchasePortError>;
}

/** Transaction-bound persistence used by the purchase state machine. */
export class PurchaseStateRepository extends Context.Service<
  PurchaseStateRepository,
  PurchaseStateRepositoryShape
>()("@voidhash/core-v2/purchases/PurchaseStateRepository") {}
