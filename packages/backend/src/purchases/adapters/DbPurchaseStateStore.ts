/**
 * `PurchaseProcessingService` owns provider-neutral purchase state mutation.
 * Each public method corresponds to one normalized purchase action — provider
 * services (App Store, Play Store, Stripe) call the method that matches the
 * provider event they just normalized, passing already-resolved identifiers.
 *
 * The service maps the provider product, performs idempotent transaction /
 * subscription / purchase writes inside `Db.transaction`, syncs unlocked perks
 * via {@link PerkGrantService}, and stages revenue analytics events into the
 * `purchase_ledger` table — the purchase ledger worker drains the
 * ledger and sends each row's payload through the configured analytics delivery service.
 *
 * Provider identifiers that may be absent (`providerTransactionId`,
 * `providerSubscriptionId`, `providerWebhookNotificationId`,
 * `rawProviderPayload`, `money`) are typed as `Option.Option<T>` so callers
 * must make the present-vs-absent decision explicitly at the boundary.
 */

import { PurchaseType, SubscriptionStatus } from "@voidhash/lib";
import { constant, pick } from "@voidhash/lib/lang";
import { Brand, Cause, Context, DateTime, Effect, Layer, Option, Predicate, Schema } from "effect";

import {
  InternalAnalyticsEventSchema,
  PurchaseProcessingProductNotMappedError as CoreV2ProductNotMappedError,
  PurchaseProcessingServiceError as CoreV2ProcessingError,
  PurchaseProcessor,
  PurchaseStateStore,
  type PurchaseStateStoreShape,
} from "@voidhash/core-v2";
import type { PaymentProviderId, SubscriptionTransferMode } from "@voidhash/core-v2";
import {
  type PurchaseEventSource,
  PurchaseProcessingMoney,
  PurchaseProcessingMoneyUsd,
  PurchaseProcessingResult,
} from "@voidhash/core-v2";
import type { CurrencyCode, ExchangeRate, MinorAmount } from "@voidhash/core-v2";
import {
  type InsertPurchase,
  type InsertSubscription,
  type InsertTransaction,
  type ProviderEnvironmentValue,
  type Subscription as DbSubscription,
  Db,
  type DbTransaction,
  and,
  eq,
  isNull,
  lte,
  or,
  purchaseLedger,
  purchases,
  sql,
  subscriptions,
  transactions,
} from "@voidhash/db";
import { generateId } from "@voidhash/core/utils/generate-id";
import { PerkGrantService } from "@voidhash/core/services/perkGrants/PerkGrantService";
import { WebhookEventPublisher } from "@voidhash/core/services/webhookDispatch/WebhookEventPublisher";
import { WebhookDispatchService } from "@voidhash/core/services/webhookDispatch/WebhookDispatchService";
import {
  decodePurchaseProcessingResult,
  encodePurchaseProcessingResult,
  subscriptionStatusForInactiveEvent,
} from "@voidhash/core-v2";
import {
  type RevenueAnalyticsMapperContext,
  toAutoRenewResumedAnalyticsInputs,
  toBillingRetryAnalyticsInputs,
  toCanceledAnalyticsInputs,
  toExpiredAnalyticsInputs,
  toExtendedAnalyticsInputs,
  toOfferRedeemedAnalyticsInputs,
  toOneTimePurchaseAnalyticsInputs,
  toPriceIncreaseAnalyticsInputs,
  toPurchaseRevokedAnalyticsInputs,
  toPurchaseTransferredAnalyticsInputs,
  toRefundReversedAnalyticsInputs,
  toRefundedAnalyticsInputs,
  toRenewalPreferenceChangeAnalyticsInputs,
  toRenewedAnalyticsInputs,
  toRevokedAnalyticsInputs,
  toStartedAnalyticsInputs,
  toSubscriptionTransferredAnalyticsInputs,
} from "@voidhash/core-v2";
import {
  type WebhookEventMapperContext,
  type WebhookLifecycleEvent,
  toPurchaseCompletedWebhookEvent,
  toPurchaseRefundedWebhookEvent,
  toSubscriptionCancelledWebhookEvent,
  toSubscriptionCreatedWebhookEvent,
  toSubscriptionExpiredWebhookEvent,
  toSubscriptionRenewedWebhookEvent,
} from "@voidhash/core-v2";

/**
 * Deferred webhook payload construction. The mappers throw on invalid input,
 * so the transaction only decides *whether* to emit and captures the raw
 * inputs; the payload itself is built after the commit.
 */
type WebhookEventBuilder = () => WebhookLifecycleEvent;

/** Shared empty emission list, so early transaction returns stay well-typed. */
const NO_WEBHOOK_EVENTS: readonly (WebhookEventBuilder | null)[] = [];

export class PurchaseProcessingServiceError extends Schema.TaggedErrorClass<PurchaseProcessingServiceError>(
  "PurchaseProcessingServiceError",
)("PurchaseProcessingServiceError", { cause: Schema.String }) {}

export class PurchaseProcessingProductNotMappedError extends Schema.TaggedErrorClass<PurchaseProcessingProductNotMappedError>(
  "PurchaseProcessingProductNotMappedError",
)("PurchaseProcessingProductNotMappedError", {
  paymentProviderConfigurationId: Schema.String,
  paymentProviderConfigurationProductId: Schema.String,
}) {}

/**
 * Fields every per-action method receives. Provider services pre-resolve
 * `personId`, configuration ids, and provider identifiers before invoking the
 * matching `PurchaseProcessingService` method.
 *
 * Identifier vocabulary:
 * - `providerTransactionId` — per-charge payment id (Apple's `transactionId`,
 *   Stripe's `payment_intent.id`). Stable across sources for the same payment.
 * - `providerSubscriptionId` — subscription series id (Apple's
 *   `originalTransactionId`, Stripe's `subscription.id`). Stable across every
 *   renewal/refund within the series; absent for non-subscription charges.
 * - `providerWebhookNotificationId` — provider-issued webhook delivery id,
 *   diagnostic only; deduplication of inbound events happens upstream of this
 *   service (e.g. the App Store payment provider's processed-event ledger).
 *
 * Identifiers that the provider may not surface for every event are modelled
 * as `Option` so the absent case is impossible to miss at the call site.
 */
export interface PurchaseActionContext {
  readonly providerId: typeof PaymentProviderId.Type;
  readonly source: typeof PurchaseEventSource.Type;
  readonly projectId: string;
  readonly organizationId: string;
  readonly paymentProviderConfigurationId: string;
  readonly paymentProviderConfigurationProductId: string;
  readonly personId: string;
  readonly providerEnvironment: ProviderEnvironmentValue;
  readonly providerEventType: string;
  readonly providerTransactionId: Option.Option<string>;
  readonly providerSubscriptionId: Option.Option<string>;
  readonly providerWebhookNotificationId: Option.Option<string>;
  readonly occurredAt: Date;
  readonly receivedAt: Date;
  readonly rawProviderPayload: Option.Option<unknown>;
  /**
   * Per-event idempotency key derived by the payment-provider boundary from
   * the underlying provider payload. Required — derivation failure is
   * propagated as a provider error before this service runs, never silently
   * swapped for a synthetic key. The outbox UNIQUE on this column is the
   * service-level cross-source dedup gate.
   */
  readonly idempotencyKey: string;
}

type PurchaseLedgerReservationInput = Pick<
  PurchaseActionContext,
  | "idempotencyKey"
  | "organizationId"
  | "personId"
  | "projectId"
  | "providerEventType"
  | "providerId"
  | "rawProviderPayload"
  | "source"
>;

interface PurchaseLedgerReservation {
  readonly id: string;
}

export interface StartSubscriptionInput extends PurchaseActionContext {
  readonly money: Option.Option<PurchaseProcessingMoney>;
  readonly startsAt: Date;
  readonly expiresAt: Option.Option<Date>;
  readonly purchasedAt: Date;
  readonly isTrial: boolean;
}

export interface RenewSubscriptionInput extends PurchaseActionContext {
  readonly money: Option.Option<PurchaseProcessingMoney>;
  readonly startsAt: Date;
  readonly expiresAt: Option.Option<Date>;
  readonly renewedAt: Date;
  readonly isTrial: boolean;
}

export interface CancelSubscriptionInput extends PurchaseActionContext {
  readonly canceledAt: Date;
  readonly cancelAtPeriodEnd: boolean;
  readonly cancellationReason: Option.Option<string>;
}

export interface ExpireSubscriptionInput extends PurchaseActionContext {
  readonly expiredAt: Date;
}

export interface RevokeSubscriptionInput extends PurchaseActionContext {
  readonly revokedAt: Date;
  readonly revocationReason: Option.Option<string>;
}

export interface CompleteOneTimePurchaseInput extends PurchaseActionContext {
  readonly money: Option.Option<PurchaseProcessingMoney>;
  readonly purchasedAt: Date;
  readonly purchaseType: "one-time" | "consumable";
}

export interface RefundPurchaseInput extends PurchaseActionContext {
  readonly refundedAt: Date;
  readonly refundReason: Option.Option<string>;
  /**
   * Present for a PARTIAL refund: carries the newly-refunded delta amounts.
   * The projection rows are left untouched (the entitlement survives a
   * partial refund) — only the ledger/analytics event is emitted, so revenue
   * reporting reflects the delta instead of silently ignoring it.
   */
  readonly partialRefundMoney?: PurchaseProcessingMoney;
}

export interface RevokePurchaseInput extends PurchaseActionContext {
  readonly revokedAt: Date;
  readonly revocationReason: Option.Option<string>;
}

/**
 * Apple's `REFUND_REVERSED` notification: a prior refund has been reversed.
 * The entitlement should be re-granted in the operational projection and an
 * analytics event emitted.
 */
export interface ReverseRefundInput extends PurchaseActionContext {
  readonly reversedAt: Date;
}

/**
 * Apple's `DID_FAIL_TO_RENEW` notification: the subscription entered the
 * billing-retry loop. Subscription stays `Active` during grace; transition to
 * `Canceled` happens on `GRACE_PERIOD_EXPIRED` via the existing
 * `expireSubscription` method. A subsequent `renewSubscription` clears the
 * recorded retry/grace deadlines.
 */
export interface EnterBillingRetryInput extends PurchaseActionContext {
  readonly billingRetryAt: Date;
  readonly gracePeriodExpiresAt: Option.Option<Date>;
}

/**
 * Apple's `RENEWAL_EXTENDED` / `RENEWAL_EXTENSION` notification: the service
 * has extended the subscription period (issued via the App Store extend API
 * or applied automatically).
 */
export interface ExtendSubscriptionInput extends PurchaseActionContext {
  readonly extendedTo: Date;
}

/**
 * Apple's `DID_CHANGE_RENEWAL_PREF` notification: the customer selected a
 * different product for the NEXT billing cycle. We record the intent; the
 * actual `paymentProviderConfigurationProductId` swap happens when
 * `renewSubscription` fires for the new product.
 */
export interface ChangeRenewalPreferenceInput extends PurchaseActionContext {
  readonly newProviderProductKey: string;
  /** Optional resolved id of the new product mapping, when found. */
  readonly newPaymentProviderConfigurationProductId: Option.Option<string>;
}

/** Apple's `OFFER_REDEEMED` notification: an offer code or promotion applied. */
export interface RedeemOfferInput extends PurchaseActionContext {
  readonly offerId: Option.Option<string>;
  readonly redeemedAt: Date;
}

/** Apple's `PRICE_INCREASE` notification: a pending price change is scheduled. */
export interface RecordPriceIncreaseInput extends PurchaseActionContext {
  readonly money: Option.Option<PurchaseProcessingMoney>;
  readonly effectiveAt: Option.Option<Date>;
}

/**
 * Apple's `DID_CHANGE_RENEWAL_STATUS` subtype `AUTO_RENEW_ENABLED`: the
 * customer un-canceled. Clears `cancelAtPeriodEnd` / `canceledAt`.
 */
export interface ResumeAutoRenewInput extends PurchaseActionContext {
  readonly resumedAt: Date;
}

/**
 * Annotates what triggered a transfer; recorded on the emitted analytics
 * events' `transferReason`. `appstore_restore` is the production trigger;
 * `manual` is reserved for a future admin / support tool.
 */
export type SubscriptionTransferTriggerReason = "appstore_restore" | "manual";

/**
 * Input for {@link PurchaseProcessingService.transferSubscription}.
 *
 * Unlike the per-action `record*` methods this involves two persons, and the
 * resolved {@link SubscriptionTransferMode} is passed in already decided by
 * the provider boundary — `PurchaseProcessingService` stays provider-neutral
 * and never reads provider configuration. `fromPersonId` / `toPersonId` are
 * both fully intact identified persons; a transfer is NOT an identity merge.
 */
export interface TransferSubscriptionInput {
  readonly subscriptionId: string;
  readonly fromPersonId: string;
  readonly toPersonId: string;
  readonly transferMode: typeof SubscriptionTransferMode.Type;
  readonly providerId: typeof PaymentProviderId.Type;
  readonly paymentProviderConfigurationId: string;
  readonly projectId: string;
  readonly organizationId: string;
  readonly occurredAt: Date;
  readonly source: typeof PurchaseEventSource.Type;
  readonly triggerReason: SubscriptionTransferTriggerReason;
}

/**
 * Input for {@link PurchaseProcessingService.transferPurchase} — the
 * non-consumable one-time purchase analogue of {@link TransferSubscriptionInput}.
 */
export interface TransferPurchaseInput {
  readonly purchaseId: string;
  readonly fromPersonId: string;
  readonly toPersonId: string;
  readonly transferMode: typeof SubscriptionTransferMode.Type;
  readonly providerId: typeof PaymentProviderId.Type;
  readonly paymentProviderConfigurationId: string;
  readonly projectId: string;
  readonly organizationId: string;
  readonly occurredAt: Date;
  readonly source: typeof PurchaseEventSource.Type;
  readonly triggerReason: SubscriptionTransferTriggerReason;
}

const purchaseTypeFor = (variant: "one-time" | "consumable") =>
  pick(variant === "consumable", PurchaseType.OneTimeConsumable, PurchaseType.OneTime);

/**
 * Structural shape of the stored money columns on a `transaction` row. Defined
 * locally so the reconstruction helper doesn't depend on the DB row type
 * directly (the db package exports a `Transaction` name that collides with
 * the driver transaction type).
 */
interface StoredTransactionMoneyFields {
  readonly currency: string;
  readonly storefront: string | null;
  readonly grossAmount: number;
  readonly storeCommissionAmount: number;
  readonly taxAmount: number;
  readonly proceedsAmount: number;
  readonly proceedsAfterTaxAmount: number;
  readonly grossAmountUsd: number | null;
  readonly storeCommissionAmountUsd: number | null;
  readonly taxAmountUsd: number | null;
  readonly proceedsAmountUsd: number | null;
  readonly proceedsAfterTaxAmountUsd: number | null;
  readonly exchangeRate: number | null;
}

/**
 * Reconstructs a {@link PurchaseProcessingMoney} from the stored breakdown on
 * a transaction row. Used by refund / reverse-refund / revoke paths to
 * recover the original purchase amounts — these events don't carry money on
 * their inbound payload (Apple mutates the existing transaction in-place
 * rather than issuing a new transactionId), so the analytics mapper has to
 * pull the amounts back from the operational projection.
 *
 * The reconstructed record always has non-negative amounts; the mapper layer
 * applies the sign convention.
 */
/**
 * Stored-row money fields come back as raw `number` / `string` from Drizzle;
 * the branded domain types are an in-memory invariant we trust at this
 * boundary (the DB columns enforce the same shape via CHECK constraints).
 */
const minor = Brand.nominal<typeof MinorAmount.Type>();
const usdRate = Brand.nominal<typeof ExchangeRate.Type>();
const currency = Brand.nominal<typeof CurrencyCode.Type>();

/**
 * The USD mirror is only reconstructable when every USD column plus the
 * exchange rate survived on the row; a partial mirror is treated as absent.
 */
const usdFromStoredTransaction = (
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

const moneyFromStoredTransaction = (row: StoredTransactionMoneyFields): PurchaseProcessingMoney => {
  const usd = usdFromStoredTransaction(row);
  return new PurchaseProcessingMoney({
    currency: currency(row.currency),
    grossAmount: minor(row.grossAmount),
    proceedsAfterTaxAmount: minor(row.proceedsAfterTaxAmount),
    proceedsAmount: minor(row.proceedsAmount),
    storeCommissionAmount: minor(row.storeCommissionAmount),
    storefront: Option.fromNullishOr(row.storefront),
    taxAmount: minor(row.taxAmount),
    usd,
  });
};

const compactSpanAttributes = (attributes: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(attributes).filter(([, value]) => value !== undefined));

const optionSpanAttribute = <A>(
  value: Option.Option<A>,
  map: (value: A) => unknown = (some) => some,
): unknown => Option.match(value, { onNone: () => undefined, onSome: (some) => map(some) });

/** Reads an error's `cause` when present, else stringifies the error itself. */
const describeErrorCause = (error: unknown): string => {
  if (Predicate.hasProperty(error, "cause")) {
    return String(error.cause);
  }
  return String(error);
};

/** Classifies a purchase result for tracing without changing its domain-level ignored predicate. */
export const purchaseProcessingResultKind = (result: PurchaseProcessingResult) => {
  if (result.idempotent) {
    return "idempotent";
  }
  if (
    result.analyticsEventIds.length === 0 &&
    Option.isNone(result.purchaseId) &&
    Option.isNone(result.subscriptionId) &&
    Option.isNone(result.transactionId)
  ) {
    return "ignored";
  }
  return "applied";
};

const purchaseActionSpanAttributes = (input: PurchaseActionContext) =>
  compactSpanAttributes({
    "purchase.idempotency_key": input.idempotencyKey,
    "purchase.payment_provider_configuration_id": input.paymentProviderConfigurationId,
    "purchase.person_id": input.personId,
    "purchase.project_id": input.projectId,
    "purchase.provider_event_type": input.providerEventType,
    "purchase.provider_subscription_id": optionSpanAttribute(input.providerSubscriptionId),
    "purchase.provider_transaction_id": optionSpanAttribute(input.providerTransactionId),
    "purchase.source": input.source,
  });

const purchaseProcessingResultSpanAttributes = (result: PurchaseProcessingResult) =>
  compactSpanAttributes({
    "purchase.purchase_id": optionSpanAttribute(result.purchaseId),
    "purchase.result": purchaseProcessingResultKind(result),
    "purchase.subscription_id": optionSpanAttribute(result.subscriptionId),
    "purchase.transaction_id": optionSpanAttribute(result.transactionId),
  });

/** The transferred resource id — a purchase id or a subscription id. */
const transferResourceId = (input: TransferSubscriptionInput | TransferPurchaseInput): string => {
  if ("purchaseId" in input) {
    return input.purchaseId;
  }
  return input.subscriptionId;
};

const transferSpanAttributes = (input: TransferSubscriptionInput | TransferPurchaseInput) =>
  compactSpanAttributes({
    "purchase.payment_provider_configuration_id": input.paymentProviderConfigurationId,
    "purchase.project_id": input.projectId,
    "purchase.source": input.source,
    "purchase.transfer.from_person_id": input.fromPersonId,
    "purchase.transfer.mode": input.transferMode,
    "purchase.transfer.resource_id": transferResourceId(input),
    "purchase.transfer.to_person_id": input.toPersonId,
  });

export class PurchaseProcessingService extends Context.Service<PurchaseProcessingService>()(
  "@voidhash/backend/purchases/PurchaseProcessingService",
  {
    make: Effect.gen(function* () {
      const db = yield* Db;
      const perkGrantService = yield* PerkGrantService;
      const webhookEvents = yield* WebhookEventPublisher;

      // ==================== Inline DB query helpers ====================

      const findTransactionByProviderTransactionId = (
        tx: DbTransaction,
        input: {
          readonly paymentProviderConfigurationProductId: string;
          readonly storeTransactionId: string;
        },
      ) =>
        Effect.gen(function* () {
          const row = yield* tx.query.transactions.findFirst({
            where: {
              paymentProviderConfigurationProductId: input.paymentProviderConfigurationProductId,
              storeTransactionId: input.storeTransactionId,
            },
          });
          return Option.fromNullishOr(row);
        });

      const findSubscriptionByStoreSubscriptionId = (
        tx: DbTransaction,
        input: {
          readonly storeSubscriptionId: string;
          readonly paymentProviderConfigurationProductId: string;
        },
      ) =>
        Effect.gen(function* () {
          const row = yield* tx.query.subscriptions.findFirst({
            where: {
              storeSubscriptionId: input.storeSubscriptionId,
              paymentProviderConfigurationProductId: input.paymentProviderConfigurationProductId,
            },
          });
          return Option.fromNullishOr(row);
        });

      /**
       * Watermark-guarded subscription update. The UPDATE additionally
       * requires `last_event_occurred_at IS NULL OR last_event_occurred_at <=
       * occurredAt` so an out-of-order delivery can't silently overwrite
       * fresher state. The column is bumped to `occurredAt` whenever the
       * UPDATE wins, so subsequent older events are rejected.
       * `affectedRows === 0` is a non-fatal signal that the projection was
       * already at-or-past this event's occurrence time.
       */
      const updateSubscriptionIfFresher = (
        tx: DbTransaction,
        input: Omit<Partial<DbSubscription>, "id" | "lastEventOccurredAt"> & {
          readonly id: string;
          readonly occurredAt: Date;
        },
      ) =>
        Effect.gen(function* () {
          const { occurredAt, id, ...rest } = input;
          const result = yield* tx
            .update(subscriptions)
            .set({ ...rest, lastEventOccurredAt: occurredAt })
            .where(
              and(
                eq(subscriptions.id, id),
                or(
                  isNull(subscriptions.lastEventOccurredAt),
                  lte(subscriptions.lastEventOccurredAt, occurredAt),
                ),
              ),
            )
            .returning({ id: subscriptions.id });
          return { affectedRows: result.length };
        });

      /**
       * Inserts a ledger row, treating a UNIQUE-key collision on
       * `idempotency_key` as success rather than an error. Uses MySQL's
       * `ON DUPLICATE KEY UPDATE id = id` for a no-op upsert, then reads the
       * surviving row back to decide who won; returns `{ inserted }` so callers
       * can distinguish the fresh-write path from the duplicate-collision path.
       *
       * We deliberately do NOT infer `inserted` from `affectedRows`. MySQL
       * reports 1 for a fresh insert and 0 for a no-op `ON DUPLICATE KEY UPDATE`,
       * but PlanetScale/Vitess reports 1 for both, so `affectedRows === 1` can't
       * tell an insert from a collision. Instead we compare the surviving row's
       * id to the one we tried to insert: the UNIQUE constraint serializes
       * concurrent writers, so the row keeps the *first* writer's id. A match
       * means we won the insert; a mismatch (or a different existing id) means
       * another caller inserted first — a duplicate. This is driver-agnostic and
       * race-safe.
       */
      const insertPurchaseLedgerRowIfAbsent = (
        tx: DbTransaction,
        input: {
          readonly id: string;
          readonly idempotencyKey: string;
          readonly organizationId: string;
          readonly personId: string;
          readonly projectId: string;
          readonly providerEventType: string;
          readonly providerId: string;
          readonly rawProviderPayload: unknown;
          readonly source: string;
          readonly eventsPayload: ReadonlyArray<object>;
          readonly resultPayload: object;
        },
      ) =>
        Effect.gen(function* () {
          yield* tx
            .insert(purchaseLedger)
            .values(input)
            .onConflictDoNothing({ target: purchaseLedger.idempotencyKey });
          const surviving = yield* tx.query.purchaseLedger.findFirst({
            columns: { id: true },
            where: { idempotencyKey: input.idempotencyKey },
          });
          return { inserted: surviving?.id === input.id };
        });

      // ==================== Internal helpers ====================

      /**
       * Stamps the concrete internal row ids carried by a finished
       * {@link PurchaseProcessingResult} onto the current span. Guards each
       * `Option` so absent ids are never emitted as `"null"`.
       */
      const annotatePurchaseResultIds = (result: PurchaseProcessingResult) =>
        Effect.gen(function* () {
          yield* Effect.annotateCurrentSpan("voidhash.person.id", result.personId);
          if (Option.isSome(result.transactionId)) {
            yield* Effect.annotateCurrentSpan(
              "voidhash.transaction.id",
              result.transactionId.value,
            );
          }
          if (Option.isSome(result.subscriptionId)) {
            yield* Effect.annotateCurrentSpan(
              "voidhash.subscription.id",
              result.subscriptionId.value,
            );
          }
          if (Option.isSome(result.purchaseId)) {
            yield* Effect.annotateCurrentSpan("voidhash.purchase.id", result.purchaseId.value);
          }
        });

      const _withPurchaseActionObservability = <
        A extends PurchaseProcessingResult,
        E,
        R,
        I extends PurchaseActionContext,
      >(
        effect: Effect.Effect<A, E, R>,
        input: I,
      ) =>
        Effect.gen(function* () {
          yield* Effect.annotateCurrentSpan(purchaseActionSpanAttributes(input));
          yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
          yield* Effect.annotateCurrentSpan("voidhash.organization.id", input.organizationId);
          yield* Effect.annotateCurrentSpan("voidhash.payment_provider.id", input.providerId);
          yield* Effect.annotateCurrentSpan(
            "voidhash.payment_provider.configuration_id",
            input.paymentProviderConfigurationId,
          );
          yield* Effect.annotateCurrentSpan("voidhash.person.id", input.personId);
          yield* Effect.annotateCurrentSpan(
            "voidhash.purchase.idempotency_key",
            input.idempotencyKey,
          );
          yield* Effect.annotateCurrentSpan(
            "voidhash.purchase.event_type",
            input.providerEventType,
          );
          yield* Effect.annotateCurrentSpan("voidhash.purchase.source", input.source);
          if (Option.isSome(input.providerTransactionId)) {
            yield* Effect.annotateCurrentSpan(
              "voidhash.transaction.provider_transaction_id",
              input.providerTransactionId.value,
            );
          }
          if (Option.isSome(input.providerSubscriptionId)) {
            yield* Effect.annotateCurrentSpan(
              "voidhash.subscription.provider_subscription_id",
              input.providerSubscriptionId.value,
            );
          }
          const result = yield* effect;
          yield* Effect.annotateCurrentSpan(purchaseProcessingResultSpanAttributes(result));
          yield* annotatePurchaseResultIds(result);
          return result;
        });

      const _withTransferObservability = <
        A extends PurchaseProcessingResult,
        E,
        R,
        I extends TransferSubscriptionInput | TransferPurchaseInput,
      >(
        effect: Effect.Effect<A, E, R>,
        input: I,
      ) =>
        Effect.gen(function* () {
          yield* Effect.annotateCurrentSpan(transferSpanAttributes(input));
          yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
          yield* Effect.annotateCurrentSpan("voidhash.organization.id", input.organizationId);
          yield* Effect.annotateCurrentSpan("voidhash.payment_provider.id", input.providerId);
          yield* Effect.annotateCurrentSpan(
            "voidhash.payment_provider.configuration_id",
            input.paymentProviderConfigurationId,
          );
          yield* Effect.annotateCurrentSpan("voidhash.purchase.source", input.source);
          yield* Effect.annotateCurrentSpan("voidhash.transfer.mode", input.transferMode);
          yield* Effect.annotateCurrentSpan(
            "voidhash.transfer.resource_id",
            transferResourceId(input),
          );
          yield* Effect.annotateCurrentSpan("voidhash.person.from_id", input.fromPersonId);
          yield* Effect.annotateCurrentSpan("voidhash.person.to_id", input.toPersonId);
          const result = yield* effect;
          yield* Effect.annotateCurrentSpan(purchaseProcessingResultSpanAttributes(result));
          yield* annotatePurchaseResultIds(result);
          return result;
        });

      /**
       * Resolves and validates the per-action preamble shared by every public
       * method: the configured product mapping (with the joined product row)
       * and the affected person.
       */
      const _resolveContext = Effect.fn("_resolveContext")(function* (
        input: PurchaseActionContext,
      ) {
        const db = yield* Db;
        const configurationProductRow =
          yield* db.query.paymentProviderConfigurationProducts.findFirst({
            where: { id: input.paymentProviderConfigurationProductId },
            with: { product: true },
          });
        const configurationProductOp = Option.fromNullishOr(configurationProductRow);
        if (
          Option.isNone(configurationProductOp) ||
          !configurationProductOp.value.product ||
          configurationProductOp.value.product.projectId !== input.projectId ||
          configurationProductOp.value.paymentProviderConfigurationId !==
            input.paymentProviderConfigurationId
        ) {
          return yield* new PurchaseProcessingProductNotMappedError({
            paymentProviderConfigurationId: input.paymentProviderConfigurationId,
            paymentProviderConfigurationProductId: input.paymentProviderConfigurationProductId,
          });
        }
        yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
        yield* Effect.annotateCurrentSpan(
          "voidhash.payment_provider.product_id",
          configurationProductOp.value.id,
        );
        if (configurationProductOp.value.product?.id) {
          yield* Effect.annotateCurrentSpan(
            "voidhash.product.id",
            configurationProductOp.value.product.id,
          );
        }
        const personRow = yield* db.query.persons.findFirst({ where: { id: input.personId } });
        const personOp = Option.fromNullishOr(personRow);
        if (Option.isNone(personOp) || personOp.value.projectId !== input.projectId) {
          return yield* new PurchaseProcessingServiceError({
            cause: `Resolved person ${input.personId} not found for project ${input.projectId}`,
          });
        }
        yield* Effect.annotateCurrentSpan("voidhash.person.id", personOp.value.id);
        if (personOp.value.primaryDistinctId) {
          yield* Effect.annotateCurrentSpan(
            "voidhash.person.distinct_id",
            personOp.value.primaryDistinctId,
          );
        }
        return {
          configurationProduct: configurationProductOp.value,
          // Kept alongside `personId` so the webhook mappers never issue their
          // own person lookup just to stamp the public distinct id.
          distinctId: personOp.value.primaryDistinctId ?? personOp.value.id,
          personId: personOp.value.id,
        };
      });

      /**
       * Subject identity for the outbound webhook payload, assembled from the
       * already-resolved configuration-product mapping and person row.
       */
      const _webhookContext = (ctx: {
        readonly configurationProduct: {
          readonly productId: string;
          readonly providerProductKey: string;
          readonly product?: { readonly slug: string } | null;
        };
        readonly distinctId: string;
      }): WebhookEventMapperContext => ({
        distinctId: ctx.distinctId,
        productId: ctx.configurationProduct.productId,
        productSlug: ctx.configurationProduct.product?.slug ?? null,
        providerProductId: ctx.configurationProduct.providerProductKey,
      });

      /**
       * Defers payload construction: the mappers instantiate an `api-contracts`
       * class and schema-encode it, and both throw on invalid input. Returning
       * a thunk keeps that work out of the surrounding `Db.transaction`, so a
       * payload defect can never roll back the purchase it describes.
       */
      const _webhookEventWhen = (
        changed: boolean,
        build: () => WebhookLifecycleEvent,
      ): WebhookEventBuilder | null => {
        if (!changed) return null;
        return build;
      };

      /**
       * Best-effort fan-out of the action's lifecycle events, called only after
       * the surrounding `Db.transaction` has committed so a rolled-back write
       * can never produce a delivered webhook. Builders are forced in order, so
       * an action that emits more than one event (a renewal that also created
       * the subscription) publishes them deterministically. A `null` builder is
       * an action that changed no state (duplicate notification, watermark
       * rejection, or an already existing row) and stays silent; a builder that
       * throws degrades to the same logged warning as a failed dispatch.
       */
      const _publishWebhookEvents = (
        projectId: string,
        builders: readonly (WebhookEventBuilder | null)[],
      ) =>
        Effect.forEach(
          builders,
          (build) => {
            if (build === null) return Effect.void;
            return Effect.sync(build).pipe(
              Effect.flatMap((event) =>
                webhookEvents.publish({
                  eventType: event.eventType,
                  payload: event.payload,
                  projectId,
                }),
              ),
              Effect.catchCause((cause) =>
                Effect.logWarning(
                  `Failed to build a webhook event payload for project ${projectId}: ${Cause.pretty(cause)}`,
                ),
              ),
            );
          },
          { discard: true },
        );

      const _syncPurchasePerks = Effect.fn("_syncPurchasePerks")(function* (
        tx: DbTransaction,
        personId: string,
      ) {
        return yield* perkGrantService.syncUnlockedPerks(tx, personId);
      });

      /** Syncs unlocked perks only when `condition` holds; otherwise no-ops. */
      const _syncPurchasePerksWhen = (condition: boolean, tx: DbTransaction, personId: string) =>
        Effect.gen(function* () {
          if (!condition) {
            return [];
          }
          return yield* _syncPurchasePerks(tx, personId);
        });

      const _resolveDistinctId = Effect.fn("_resolveDistinctId")(function* (
        tx: DbTransaction,
        personId: string,
      ) {
        const personRow = yield* tx.query.persons.findFirst({ where: { id: personId } });
        const personOp = Option.fromNullishOr(personRow);
        return Option.match(personOp, {
          onNone: () => personId,
          onSome: (person) => person.primaryDistinctId ?? personId,
        });
      });

      const _emptyReservedResult = (personId: string) =>
        new PurchaseProcessingResult({
          analyticsEventIds: [],
          changedGrantIds: [],
          idempotent: true,
          personId,
          purchaseId: Option.none(),
          subscriptionId: Option.none(),
          transactionId: Option.none(),
        });

      /**
       * Claims the purchase-ledger idempotency key before operational writes
       * run. On a concurrent duplicate, MySQL serializes on the UNIQUE key;
       * the loser reads and returns the first caller's finalized result.
       */
      const _reservePurchaseLedger = Effect.fn("_reservePurchaseLedger")(function* (
        tx: DbTransaction,
        input: PurchaseLedgerReservationInput,
      ) {
        const id = generateId("purchaseLedger");
        const inserted = yield* insertPurchaseLedgerRowIfAbsent(tx, {
          eventsPayload: [],
          id,
          idempotencyKey: input.idempotencyKey,
          organizationId: input.organizationId,
          personId: input.personId,
          projectId: input.projectId,
          providerEventType: input.providerEventType,
          providerId: input.providerId,
          rawProviderPayload: Option.getOrNull(input.rawProviderPayload),
          resultPayload: encodePurchaseProcessingResult(_emptyReservedResult(input.personId)),
          source: input.source,
        });

        if (inserted.inserted) {
          yield* Effect.annotateCurrentSpan({
            "purchase.ledger_claim": "reserved",
            "purchase.ledger_id": id,
          });
          yield* Effect.annotateCurrentSpan("voidhash.purchase_ledger.id", id);
          return constant({ _tag: "reserved", reservation: { id } });
        }

        const priorRow = yield* tx.query.purchaseLedger.findFirst({
          where: { idempotencyKey: input.idempotencyKey },
        });
        const prior = Option.fromNullishOr(priorRow);
        if (Option.isSome(prior)) {
          yield* Effect.annotateCurrentSpan({
            "purchase.ledger_claim": "duplicate",
            "purchase.ledger_id": prior.value.id,
          });
          yield* Effect.annotateCurrentSpan("voidhash.purchase_ledger.id", prior.value.id);
          return constant({
            _tag: "duplicate",
            result: decodePurchaseProcessingResult(prior.value.resultPayload),
          });
        }

        return yield* new PurchaseProcessingServiceError({
          cause: `purchase ledger reservation lost but no row was readable (idempotencyKey=${input.idempotencyKey})`,
        });
      });

      const _finalizeReservedLedgerResult = Effect.fn("_finalizeReservedLedgerResult")(function* (
        tx: DbTransaction,
        reservation: PurchaseLedgerReservation,
        result: PurchaseProcessingResult,
      ) {
        yield* Effect.annotateCurrentSpan({ "purchase.ledger_id": reservation.id });
        yield* Effect.annotateCurrentSpan("voidhash.purchase_ledger.id", reservation.id);
        yield* tx
          .update(purchaseLedger)
          .set({
            eventsPayload: [],
            resultPayload: encodePurchaseProcessingResult(result),
          })
          .where(eq(purchaseLedger.id, reservation.id))
          .returning({ id: purchaseLedger.id });
        return result;
      });

      /**
       * Builds the mapped analytics events, assembles the
       * `PurchaseProcessingResult` with the produced `eventId`s, and persists
       * both into the `purchase_ledger` table inside the surrounding
       * `transaction`. The ledger row is the durability handoff to
       * {@link PurchaseLedgerWorkerService}, which drains the table by
       * re-dispatching each row's `eventsPayload` onto the shared
       * analytics-ingest queue.
       */
      const _enqueueAnalyticsAndBuildResult = Effect.fn("_enqueueAnalyticsAndBuildResult")(
        function* (
          tx: DbTransaction,
          input: {
            readonly projectId: string;
            readonly organizationId: string;
            readonly personId: string;
            readonly providerId: typeof PaymentProviderId.Type;
            readonly providerEventType: string;
            readonly paymentProviderConfigurationProductId: string;
            readonly idempotencyKey: string;
            readonly rawProviderPayload: Option.Option<unknown>;
            readonly reservation?: PurchaseLedgerReservation;
            readonly source: typeof PurchaseEventSource.Type;
            readonly buildEvents: (
              cfg: RevenueAnalyticsMapperContext,
            ) => ReadonlyArray<typeof InternalAnalyticsEventSchema.Type>;
            readonly buildResult: (
              analyticsEventIds: ReadonlyArray<string>,
            ) => PurchaseProcessingResult;
          },
        ) {
          const apiKeyRow = yield* tx.query.apiKeys.findFirst({
            columns: { key: true },
            where: { projectId: input.projectId, isPublic: true },
          });
          const token = Option.map(Option.fromNullishOr(apiKeyRow), (row) => row.key);
          const resolvedToken = Option.getOrElse(
            token,
            () => `vh_server_revenue_${input.projectId}`,
          );
          // Resolve the person's primary distinct id so single-person revenue
          // events carry a REAL distinct id (not the personId) — late merges
          // then re-attribute them via the identity overrides, like SDK events.
          // Transfer events already pass real source / target distinct ids.
          const distinctId = yield* _resolveDistinctId(tx, input.personId);
          const configurationProduct =
            yield* tx.query.paymentProviderConfigurationProducts.findFirst({
              where: { id: input.paymentProviderConfigurationProductId },
              with: { product: true },
            });
          if (
            !configurationProduct?.product ||
            configurationProduct.product.projectId !== input.projectId
          ) {
            return yield* new PurchaseProcessingServiceError({
              cause: `Revenue product mapping ${input.paymentProviderConfigurationProductId} is missing or outside project ${input.projectId}`,
            });
          }
          const events = input.buildEvents({
            distinctId,
            idempotencyKey: input.idempotencyKey,
            organizationId: input.organizationId,
            productId: configurationProduct.product.id,
            projectId: input.projectId,
            providerProductKey: configurationProduct.providerProductKey,
            token: resolvedToken,
          });
          // The ledger column stores the raw event objects; widening here keeps
          // the JSON column's declared shape without an assertion.
          const eventsPayload: ReadonlyArray<object> = events;
          const analyticsEventIds = events.map((e) => e.eventId);
          const result = input.buildResult(analyticsEventIds);
          const resultPayload = encodePurchaseProcessingResult(result);
          yield* Effect.annotateCurrentSpan({
            ...purchaseProcessingResultSpanAttributes(result),
          });
          yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
          yield* Effect.annotateCurrentSpan("voidhash.organization.id", input.organizationId);
          yield* Effect.annotateCurrentSpan("voidhash.payment_provider.id", input.providerId);
          yield* Effect.annotateCurrentSpan("voidhash.person.id", input.personId);
          yield* Effect.annotateCurrentSpan(
            "voidhash.purchase.event_type",
            input.providerEventType,
          );
          yield* Effect.annotateCurrentSpan("voidhash.purchase.source", input.source);
          yield* Effect.annotateCurrentSpan(
            "voidhash.purchase.idempotency_key",
            input.idempotencyKey,
          );
          yield* Effect.annotateCurrentSpan("voidhash.analytics.event_count", events.length);
          yield* annotatePurchaseResultIds(result);

          if (input.reservation) {
            yield* tx
              .update(purchaseLedger)
              .set({
                eventsPayload,
                resultPayload,
              })
              .where(eq(purchaseLedger.id, input.reservation.id))
              .returning({ id: purchaseLedger.id });
            return result;
          }

          if (events.length > 0) {
            yield* insertPurchaseLedgerRowIfAbsent(tx, {
              eventsPayload,
              id: generateId("purchaseLedger"),
              idempotencyKey: input.idempotencyKey,
              organizationId: input.organizationId,
              personId: input.personId,
              projectId: input.projectId,
              providerEventType: input.providerEventType,
              providerId: input.providerId,
              rawProviderPayload: Option.getOrNull(input.rawProviderPayload),
              resultPayload,
              source: input.source,
            });
          }
          return result;
        },
      );

      /**
       * Finds or creates the transaction row for a financial action. Returns
       * `Option.none` when no `providerTransactionId` is available (the row
       * cannot be uniquely keyed). Idempotent on duplicate provider
       * transaction ids.
       */
      const _findOrCreateTransaction = Effect.fn("_findOrCreateTransaction")(function* (
        tx: DbTransaction,
        input: {
          readonly money: Option.Option<PurchaseProcessingMoney>;
          readonly providerTransactionId: Option.Option<string>;
          readonly paymentProviderConfigurationProductId: string;
          readonly personId: string;
          readonly providerEnvironment: ProviderEnvironmentValue;
          readonly occurredAt: Date;
        },
      ) {
        if (Option.isNone(input.providerTransactionId)) {
          return { id: Option.none<string>(), alreadyExisted: false };
        }
        const providerTransactionId = input.providerTransactionId.value;
        const existing = yield* findTransactionByProviderTransactionId(tx, {
          paymentProviderConfigurationProductId: input.paymentProviderConfigurationProductId,
          storeTransactionId: providerTransactionId,
        });
        if (Option.isSome(existing)) {
          yield* Effect.annotateCurrentSpan({
            "purchase.transaction_id": existing.value.id,
          });
          yield* Effect.annotateCurrentSpan("voidhash.transaction.id", existing.value.id);
          yield* Effect.annotateCurrentSpan(
            "voidhash.transaction.provider_transaction_id",
            providerTransactionId,
          );
          return { id: Option.some(existing.value.id), alreadyExisted: true };
        }
        const money = Option.getOrUndefined(input.money);
        const usd = Option.getOrUndefined(Option.flatMap(input.money, (value) => value.usd));
        const transaction: InsertTransaction = {
          amount: money?.grossAmount ?? 0,
          amountUsd: usd?.grossAmount,
          currency: money?.currency ?? "USD",
          exchangeRate: usd?.exchangeRate,
          grossAmount: money?.grossAmount ?? 0,
          grossAmountUsd: usd?.grossAmount,
          id: generateId("transaction"),
          lastEventOccurredAt: input.occurredAt,
          occurredAt: input.occurredAt,
          paymentProviderConfigurationProductId: input.paymentProviderConfigurationProductId,
          personId: input.personId,
          proceedsAfterTaxAmount: money?.proceedsAfterTaxAmount ?? 0,
          proceedsAfterTaxAmountUsd: usd?.proceedsAfterTaxAmount,
          proceedsAmount: money?.proceedsAmount ?? 0,
          proceedsAmountUsd: usd?.proceedsAmount,
          providerEnvironment: input.providerEnvironment,
          storeCommissionAmount: money?.storeCommissionAmount ?? 0,
          storeCommissionAmountUsd: usd?.storeCommissionAmount,
          storeTransactionId: providerTransactionId,
          storefront: Option.getOrNull(Option.flatMap(input.money, (value) => value.storefront)),
          taxAmount: money?.taxAmount ?? 0,
          taxAmountUsd: usd?.taxAmount,
        };
        yield* tx.insert(transactions).values(transaction);
        yield* Effect.annotateCurrentSpan({
          "purchase.transaction_id": transaction.id,
        });
        yield* Effect.annotateCurrentSpan("voidhash.transaction.id", transaction.id);
        yield* Effect.annotateCurrentSpan(
          "voidhash.transaction.provider_transaction_id",
          providerTransactionId,
        );
        return { id: Option.some(transaction.id), alreadyExisted: false };
      });

      const resolveStoreSubscriptionId = (input: PurchaseActionContext): Option.Option<string> =>
        Option.firstSomeOf([input.providerSubscriptionId, input.providerTransactionId]);

      const resolvePurchaseProviderKey = (input: PurchaseActionContext): Option.Option<string> =>
        Option.firstSomeOf([input.providerTransactionId, input.providerSubscriptionId]);

      const subscriptionIdentifierError = (input: PurchaseActionContext) =>
        new PurchaseProcessingServiceError({
          cause: `Subscription event has no subscription identifier (providerEventType=${input.providerEventType}, providerWebhookNotificationId=${Option.getOrElse(input.providerWebhookNotificationId, () => "—")})`,
        });

      const purchaseIdentifierError = (input: PurchaseActionContext) =>
        new PurchaseProcessingServiceError({
          cause: `Purchase event has no purchase identifier (providerEventType=${input.providerEventType}, providerWebhookNotificationId=${Option.getOrElse(input.providerWebhookNotificationId, () => "—")})`,
        });

      const resolveInitialTransactionId = (input: PurchaseActionContext): Option.Option<string> =>
        Option.firstSomeOf([input.providerSubscriptionId, input.providerTransactionId]);

      const resolveLatestTransactionId = (input: PurchaseActionContext): Option.Option<string> =>
        Option.firstSomeOf([input.providerTransactionId, input.providerSubscriptionId]);

      // ==================== Public methods ====================

      const startSubscription = Effect.fn("startSubscription")(
        function* (input: StartSubscriptionInput) {
          const ctx = yield* _resolveContext(input);
          const storeSubscriptionIdOp = resolveStoreSubscriptionId(input);
          if (Option.isNone(storeSubscriptionIdOp)) {
            return yield* subscriptionIdentifierError(input);
          }
          const storeSubscriptionId = storeSubscriptionIdOp.value;
          const productId = ctx.configurationProduct.id;
          const personId = ctx.personId;

          const outcome = yield* db.transaction((tx) =>
            Effect.gen(function* () {
              const ledgerClaim = yield* _reservePurchaseLedger(tx, input);
              if (ledgerClaim._tag === "duplicate") {
                return { events: NO_WEBHOOK_EVENTS, result: ledgerClaim.result };
              }
              const [transaction, existingSubscription] = yield* Effect.all([
                _findOrCreateTransaction(tx, {
                  money: input.money,
                  occurredAt: input.occurredAt,
                  paymentProviderConfigurationProductId: productId,
                  personId,
                  providerEnvironment: input.providerEnvironment,
                  providerTransactionId: input.providerTransactionId,
                }),
                findSubscriptionByStoreSubscriptionId(tx, {
                  paymentProviderConfigurationProductId: productId,
                  storeSubscriptionId,
                }),
              ]);

              let subscriptionId: string;
              let subscriptionAlreadyExisted: boolean;

              if (Option.isNone(existingSubscription)) {
                const subscription: InsertSubscription = {
                  cancelAtPeriodEnd: false,
                  canceledAt: null,
                  expiresAt: Option.getOrNull(input.expiresAt),
                  id: generateId("subscription"),
                  initialTransactionId: Option.getOrElse(
                    resolveInitialTransactionId(input),
                    () => storeSubscriptionId,
                  ),
                  isTrial: input.isTrial,
                  lastEventOccurredAt: input.occurredAt,
                  latestTransactionId: Option.getOrElse(
                    resolveLatestTransactionId(input),
                    () => storeSubscriptionId,
                  ),
                  paymentProviderConfigurationProductId: productId,
                  personId,
                  providerEnvironment: input.providerEnvironment,
                  purchasedAt: input.purchasedAt,
                  startsAt: input.startsAt,
                  status: SubscriptionStatus.Active,
                  storeSubscriptionId,
                };
                const db = tx;
                yield* db.insert(subscriptions).values(subscription);
                subscriptionId = subscription.id;
                subscriptionAlreadyExisted = false;
              } else {
                subscriptionId = existingSubscription.value.id;
                subscriptionAlreadyExisted = true;
              }
              const changedGrantIds = yield* _syncPurchasePerks(tx, personId);

              const result = yield* _enqueueAnalyticsAndBuildResult(tx, {
                buildEvents: (cfg) =>
                  toStartedAnalyticsInputs(input, { personId, transactionId: transaction.id }, cfg),
                buildResult: (analyticsEventIds) =>
                  new PurchaseProcessingResult({
                    analyticsEventIds,
                    changedGrantIds,
                    idempotent: subscriptionAlreadyExisted || transaction.alreadyExisted,
                    personId,
                    purchaseId: Option.none(),
                    subscriptionId: Option.some(subscriptionId),
                    transactionId: transaction.id,
                  }),
                idempotencyKey: input.idempotencyKey,
                organizationId: input.organizationId,
                paymentProviderConfigurationProductId: ctx.configurationProduct.id,
                personId,
                projectId: input.projectId,
                providerEventType: input.providerEventType,
                providerId: input.providerId,
                rawProviderPayload: input.rawProviderPayload,
                reservation: ledgerClaim.reservation,
                source: input.source,
              });

              // A start that landed on an existing subscription row is a
              // re-observation of a series we already track, not a new one.
              return {
                events: [
                  _webhookEventWhen(!subscriptionAlreadyExisted, () =>
                    toSubscriptionCreatedWebhookEvent(
                      input,
                      { purchasedAt: input.purchasedAt, subscriptionId },
                      _webhookContext(ctx),
                    ),
                  ),
                ],
                result,
              };
            }),
          );

          yield* _publishWebhookEvents(input.projectId, outcome.events);
          return outcome.result;
        },
        (effect, input) =>
          _withPurchaseActionObservability(effect, input).pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new PurchaseProcessingServiceError({ cause: String(error.cause) })),
              PerkGrantServiceError: (error: { readonly cause: string }) =>
                Effect.fail(new PurchaseProcessingServiceError({ cause: error.cause })),
              SqlError: (error) =>
                Effect.fail(new PurchaseProcessingServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      const renewSubscription = Effect.fn("renewSubscription")(
        function* (input: RenewSubscriptionInput) {
          const ctx = yield* _resolveContext(input);
          const storeSubscriptionIdOp = resolveStoreSubscriptionId(input);
          if (Option.isNone(storeSubscriptionIdOp)) {
            return yield* subscriptionIdentifierError(input);
          }
          const storeSubscriptionId = storeSubscriptionIdOp.value;
          const productId = ctx.configurationProduct.id;
          const personId = ctx.personId;

          const outcome = yield* db.transaction((tx) =>
            Effect.gen(function* () {
              const ledgerClaim = yield* _reservePurchaseLedger(tx, input);
              if (ledgerClaim._tag === "duplicate") {
                return { events: NO_WEBHOOK_EVENTS, result: ledgerClaim.result };
              }
              const transaction = yield* _findOrCreateTransaction(tx, {
                money: input.money,
                occurredAt: input.occurredAt,
                paymentProviderConfigurationProductId: productId,
                personId,
                providerEnvironment: input.providerEnvironment,
                providerTransactionId: input.providerTransactionId,
              });
              // Renewal lookup that also follows a pending product-change
              // intent. App Store renewals after an upgrade/downgrade arrive
              // under the new provider product, while the existing
              // subscription row is still keyed by the previous product until
              // this renewal moves it.
              const db = tx;
              const currentProductMatch = yield* db.query.subscriptions.findFirst({
                where: {
                  storeSubscriptionId,
                  paymentProviderConfigurationProductId: productId,
                },
              });
              const existing = yield* Effect.gen(function* () {
                if (currentProductMatch) {
                  return Option.some(currentProductMatch);
                }
                const pendingProductMatch = yield* db.query.subscriptions.findFirst({
                  where: {
                    storeSubscriptionId,
                    pendingProductChangeId: productId,
                  },
                });
                return Option.fromNullishOr(pendingProductMatch);
              });
              let subscriptionId: string;
              let projectionAdvanced: boolean;
              let subscriptionNewlyInserted: boolean;
              if (Option.isNone(existing)) {
                const subscription: InsertSubscription = {
                  cancelAtPeriodEnd: false,
                  canceledAt: null,
                  expiresAt: Option.getOrNull(input.expiresAt),
                  id: generateId("subscription"),
                  initialTransactionId: Option.getOrElse(
                    resolveInitialTransactionId(input),
                    () => storeSubscriptionId,
                  ),
                  isTrial: input.isTrial,
                  lastEventOccurredAt: input.occurredAt,
                  latestTransactionId: Option.getOrElse(
                    resolveLatestTransactionId(input),
                    () => storeSubscriptionId,
                  ),
                  paymentProviderConfigurationProductId: productId,
                  personId,
                  providerEnvironment: input.providerEnvironment,
                  purchasedAt: input.renewedAt,
                  startsAt: input.startsAt,
                  status: SubscriptionStatus.Active,
                  storeSubscriptionId,
                };
                yield* db.insert(subscriptions).values(subscription);
                subscriptionId = subscription.id;
                projectionAdvanced = true;
                subscriptionNewlyInserted = true;
              } else {
                const completesPendingProductChange =
                  existing.value.pendingProductChangeId === productId;
                /**
                 * The renewal moves the subscription onto the pending product
                 * only when this renewal is the one that completes the change.
                 */
                const pendingProductChangeFields = (): Partial<DbSubscription> => {
                  if (completesPendingProductChange) {
                    return {
                      paymentProviderConfigurationProductId: productId,
                      pendingProductChangeId: null,
                    };
                  }
                  return {};
                };
                // A renewal that wins the watermark is proof that billing
                // recovered (Apple's `BILLING_RECOVERY` subtype arrives as a
                // plain `DID_RENEW`), so the retry/grace deadlines staged by
                // `enterBillingRetry` are cleared here.
                const updated = yield* updateSubscriptionIfFresher(tx, {
                  billingRetryAt: null,
                  cancelAtPeriodEnd: false,
                  canceledAt: null,
                  expiresAt: Option.getOrNull(input.expiresAt),
                  gracePeriodExpiresAt: null,
                  id: existing.value.id,
                  isTrial: input.isTrial,
                  latestTransactionId: Option.getOrElse(
                    resolveLatestTransactionId(input),
                    () => storeSubscriptionId,
                  ),
                  occurredAt: input.occurredAt,
                  ...pendingProductChangeFields(),
                  startsAt: input.startsAt,
                  status: SubscriptionStatus.Active,
                  updatedAt: yield* DateTime.nowAsDate,
                });
                if (updated.affectedRows === 0) {
                  yield* Effect.logInfo(
                    `renewSubscription: stale event; watermark guard rejected projection update (subscriptionId=${existing.value.id}, occurredAt=${input.occurredAt.toISOString()})`,
                  );
                }
                subscriptionId = existing.value.id;
                projectionAdvanced = updated.affectedRows > 0;
                subscriptionNewlyInserted = false;
              }
              const changedGrantIds = yield* _syncPurchasePerks(tx, personId);

              const result = yield* _enqueueAnalyticsAndBuildResult(tx, {
                buildEvents: (cfg) =>
                  toRenewedAnalyticsInputs(input, { personId, transactionId: transaction.id }, cfg),
                buildResult: (analyticsEventIds) =>
                  new PurchaseProcessingResult({
                    analyticsEventIds,
                    changedGrantIds,
                    idempotent: transaction.alreadyExisted,
                    personId,
                    purchaseId: Option.none(),
                    subscriptionId: Option.some(subscriptionId),
                    transactionId: transaction.id,
                  }),
                idempotencyKey: input.idempotencyKey,
                organizationId: input.organizationId,
                paymentProviderConfigurationProductId: ctx.configurationProduct.id,
                personId,
                projectId: input.projectId,
                providerEventType: input.providerEventType,
                providerId: input.providerId,
                rawProviderPayload: input.rawProviderPayload,
                reservation: ledgerClaim.reservation,
                source: input.source,
              });

              // Stale renewals rejected by the watermark, and renewals whose
              // charge we had already recorded, advanced nothing.
              const renewalAdvanced = projectionAdvanced && !transaction.alreadyExisted;
              // A renewal can be first contact with a subscription — a missed
              // start notification, or an app migrating onto Voidhash
              // mid-subscription. Receivers get the creation event first, so
              // the renewal always lands on a subscription id they have seen.
              return {
                events: [
                  _webhookEventWhen(renewalAdvanced && subscriptionNewlyInserted, () =>
                    toSubscriptionCreatedWebhookEvent(
                      input,
                      { purchasedAt: input.renewedAt, subscriptionId },
                      _webhookContext(ctx),
                    ),
                  ),
                  _webhookEventWhen(renewalAdvanced, () =>
                    toSubscriptionRenewedWebhookEvent(
                      input,
                      { subscriptionId },
                      _webhookContext(ctx),
                    ),
                  ),
                ],
                result,
              };
            }),
          );

          yield* _publishWebhookEvents(input.projectId, outcome.events);
          return outcome.result;
        },
        (effect, input) =>
          _withPurchaseActionObservability(effect, input).pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new PurchaseProcessingServiceError({ cause: String(error.cause) })),
              PerkGrantServiceError: (error: { readonly cause: string }) =>
                Effect.fail(new PurchaseProcessingServiceError({ cause: error.cause })),
              SqlError: (error) =>
                Effect.fail(new PurchaseProcessingServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      const cancelSubscription = Effect.fn("cancelSubscription")(
        function* (input: CancelSubscriptionInput) {
          const ctx = yield* _resolveContext(input);
          const storeSubscriptionIdOp = resolveStoreSubscriptionId(input);
          if (Option.isNone(storeSubscriptionIdOp)) {
            return yield* subscriptionIdentifierError(input);
          }
          const storeSubscriptionId = storeSubscriptionIdOp.value;
          const productId = ctx.configurationProduct.id;
          const personId = ctx.personId;

          const outcome = yield* db.transaction((tx) =>
            Effect.gen(function* () {
              const ledgerClaim = yield* _reservePurchaseLedger(tx, input);
              if (ledgerClaim._tag === "duplicate") {
                return { events: NO_WEBHOOK_EVENTS, result: ledgerClaim.result };
              }
              const existing = yield* findSubscriptionByStoreSubscriptionId(tx, {
                paymentProviderConfigurationProductId: productId,
                storeSubscriptionId,
              });
              if (Option.isNone(existing)) {
                return {
                  events: NO_WEBHOOK_EVENTS,
                  result: yield* _finalizeReservedLedgerResult(
                    tx,
                    ledgerClaim.reservation,
                    new PurchaseProcessingResult({
                      analyticsEventIds: [],
                      changedGrantIds: [],
                      idempotent: false,
                      personId,
                      purchaseId: Option.none(),
                      subscriptionId: Option.none(),
                      transactionId: Option.none(),
                    }),
                  ),
                };
              }
              const nextStatus = pick(
                input.cancelAtPeriodEnd,
                existing.value.status,
                subscriptionStatusForInactiveEvent(),
              );
              // The watermark admits an *equal* `occurredAt`, so the same
              // cancellation re-observed under a different ledger key (webhook
              // plus reconciliation, say) still updates the row. Comparing the
              // pre-update projection keeps the webhook tied to a real change.
              const alreadyCancelled =
                existing.value.canceledAt?.getTime() === input.canceledAt.getTime() &&
                existing.value.cancelAtPeriodEnd === input.cancelAtPeriodEnd;
              const updated = yield* updateSubscriptionIfFresher(tx, {
                cancelAtPeriodEnd: input.cancelAtPeriodEnd,
                canceledAt: input.canceledAt,
                cancellationReason: Option.getOrNull(input.cancellationReason),
                id: existing.value.id,
                occurredAt: input.occurredAt,
                status: nextStatus,
                updatedAt: yield* DateTime.nowAsDate,
              });
              if (updated.affectedRows === 0) {
                yield* Effect.logInfo(
                  `cancelSubscription: stale event; watermark guard rejected projection update (subscriptionId=${existing.value.id}, occurredAt=${input.occurredAt.toISOString()})`,
                );
              }
              const changedGrantIds = yield* _syncPurchasePerks(tx, personId);

              const result = yield* _enqueueAnalyticsAndBuildResult(tx, {
                buildEvents: (cfg) =>
                  toCanceledAnalyticsInputs(
                    input,
                    { personId, subscriptionId: Option.some(existing.value.id) },
                    cfg,
                  ),
                buildResult: (analyticsEventIds) =>
                  new PurchaseProcessingResult({
                    analyticsEventIds,
                    changedGrantIds,
                    idempotent: false,
                    personId,
                    purchaseId: Option.none(),
                    subscriptionId: Option.some(existing.value.id),
                    transactionId: Option.none(),
                  }),
                idempotencyKey: input.idempotencyKey,
                organizationId: input.organizationId,
                paymentProviderConfigurationProductId: ctx.configurationProduct.id,
                personId,
                projectId: input.projectId,
                providerEventType: input.providerEventType,
                providerId: input.providerId,
                rawProviderPayload: input.rawProviderPayload,
                reservation: ledgerClaim.reservation,
                source: input.source,
              });

              return {
                events: [
                  _webhookEventWhen(updated.affectedRows > 0 && !alreadyCancelled, () =>
                    toSubscriptionCancelledWebhookEvent(
                      input,
                      {
                        expiresAt: existing.value.expiresAt,
                        status: nextStatus,
                        subscriptionId: existing.value.id,
                      },
                      _webhookContext(ctx),
                    ),
                  ),
                ],
                result,
              };
            }),
          );

          yield* _publishWebhookEvents(input.projectId, outcome.events);
          return outcome.result;
        },
        (effect, input) =>
          _withPurchaseActionObservability(effect, input).pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new PurchaseProcessingServiceError({ cause: String(error.cause) })),
              PerkGrantServiceError: (error: { readonly cause: string }) =>
                Effect.fail(new PurchaseProcessingServiceError({ cause: error.cause })),
              SqlError: (error) =>
                Effect.fail(new PurchaseProcessingServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      const expireSubscription = Effect.fn("expireSubscription")(
        function* (input: ExpireSubscriptionInput) {
          const ctx = yield* _resolveContext(input);
          const storeSubscriptionIdOp = resolveStoreSubscriptionId(input);
          if (Option.isNone(storeSubscriptionIdOp)) {
            return yield* subscriptionIdentifierError(input);
          }
          const storeSubscriptionId = storeSubscriptionIdOp.value;
          const productId = ctx.configurationProduct.id;
          const personId = ctx.personId;

          const outcome = yield* db.transaction((tx) =>
            Effect.gen(function* () {
              const ledgerClaim = yield* _reservePurchaseLedger(tx, input);
              if (ledgerClaim._tag === "duplicate") {
                return { events: NO_WEBHOOK_EVENTS, result: ledgerClaim.result };
              }
              const existing = yield* findSubscriptionByStoreSubscriptionId(tx, {
                paymentProviderConfigurationProductId: productId,
                storeSubscriptionId,
              });
              if (Option.isNone(existing)) {
                return {
                  events: NO_WEBHOOK_EVENTS,
                  result: yield* _finalizeReservedLedgerResult(
                    tx,
                    ledgerClaim.reservation,
                    new PurchaseProcessingResult({
                      analyticsEventIds: [],
                      changedGrantIds: [],
                      idempotent: false,
                      personId,
                      purchaseId: Option.none(),
                      subscriptionId: Option.none(),
                      transactionId: Option.none(),
                    }),
                  ),
                };
              }
              // Same equal-`occurredAt` window as cancellation: only a row that
              // was not already expired at this exact instant is a transition.
              // Status alone is not enough — an immediate cancellation also
              // parks the row in the inactive status, and the later expiry of
              // that subscription is still a distinct lifecycle event.
              const alreadyExpired =
                existing.value.status === subscriptionStatusForInactiveEvent() &&
                existing.value.expiresAt?.getTime() === input.expiredAt.getTime();
              const updated = yield* updateSubscriptionIfFresher(tx, {
                expiresAt: input.expiredAt,
                id: existing.value.id,
                occurredAt: input.occurredAt,
                status: subscriptionStatusForInactiveEvent(),
                updatedAt: yield* DateTime.nowAsDate,
              });
              if (updated.affectedRows === 0) {
                yield* Effect.logInfo(
                  `expireSubscription: stale event; watermark guard rejected projection update (subscriptionId=${existing.value.id}, occurredAt=${input.occurredAt.toISOString()})`,
                );
              }
              const changedGrantIds = yield* _syncPurchasePerks(tx, personId);

              const result = yield* _enqueueAnalyticsAndBuildResult(tx, {
                buildEvents: (cfg) =>
                  toExpiredAnalyticsInputs(
                    input,
                    { personId, subscriptionId: Option.some(existing.value.id) },
                    cfg,
                  ),
                buildResult: (analyticsEventIds) =>
                  new PurchaseProcessingResult({
                    analyticsEventIds,
                    changedGrantIds,
                    idempotent: false,
                    personId,
                    purchaseId: Option.none(),
                    subscriptionId: Option.some(existing.value.id),
                    transactionId: Option.none(),
                  }),
                idempotencyKey: input.idempotencyKey,
                organizationId: input.organizationId,
                paymentProviderConfigurationProductId: ctx.configurationProduct.id,
                personId,
                projectId: input.projectId,
                providerEventType: input.providerEventType,
                providerId: input.providerId,
                rawProviderPayload: input.rawProviderPayload,
                reservation: ledgerClaim.reservation,
                source: input.source,
              });

              return {
                events: [
                  _webhookEventWhen(updated.affectedRows > 0 && !alreadyExpired, () =>
                    toSubscriptionExpiredWebhookEvent(
                      input,
                      { subscriptionId: existing.value.id },
                      _webhookContext(ctx),
                    ),
                  ),
                ],
                result,
              };
            }),
          );

          yield* _publishWebhookEvents(input.projectId, outcome.events);
          return outcome.result;
        },
        (effect, input) =>
          _withPurchaseActionObservability(effect, input).pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new PurchaseProcessingServiceError({ cause: String(error.cause) })),
              PerkGrantServiceError: (error: { readonly cause: string }) =>
                Effect.fail(new PurchaseProcessingServiceError({ cause: error.cause })),
              SqlError: (error) =>
                Effect.fail(new PurchaseProcessingServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      const revokeSubscription = Effect.fn("revokeSubscription")(
        function* (input: RevokeSubscriptionInput) {
          const ctx = yield* _resolveContext(input);
          const storeSubscriptionIdOp = resolveStoreSubscriptionId(input);
          if (Option.isNone(storeSubscriptionIdOp)) {
            return yield* subscriptionIdentifierError(input);
          }
          const storeSubscriptionId = storeSubscriptionIdOp.value;
          const productId = ctx.configurationProduct.id;
          const personId = ctx.personId;

          return yield* db.transaction((tx) =>
            Effect.gen(function* () {
              const ledgerClaim = yield* _reservePurchaseLedger(tx, input);
              if (ledgerClaim._tag === "duplicate") {
                return ledgerClaim.result;
              }
              const existing = yield* findSubscriptionByStoreSubscriptionId(tx, {
                paymentProviderConfigurationProductId: productId,
                storeSubscriptionId,
              });
              if (Option.isNone(existing)) {
                return yield* _finalizeReservedLedgerResult(
                  tx,
                  ledgerClaim.reservation,
                  new PurchaseProcessingResult({
                    analyticsEventIds: [],
                    changedGrantIds: [],
                    idempotent: false,
                    personId,
                    purchaseId: Option.none(),
                    subscriptionId: Option.none(),
                    transactionId: Option.none(),
                  }),
                );
              }
              const subscriptionUpdate = yield* updateSubscriptionIfFresher(tx, {
                canceledAt: input.revokedAt,
                cancellationReason: Option.getOrNull(input.revocationReason),
                expiresAt: input.revokedAt,
                id: existing.value.id,
                occurredAt: input.occurredAt,
                status: subscriptionStatusForInactiveEvent(),
                updatedAt: yield* DateTime.nowAsDate,
              });
              if (subscriptionUpdate.affectedRows === 0) {
                yield* Effect.logInfo(
                  `revokeSubscription: stale event; watermark guard rejected subscription update (subscriptionId=${existing.value.id}, occurredAt=${input.occurredAt.toISOString()})`,
                );
              }
              let money: Option.Option<PurchaseProcessingMoney> = Option.none();
              if (Option.isSome(input.providerTransactionId)) {
                const existingTx = yield* findTransactionByProviderTransactionId(tx, {
                  paymentProviderConfigurationProductId: productId,
                  storeTransactionId: input.providerTransactionId.value,
                });
                if (Option.isSome(existingTx)) {
                  money = Option.some(moneyFromStoredTransaction(existingTx.value));
                }
                // Watermark-guarded revoke: the UPDATE additionally requires
                // `last_event_occurred_at IS NULL OR <= occurredAt` so a
                // late-arriving stale event can't overwrite fresher state.
                // `affectedRows === 0` means either the row doesn't exist OR
                // the watermark rejected the update; callers continue
                // regardless so analytics replay still captures the event.
                const db = tx;
                const transactionRevokeRows = yield* db
                  .update(transactions)
                  .set({
                    lastEventOccurredAt: input.occurredAt,
                    revocationReason: Option.getOrNull(input.revocationReason),
                    revokedAt: input.revokedAt,
                  })
                  .where(
                    and(
                      eq(transactions.paymentProviderConfigurationProductId, productId),
                      eq(transactions.storeTransactionId, input.providerTransactionId.value),
                      or(
                        isNull(transactions.lastEventOccurredAt),
                        lte(transactions.lastEventOccurredAt, input.occurredAt),
                      ),
                    ),
                  )
                  .returning({ id: transactions.id });
                const transactionUpdate = { affectedRows: transactionRevokeRows.length };
                if (transactionUpdate.affectedRows === 0) {
                  yield* Effect.logWarning(
                    `revokeSubscription: no prior transaction row OR watermark rejected (storeTransactionId=${input.providerTransactionId.value}, occurredAt=${input.occurredAt.toISOString()})`,
                  );
                }
              }
              const changedGrantIds = yield* _syncPurchasePerks(tx, personId);

              return yield* _enqueueAnalyticsAndBuildResult(tx, {
                buildEvents: (cfg) =>
                  toRevokedAnalyticsInputs(
                    { ...input, money },
                    { personId, subscriptionId: Option.some(existing.value.id) },
                    cfg,
                  ),
                buildResult: (analyticsEventIds) =>
                  new PurchaseProcessingResult({
                    analyticsEventIds,
                    changedGrantIds,
                    idempotent: false,
                    personId,
                    purchaseId: Option.none(),
                    subscriptionId: Option.some(existing.value.id),
                    transactionId: Option.none(),
                  }),
                idempotencyKey: input.idempotencyKey,
                organizationId: input.organizationId,
                paymentProviderConfigurationProductId: ctx.configurationProduct.id,
                personId,
                projectId: input.projectId,
                providerEventType: input.providerEventType,
                providerId: input.providerId,
                rawProviderPayload: input.rawProviderPayload,
                reservation: ledgerClaim.reservation,
                source: input.source,
              });
            }),
          );
        },
        (effect, input) =>
          _withPurchaseActionObservability(effect, input).pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new PurchaseProcessingServiceError({ cause: String(error.cause) })),
              PerkGrantServiceError: (error: { readonly cause: string }) =>
                Effect.fail(new PurchaseProcessingServiceError({ cause: error.cause })),
              SqlError: (error) =>
                Effect.fail(new PurchaseProcessingServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      const completeOneTimePurchase = Effect.fn("completeOneTimePurchase")(
        function* (input: CompleteOneTimePurchaseInput) {
          const ctx = yield* _resolveContext(input);
          const productId = ctx.configurationProduct.id;
          const personId = ctx.personId;

          const outcome = yield* db.transaction((tx) =>
            Effect.gen(function* () {
              const ledgerClaim = yield* _reservePurchaseLedger(tx, input);
              if (ledgerClaim._tag === "duplicate") {
                return { events: NO_WEBHOOK_EVENTS, result: ledgerClaim.result };
              }
              const transaction = yield* _findOrCreateTransaction(tx, {
                money: input.money,
                occurredAt: input.occurredAt,
                paymentProviderConfigurationProductId: productId,
                personId,
                providerEnvironment: input.providerEnvironment,
                providerTransactionId: input.providerTransactionId,
              });
              const providerKeyOp = Option.firstSomeOf([
                input.providerTransactionId,
                input.providerSubscriptionId,
              ]);
              if (Option.isNone(providerKeyOp)) {
                return yield* new PurchaseProcessingServiceError({
                  cause: `One-time purchase event has no provider identifier (providerTransactionId and providerSubscriptionId both absent; providerEventType=${input.providerEventType})`,
                });
              }
              const providerKey = providerKeyOp.value;
              yield* Effect.annotateCurrentSpan("voidhash.purchase.provider_key", providerKey);
              const db = tx;
              const existingPurchaseRow = yield* db.query.purchases.findFirst({
                where: { paymentProviderConfigurationProductId: productId, providerKey },
              });
              const existing = Option.fromNullishOr(existingPurchaseRow);
              let purchaseId: string;
              let purchaseAlreadyExisted: boolean;
              if (Option.isSome(existing)) {
                purchaseId = existing.value.id;
                purchaseAlreadyExisted = true;
              } else {
                const purchase: InsertPurchase = {
                  id: generateId("purchase"),
                  paymentProviderConfigurationProductId: productId,
                  personId,
                  providerEnvironment: input.providerEnvironment,
                  providerKey,
                  type: purchaseTypeFor(input.purchaseType),
                };
                yield* db.insert(purchases).values(purchase);
                purchaseId = purchase.id;
                purchaseAlreadyExisted = false;
              }
              const changedGrantIds = yield* _syncPurchasePerks(tx, personId);

              const result = yield* _enqueueAnalyticsAndBuildResult(tx, {
                buildEvents: (cfg) =>
                  toOneTimePurchaseAnalyticsInputs(
                    input,
                    { personId, transactionId: transaction.id },
                    cfg,
                  ),
                buildResult: (analyticsEventIds) =>
                  new PurchaseProcessingResult({
                    analyticsEventIds,
                    changedGrantIds,
                    idempotent: transaction.alreadyExisted || purchaseAlreadyExisted,
                    personId,
                    purchaseId: Option.some(purchaseId),
                    subscriptionId: Option.none(),
                    transactionId: transaction.id,
                  }),
                idempotencyKey: input.idempotencyKey,
                organizationId: input.organizationId,
                paymentProviderConfigurationProductId: ctx.configurationProduct.id,
                personId,
                projectId: input.projectId,
                providerEventType: input.providerEventType,
                providerId: input.providerId,
                rawProviderPayload: input.rawProviderPayload,
                reservation: ledgerClaim.reservation,
                source: input.source,
              });

              return {
                events: [
                  _webhookEventWhen(!purchaseAlreadyExisted, () =>
                    toPurchaseCompletedWebhookEvent(
                      input,
                      { providerKey, purchaseId },
                      _webhookContext(ctx),
                    ),
                  ),
                ],
                result,
              };
            }),
          );

          yield* _publishWebhookEvents(input.projectId, outcome.events);
          return outcome.result;
        },
        (effect, input) =>
          _withPurchaseActionObservability(effect, input).pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new PurchaseProcessingServiceError({ cause: String(error.cause) })),
              PerkGrantServiceError: (error: { readonly cause: string }) =>
                Effect.fail(new PurchaseProcessingServiceError({ cause: error.cause })),
              SqlError: (error) =>
                Effect.fail(new PurchaseProcessingServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      const refundPurchase = Effect.fn("refundPurchase")(
        function* (input: RefundPurchaseInput) {
          const ctx = yield* _resolveContext(input);
          const personId = ctx.personId;

          const outcome = yield* db.transaction((tx) =>
            Effect.gen(function* () {
              const ledgerClaim = yield* _reservePurchaseLedger(tx, input);
              if (ledgerClaim._tag === "duplicate") {
                return { events: NO_WEBHOOK_EVENTS, result: ledgerClaim.result };
              }
              let money: Option.Option<PurchaseProcessingMoney> = Option.none();
              // Tracked only for the outbound webhook: `true` once the
              // transaction row went from "not refunded at this instant" to
              // refunded. A row already carrying this exact `refundedAt` is a
              // re-observation, not a transition.
              let transactionNewlyRefunded = false;
              /** SM-2 subject gate: did a `transactions` row back this refund? */
              let transactionFound = false;
              const partialRefundMoney = input.partialRefundMoney;
              if (partialRefundMoney !== undefined) {
                // Partial refund: the entitlement survives and the projection
                // rows stay unrefunded — only the analytics/ledger event is
                // emitted, carrying the refunded delta.
                const result = yield* _enqueueAnalyticsAndBuildResult(tx, {
                  buildEvents: (cfg) =>
                    toRefundedAnalyticsInputs(
                      { ...input, money: Option.some(partialRefundMoney) },
                      { personId },
                      cfg,
                    ),
                  buildResult: (analyticsEventIds) =>
                    new PurchaseProcessingResult({
                      analyticsEventIds,
                      changedGrantIds: [],
                      idempotent: false,
                      personId,
                      purchaseId: Option.none(),
                      subscriptionId: Option.none(),
                      transactionId: Option.none(),
                    }),
                  idempotencyKey: input.idempotencyKey,
                  organizationId: input.organizationId,
                  paymentProviderConfigurationProductId: ctx.configurationProduct.id,
                  personId,
                  projectId: input.projectId,
                  providerEventType: input.providerEventType,
                  providerId: input.providerId,
                  rawProviderPayload: input.rawProviderPayload,
                  reservation: ledgerClaim.reservation,
                  source: input.source,
                });
                return { events: NO_WEBHOOK_EVENTS, result };
              }
              if (Option.isNone(input.providerTransactionId)) {
                yield* Effect.logWarning(
                  "refundPurchase: no providerTransactionId; skipping transaction row update",
                );
              } else {
                const existing = yield* findTransactionByProviderTransactionId(tx, {
                  paymentProviderConfigurationProductId: ctx.configurationProduct.id,
                  storeTransactionId: input.providerTransactionId.value,
                });
                transactionFound = Option.isSome(existing);
                if (Option.isSome(existing)) {
                  money = Option.some(moneyFromStoredTransaction(existing.value));
                }
                const transactionAlreadyRefunded =
                  Option.isSome(existing) &&
                  existing.value.refundedAt?.getTime() === input.refundedAt.getTime();
                // Watermark-guarded refund: the UPDATE additionally requires
                // `last_event_occurred_at IS NULL OR <= occurredAt` so a
                // late-arriving stale REFUND can't overwrite a fresher
                // REFUND_REVERSED. `affectedRows === 0` means the row doesn't
                // exist OR the watermark rejected the update; callers continue
                // regardless so analytics replay still captures the event.
                const db = tx;
                const transactionRefundRows = yield* db
                  .update(transactions)
                  .set({
                    lastEventOccurredAt: input.occurredAt,
                    refundReason: Option.getOrNull(input.refundReason),
                    refundedAt: input.refundedAt,
                  })
                  .where(
                    and(
                      eq(
                        transactions.paymentProviderConfigurationProductId,
                        ctx.configurationProduct.id,
                      ),
                      eq(transactions.storeTransactionId, input.providerTransactionId.value),
                      or(
                        isNull(transactions.lastEventOccurredAt),
                        lte(transactions.lastEventOccurredAt, input.occurredAt),
                      ),
                    ),
                  )
                  .returning({ id: transactions.id });
                const updated = { affectedRows: transactionRefundRows.length };
                transactionNewlyRefunded = updated.affectedRows > 0 && !transactionAlreadyRefunded;
                if (updated.affectedRows === 0) {
                  yield* Effect.logWarning(
                    `refundPurchase: no prior transaction row OR watermark rejected (storeTransactionId=${input.providerTransactionId.value}, occurredAt=${input.occurredAt.toISOString()}); analytics will still emit`,
                  );
                }
              }
              let purchaseId: Option.Option<string> = Option.none();
              let purchaseUpdated = false;
              /** Webhook-only counterpart of {@link transactionNewlyRefunded}. */
              let purchaseNewlyRefunded = false;
              const providerKeyOp = resolvePurchaseProviderKey(input);
              if (Option.isNone(providerKeyOp)) {
                yield* Effect.logWarning(
                  "refundPurchase: no purchase provider key; skipping purchase row update",
                );
              } else {
                const db = tx;
                const existingPurchaseRow = yield* db.query.purchases.findFirst({
                  where: {
                    paymentProviderConfigurationProductId: ctx.configurationProduct.id,
                    providerKey: providerKeyOp.value,
                  },
                });
                const existingPurchase = Option.fromNullishOr(existingPurchaseRow);
                if (Option.isSome(existingPurchase)) {
                  purchaseId = Option.some(existingPurchase.value.id);
                  // Watermark-guarded purchase refund: the UPDATE additionally
                  // requires `last_event_occurred_at IS NULL OR <= occurredAt`
                  // so a late-arriving stale event can't overwrite fresher
                  // state. `affectedRows === 0` means the watermark rejected
                  // the update.
                  const purchaseRefundRows = yield* db
                    .update(purchases)
                    .set({
                      lastEventOccurredAt: input.occurredAt,
                      refundReason: Option.getOrNull(input.refundReason),
                      refundedAt: input.refundedAt,
                    })
                    .where(
                      and(
                        eq(
                          purchases.paymentProviderConfigurationProductId,
                          ctx.configurationProduct.id,
                        ),
                        eq(purchases.providerKey, providerKeyOp.value),
                        or(
                          isNull(purchases.lastEventOccurredAt),
                          lte(purchases.lastEventOccurredAt, input.occurredAt),
                        ),
                      ),
                    )
                    .returning({ id: purchases.id });
                  const purchaseUpdate = { affectedRows: purchaseRefundRows.length };
                  purchaseUpdated = purchaseUpdate.affectedRows > 0;
                  purchaseNewlyRefunded =
                    purchaseUpdated &&
                    existingPurchase.value.refundedAt?.getTime() !== input.refundedAt.getTime();
                  if (purchaseUpdate.affectedRows === 0) {
                    yield* Effect.logWarning(
                      `refundPurchase: purchase row watermark rejected (providerKey=${providerKeyOp.value}, occurredAt=${input.occurredAt.toISOString()})`,
                    );
                  }
                }
              }
              // SM-2: a refund whose subject we never recorded — neither a
              // `transactions` nor a `purchases` row matched — must not emit
              // blind negative revenue; that would break the revenue sign-sum
              // invariant. Refunds arriving before their purchase are handled
              // by the park/replay path, so the ledger row is finalized empty
              // (no analytics, no webhook, no error) exactly like the
              // subscription actions' missing-subject guard.
              if (!transactionFound && Option.isNone(purchaseId)) {
                yield* Effect.logWarning(
                  "refundPurchase: no transaction and no purchase row for the refund subject; finalizing an empty ledger row without analytics",
                );
                return {
                  events: NO_WEBHOOK_EVENTS,
                  result: yield* _finalizeReservedLedgerResult(
                    tx,
                    ledgerClaim.reservation,
                    new PurchaseProcessingResult({
                      analyticsEventIds: [],
                      changedGrantIds: [],
                      idempotent: false,
                      personId,
                      purchaseId: Option.none(),
                      subscriptionId: Option.none(),
                      transactionId: Option.none(),
                    }),
                  ),
                };
              }
              const changedGrantIds = yield* _syncPurchasePerksWhen(purchaseUpdated, tx, personId);

              const result = yield* _enqueueAnalyticsAndBuildResult(tx, {
                buildEvents: (cfg) =>
                  toRefundedAnalyticsInputs({ ...input, money }, { personId }, cfg),
                buildResult: (analyticsEventIds) =>
                  new PurchaseProcessingResult({
                    analyticsEventIds,
                    changedGrantIds,
                    idempotent: false,
                    personId,
                    purchaseId,
                    subscriptionId: Option.none(),
                    transactionId: Option.none(),
                  }),
                idempotencyKey: input.idempotencyKey,
                organizationId: input.organizationId,
                paymentProviderConfigurationProductId: ctx.configurationProduct.id,
                personId,
                projectId: input.projectId,
                providerEventType: input.providerEventType,
                providerId: input.providerId,
                rawProviderPayload: input.rawProviderPayload,
                reservation: ledgerClaim.reservation,
                source: input.source,
              });

              // Subscription refunds carry no purchase row, so the transaction
              // row flipping to refunded is an equally valid state change.
              return {
                events: [
                  _webhookEventWhen(purchaseNewlyRefunded || transactionNewlyRefunded, () =>
                    toPurchaseRefundedWebhookEvent(
                      input,
                      { money, purchaseId: Option.getOrNull(purchaseId) },
                      _webhookContext(ctx),
                    ),
                  ),
                ],
                result,
              };
            }),
          );

          yield* _publishWebhookEvents(input.projectId, outcome.events);
          return outcome.result;
        },
        (effect, input) =>
          _withPurchaseActionObservability(effect, input).pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new PurchaseProcessingServiceError({ cause: String(error.cause) })),
              PerkGrantServiceError: (error: { readonly cause: string }) =>
                Effect.fail(new PurchaseProcessingServiceError({ cause: error.cause })),
              SqlError: (error) =>
                Effect.fail(new PurchaseProcessingServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      const revokePurchase = Effect.fn("revokePurchase")(
        function* (input: RevokePurchaseInput) {
          const ctx = yield* _resolveContext(input);
          const personId = ctx.personId;
          const providerKeyOp = resolvePurchaseProviderKey(input);
          if (Option.isNone(providerKeyOp)) {
            return yield* purchaseIdentifierError(input);
          }
          const providerKey = providerKeyOp.value;
          yield* Effect.annotateCurrentSpan("voidhash.purchase.provider_key", providerKey);

          return yield* db.transaction((tx) =>
            Effect.gen(function* () {
              const ledgerClaim = yield* _reservePurchaseLedger(tx, input);
              if (ledgerClaim._tag === "duplicate") {
                return ledgerClaim.result;
              }
              const db = tx;
              const purchaseRow = yield* db.query.purchases.findFirst({
                where: {
                  paymentProviderConfigurationProductId: ctx.configurationProduct.id,
                  providerKey,
                },
              });
              const purchase = Option.fromNullishOr(purchaseRow);
              if (Option.isNone(purchase)) {
                return yield* _finalizeReservedLedgerResult(
                  tx,
                  ledgerClaim.reservation,
                  new PurchaseProcessingResult({
                    analyticsEventIds: [],
                    changedGrantIds: [],
                    idempotent: false,
                    personId,
                    purchaseId: Option.none(),
                    subscriptionId: Option.none(),
                    transactionId: Option.none(),
                  }),
                );
              }

              let money: Option.Option<PurchaseProcessingMoney> = Option.none();
              if (Option.isNone(input.providerTransactionId)) {
                yield* Effect.logWarning(
                  "revokePurchase: no providerTransactionId; skipping transaction row update",
                );
              } else {
                const existingTx = yield* findTransactionByProviderTransactionId(tx, {
                  paymentProviderConfigurationProductId: ctx.configurationProduct.id,
                  storeTransactionId: input.providerTransactionId.value,
                });
                if (Option.isSome(existingTx)) {
                  money = Option.some(moneyFromStoredTransaction(existingTx.value));
                }
                // Watermark-guarded revoke: the UPDATE additionally requires
                // `last_event_occurred_at IS NULL OR <= occurredAt` so a
                // late-arriving stale event can't overwrite fresher state.
                // `affectedRows === 0` means the row doesn't exist OR the
                // watermark rejected the update.
                const transactionRevokeRows = yield* db
                  .update(transactions)
                  .set({
                    lastEventOccurredAt: input.occurredAt,
                    revocationReason: Option.getOrNull(input.revocationReason),
                    revokedAt: input.revokedAt,
                  })
                  .where(
                    and(
                      eq(
                        transactions.paymentProviderConfigurationProductId,
                        ctx.configurationProduct.id,
                      ),
                      eq(transactions.storeTransactionId, input.providerTransactionId.value),
                      or(
                        isNull(transactions.lastEventOccurredAt),
                        lte(transactions.lastEventOccurredAt, input.occurredAt),
                      ),
                    ),
                  )
                  .returning({ id: transactions.id });
                const transactionUpdate = { affectedRows: transactionRevokeRows.length };
                if (transactionUpdate.affectedRows === 0) {
                  yield* Effect.logWarning(
                    `revokePurchase: no prior transaction row OR watermark rejected (storeTransactionId=${input.providerTransactionId.value}, occurredAt=${input.occurredAt.toISOString()})`,
                  );
                }
              }

              // Watermark-guarded purchase revoke: the UPDATE additionally
              // requires `last_event_occurred_at IS NULL OR <= occurredAt` so
              // a late-arriving stale event can't overwrite fresher state.
              const purchaseRevokeRows = yield* db
                .update(purchases)
                .set({
                  lastEventOccurredAt: input.occurredAt,
                  revocationReason: Option.getOrNull(input.revocationReason),
                  revokedAt: input.revokedAt,
                })
                .where(
                  and(
                    eq(
                      purchases.paymentProviderConfigurationProductId,
                      ctx.configurationProduct.id,
                    ),
                    eq(purchases.providerKey, providerKey),
                    or(
                      isNull(purchases.lastEventOccurredAt),
                      lte(purchases.lastEventOccurredAt, input.occurredAt),
                    ),
                  ),
                )
                .returning({ id: purchases.id });
              const purchaseUpdate = { affectedRows: purchaseRevokeRows.length };
              if (purchaseUpdate.affectedRows === 0) {
                yield* Effect.logWarning(
                  `revokePurchase: purchase row watermark rejected (providerKey=${providerKey}, occurredAt=${input.occurredAt.toISOString()})`,
                );
              }
              const changedGrantIds = yield* _syncPurchasePerksWhen(
                purchaseUpdate.affectedRows > 0,
                tx,
                personId,
              );

              return yield* _enqueueAnalyticsAndBuildResult(tx, {
                buildEvents: (cfg) =>
                  toPurchaseRevokedAnalyticsInputs({ ...input, money }, { personId }, cfg),
                buildResult: (analyticsEventIds) =>
                  new PurchaseProcessingResult({
                    analyticsEventIds,
                    changedGrantIds,
                    idempotent: false,
                    personId,
                    purchaseId: Option.some(purchase.value.id),
                    subscriptionId: Option.none(),
                    transactionId: Option.none(),
                  }),
                idempotencyKey: input.idempotencyKey,
                organizationId: input.organizationId,
                paymentProviderConfigurationProductId: ctx.configurationProduct.id,
                personId,
                projectId: input.projectId,
                providerEventType: input.providerEventType,
                providerId: input.providerId,
                rawProviderPayload: input.rawProviderPayload,
                reservation: ledgerClaim.reservation,
                source: input.source,
              });
            }),
          );
        },
        (effect, input) =>
          _withPurchaseActionObservability(effect, input).pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new PurchaseProcessingServiceError({ cause: String(error.cause) })),
              PerkGrantServiceError: (error: { readonly cause: string }) =>
                Effect.fail(new PurchaseProcessingServiceError({ cause: error.cause })),
              SqlError: (error) =>
                Effect.fail(new PurchaseProcessingServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      const _wrapStateMutationErrors = <
        A extends PurchaseProcessingResult,
        E,
        R,
        I extends PurchaseActionContext,
      >(
        effect: Effect.Effect<A, E, R>,
        input: I,
      ) =>
        _withPurchaseActionObservability(effect, input).pipe(
          // `catchTags` can't prove these tags are members of the generic `E`
          // here (it needs a concrete error union), so narrow with a tag guard
          // instead — same effect, no `any` widening that would poison the
          // inferred result type for callers.
          Effect.catchIf(
            (
              error,
            ): error is Extract<
              E,
              {
                readonly _tag: "EffectDrizzleQueryError" | "SqlError" | "PerkGrantServiceError";
              }
            > =>
              Predicate.hasProperty(error, "_tag") &&
              (error._tag === "EffectDrizzleQueryError" ||
                error._tag === "SqlError" ||
                error._tag === "PerkGrantServiceError"),
            (error) =>
              Effect.fail(
                new PurchaseProcessingServiceError({
                  cause: describeErrorCause(error),
                }),
              ),
          ),
        );

      /**
       * Common subscription-state-mutation skeleton used by the Phase 4
       * notification handlers below. Resolves the context, locates the
       * subscription, applies the watermark-guarded update produced by
       * `buildPatch`, then enqueues analytics. No-ops cleanly when the
       * subscription isn't known locally (returns an idempotent empty result)
       * — analytics don't fire because the mapper sees
       * `subscriptionId: Option.none()`.
       */
      const _applySubscriptionStateMutation = Effect.fn("_applySubscriptionStateMutation")(
        function* <I extends PurchaseActionContext>(input: {
          readonly methodName: string;
          readonly action: I;
          readonly buildPatch: (existing: {
            readonly id: string;
            readonly status: number;
            readonly expiresAt: Date | null;
          }) => Omit<Partial<{ readonly status: number }>, never> & Record<string, unknown>;
          readonly buildEvents: (
            result: { readonly personId: string; readonly subscriptionId: Option.Option<string> },
            cfg: RevenueAnalyticsMapperContext,
          ) => ReadonlyArray<typeof InternalAnalyticsEventSchema.Type>;
          readonly syncPerksOnApply: boolean;
        }) {
          yield* Effect.annotateCurrentSpan({
            ...purchaseActionSpanAttributes(input.action),
          });
          const ctx = yield* _resolveContext(input.action);
          const storeSubscriptionIdOp = resolveStoreSubscriptionId(input.action);
          if (Option.isNone(storeSubscriptionIdOp)) {
            return yield* subscriptionIdentifierError(input.action);
          }
          const storeSubscriptionId = storeSubscriptionIdOp.value;
          const productId = ctx.configurationProduct.id;
          const personId = ctx.personId;

          return yield* db.transaction((tx) =>
            Effect.gen(function* () {
              const ledgerClaim = yield* _reservePurchaseLedger(tx, input.action);
              if (ledgerClaim._tag === "duplicate") {
                return ledgerClaim.result;
              }
              const existing = yield* findSubscriptionByStoreSubscriptionId(tx, {
                paymentProviderConfigurationProductId: productId,
                storeSubscriptionId,
              });
              if (Option.isNone(existing)) {
                return yield* _finalizeReservedLedgerResult(
                  tx,
                  ledgerClaim.reservation,
                  new PurchaseProcessingResult({
                    analyticsEventIds: [],
                    changedGrantIds: [],
                    idempotent: false,
                    personId,
                    purchaseId: Option.none(),
                    subscriptionId: Option.none(),
                    transactionId: Option.none(),
                  }),
                );
              }
              const patch = input.buildPatch(existing.value);
              const updated = yield* updateSubscriptionIfFresher(tx, {
                ...patch,
                id: existing.value.id,
                occurredAt: input.action.occurredAt,
                updatedAt: yield* DateTime.nowAsDate,
              });
              if (updated.affectedRows === 0) {
                yield* Effect.logInfo(
                  `${input.methodName}: stale event; watermark guard rejected projection update (subscriptionId=${existing.value.id}, occurredAt=${input.action.occurredAt.toISOString()})`,
                );
              }
              const changedGrantIds = yield* _syncPurchasePerksWhen(
                input.syncPerksOnApply,
                tx,
                personId,
              );
              return yield* _enqueueAnalyticsAndBuildResult(tx, {
                buildEvents: (cfg) =>
                  input.buildEvents(
                    { personId, subscriptionId: Option.some(existing.value.id) },
                    cfg,
                  ),
                buildResult: (analyticsEventIds) =>
                  new PurchaseProcessingResult({
                    analyticsEventIds,
                    changedGrantIds,
                    idempotent: false,
                    personId,
                    purchaseId: Option.none(),
                    subscriptionId: Option.some(existing.value.id),
                    transactionId: Option.none(),
                  }),
                idempotencyKey: input.action.idempotencyKey,
                organizationId: input.action.organizationId,
                paymentProviderConfigurationProductId: ctx.configurationProduct.id,
                personId,
                projectId: input.action.projectId,
                providerEventType: input.action.providerEventType,
                providerId: input.action.providerId,
                rawProviderPayload: input.action.rawProviderPayload,
                reservation: ledgerClaim.reservation,
                source: input.action.source,
              });
            }),
          );
        },
      );

      const enterBillingRetry = Effect.fn("enterBillingRetry")(function* (
        input: EnterBillingRetryInput,
      ) {
        return yield* _applySubscriptionStateMutation({
          action: input,
          buildEvents: (result, cfg) =>
            toBillingRetryAnalyticsInputs(
              {
                ...input,
                gracePeriodExpiresAt: input.gracePeriodExpiresAt,
                occurredAt: input.occurredAt,
              },
              result,
              cfg,
            ),
          buildPatch: () => ({
            billingRetryAt: input.billingRetryAt,
            gracePeriodExpiresAt: Option.getOrNull(input.gracePeriodExpiresAt),
          }),
          methodName: "enterBillingRetry",
          syncPerksOnApply: false,
        });
      }, _wrapStateMutationErrors);

      const extendSubscription = Effect.fn("extendSubscription")(function* (
        input: ExtendSubscriptionInput,
      ) {
        return yield* _applySubscriptionStateMutation({
          action: input,
          buildEvents: (result, cfg) =>
            toExtendedAnalyticsInputs(
              { ...input, extendedTo: input.extendedTo, occurredAt: input.occurredAt },
              result,
              cfg,
            ),
          buildPatch: () => ({
            expiresAt: input.extendedTo,
            extendedTo: input.extendedTo,
          }),
          methodName: "extendSubscription",
          syncPerksOnApply: false,
        });
      }, _wrapStateMutationErrors);

      const changeRenewalPreference = Effect.fn("changeRenewalPreference")(function* (
        input: ChangeRenewalPreferenceInput,
      ) {
        return yield* _applySubscriptionStateMutation({
          action: input,
          buildEvents: (result, cfg) =>
            toRenewalPreferenceChangeAnalyticsInputs(
              {
                ...input,
                newProviderProductKey: input.newProviderProductKey,
                occurredAt: input.occurredAt,
              },
              result,
              cfg,
            ),
          // `None` here means the target product isn't mapped to a
          // configuration product — not "clear the pending change" — so an
          // existing pending change is preserved rather than nulled out.
          buildPatch: () =>
            Option.match(input.newPaymentProviderConfigurationProductId, {
              onNone: () => ({}),
              onSome: (pendingProductChangeId) => ({ pendingProductChangeId }),
            }),
          methodName: "changeRenewalPreference",
          syncPerksOnApply: false,
        });
      }, _wrapStateMutationErrors);

      const redeemOffer = Effect.fn("redeemOffer")(function* (input: RedeemOfferInput) {
        return yield* _applySubscriptionStateMutation({
          action: input,
          buildEvents: (result, cfg) =>
            toOfferRedeemedAnalyticsInputs(
              { ...input, offerId: input.offerId, occurredAt: input.occurredAt },
              result,
              cfg,
            ),
          buildPatch: () => ({
            redeemedOfferAt: input.redeemedAt,
            redeemedOfferId: Option.getOrNull(input.offerId),
          }),
          methodName: "redeemOffer",
          syncPerksOnApply: false,
        });
      }, _wrapStateMutationErrors);

      const recordPriceIncrease = Effect.fn("recordPriceIncrease")(function* (
        input: RecordPriceIncreaseInput,
      ) {
        const money = Option.getOrUndefined(input.money);
        return yield* _applySubscriptionStateMutation({
          action: input,
          buildEvents: (result, cfg) =>
            toPriceIncreaseAnalyticsInputs(
              {
                ...input,
                effectiveAt: input.effectiveAt,
                money: input.money,
                occurredAt: input.occurredAt,
              },
              result,
              cfg,
            ),
          buildPatch: () => ({
            pendingPriceAmount: money?.grossAmount ?? null,
            pendingPriceCurrency: money?.currency ?? null,
            pendingPriceEffectiveAt: Option.getOrNull(input.effectiveAt),
          }),
          methodName: "recordPriceIncrease",
          syncPerksOnApply: false,
        });
      }, _wrapStateMutationErrors);

      const resumeAutoRenew = Effect.fn("resumeAutoRenew")(function* (input: ResumeAutoRenewInput) {
        return yield* _applySubscriptionStateMutation({
          action: input,
          buildEvents: (result, cfg) =>
            toAutoRenewResumedAnalyticsInputs(
              { ...input, occurredAt: input.occurredAt },
              result,
              cfg,
            ),
          // An immediate cancellation flips `status` to Canceled, so resuming
          // must restore Active — but only while the paid period is still
          // running; a lapsed subscription stays in its inactive status until
          // a renewal event arrives.
          buildPatch: (existing) => {
            const periodStillRunning =
              existing.expiresAt === null ||
              existing.expiresAt.getTime() > input.occurredAt.getTime();
            return {
              cancelAtPeriodEnd: false,
              canceledAt: null,
              cancellationReason: null,
              ...pick(periodStillRunning, { status: SubscriptionStatus.Active }, {}),
            };
          },
          methodName: "resumeAutoRenew",
          syncPerksOnApply: true,
        });
      }, _wrapStateMutationErrors);

      const reverseRefund = Effect.fn("reverseRefund")(
        function* (input: ReverseRefundInput) {
          const ctx = yield* _resolveContext(input);
          const personId = ctx.personId;

          return yield* db.transaction((tx) =>
            Effect.gen(function* () {
              const ledgerClaim = yield* _reservePurchaseLedger(tx, input);
              if (ledgerClaim._tag === "duplicate") {
                return ledgerClaim.result;
              }
              let money: Option.Option<PurchaseProcessingMoney> = Option.none();
              /** SM-2 subject gate: did a `transactions` row back this reversal? */
              let transactionFound = false;
              if (Option.isNone(input.providerTransactionId)) {
                yield* Effect.logWarning(
                  "reverseRefund: no providerTransactionId; skipping transaction row update",
                );
              } else {
                const existing = yield* findTransactionByProviderTransactionId(tx, {
                  paymentProviderConfigurationProductId: ctx.configurationProduct.id,
                  storeTransactionId: input.providerTransactionId.value,
                });
                transactionFound = Option.isSome(existing);
                if (Option.isSome(existing)) {
                  money = Option.some(moneyFromStoredTransaction(existing.value));
                }
                // Watermark-guarded refund-reversal: the UPDATE additionally
                // requires `last_event_occurred_at IS NULL OR <= occurredAt`
                // so a late-arriving stale event can't overwrite fresher
                // state. `affectedRows === 0` means the row doesn't exist OR
                // the watermark rejected the update.
                const db = tx;
                const transactionReverseRows = yield* db
                  .update(transactions)
                  .set({
                    lastEventOccurredAt: input.occurredAt,
                    refundReason: null,
                    refundedAt: null,
                  })
                  .where(
                    and(
                      eq(
                        transactions.paymentProviderConfigurationProductId,
                        ctx.configurationProduct.id,
                      ),
                      eq(transactions.storeTransactionId, input.providerTransactionId.value),
                      or(
                        isNull(transactions.lastEventOccurredAt),
                        lte(transactions.lastEventOccurredAt, input.occurredAt),
                      ),
                    ),
                  )
                  .returning({ id: transactions.id });
                const updated = { affectedRows: transactionReverseRows.length };
                if (updated.affectedRows === 0) {
                  yield* Effect.logWarning(
                    `reverseRefund: no prior transaction row OR watermark rejected (storeTransactionId=${input.providerTransactionId.value}, occurredAt=${input.occurredAt.toISOString()})`,
                  );
                }
              }
              let purchaseUpdated = false;
              /** SM-2 subject gate: did a `purchases` row back this reversal? */
              let purchaseFound = false;
              const providerKeyOp = resolvePurchaseProviderKey(input);
              if (Option.isNone(providerKeyOp)) {
                yield* Effect.logWarning(
                  "reverseRefund: no purchase provider key; skipping purchase row update",
                );
              } else {
                const db = tx;
                const existingPurchaseRow = yield* db.query.purchases.findFirst({
                  where: {
                    paymentProviderConfigurationProductId: ctx.configurationProduct.id,
                    providerKey: providerKeyOp.value,
                  },
                });
                const existingPurchase = Option.fromNullishOr(existingPurchaseRow);
                purchaseFound = Option.isSome(existingPurchase);
                if (Option.isSome(existingPurchase)) {
                  // Watermark-guarded purchase refund-reversal: the UPDATE
                  // additionally requires `last_event_occurred_at IS NULL OR
                  // <= occurredAt` so a late-arriving stale event can't
                  // overwrite fresher state.
                  const purchaseReverseRows = yield* db
                    .update(purchases)
                    .set({
                      lastEventOccurredAt: input.occurredAt,
                      refundReason: null,
                      refundedAt: null,
                    })
                    .where(
                      and(
                        eq(
                          purchases.paymentProviderConfigurationProductId,
                          ctx.configurationProduct.id,
                        ),
                        eq(purchases.providerKey, providerKeyOp.value),
                        or(
                          isNull(purchases.lastEventOccurredAt),
                          lte(purchases.lastEventOccurredAt, input.occurredAt),
                        ),
                      ),
                    )
                    .returning({ id: purchases.id });
                  const purchaseUpdate = { affectedRows: purchaseReverseRows.length };
                  purchaseUpdated = purchaseUpdate.affectedRows > 0;
                  if (purchaseUpdate.affectedRows === 0) {
                    yield* Effect.logWarning(
                      `reverseRefund: purchase row watermark rejected (providerKey=${providerKeyOp.value}, occurredAt=${input.occurredAt.toISOString()})`,
                    );
                  }
                }
              }
              // SM-2: mirror `refundPurchase`'s missing-subject guard. A
              // reversal for a subject we never recorded has no refund to undo,
              // so emitting its `+1` counterpart would inject revenue that was
              // never subtracted. Finalize the ledger row empty instead.
              if (!transactionFound && !purchaseFound) {
                yield* Effect.logWarning(
                  "reverseRefund: no transaction and no purchase row for the reversal subject; finalizing an empty ledger row without analytics",
                );
                return yield* _finalizeReservedLedgerResult(
                  tx,
                  ledgerClaim.reservation,
                  new PurchaseProcessingResult({
                    analyticsEventIds: [],
                    changedGrantIds: [],
                    idempotent: false,
                    personId,
                    purchaseId: Option.none(),
                    subscriptionId: Option.none(),
                    transactionId: Option.none(),
                  }),
                );
              }
              const changedGrantIds = yield* _syncPurchasePerksWhen(purchaseUpdated, tx, personId);

              return yield* _enqueueAnalyticsAndBuildResult(tx, {
                buildEvents: (cfg) =>
                  toRefundReversedAnalyticsInputs({ ...input, money }, { personId }, cfg),
                buildResult: (analyticsEventIds) =>
                  new PurchaseProcessingResult({
                    analyticsEventIds,
                    changedGrantIds,
                    idempotent: false,
                    personId,
                    purchaseId: Option.none(),
                    subscriptionId: Option.none(),
                    transactionId: Option.none(),
                  }),
                idempotencyKey: input.idempotencyKey,
                organizationId: input.organizationId,
                paymentProviderConfigurationProductId: ctx.configurationProduct.id,
                personId,
                projectId: input.projectId,
                providerEventType: input.providerEventType,
                providerId: input.providerId,
                rawProviderPayload: input.rawProviderPayload,
                reservation: ledgerClaim.reservation,
                source: input.source,
              });
            }),
          );
        },
        (effect, input) =>
          _withPurchaseActionObservability(effect, input).pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new PurchaseProcessingServiceError({ cause: String(error.cause) })),
              PerkGrantServiceError: (error: { readonly cause: string }) =>
                Effect.fail(new PurchaseProcessingServiceError({ cause: error.cause })),
              SqlError: (error) =>
                Effect.fail(new PurchaseProcessingServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      /**
       * Rebinds ownership of an existing subscription from `fromPersonId` to
       * `toPersonId`. Both persons remain fully intact identified persons;
       * this is deliberately NOT an identity merge. Idempotency comes from
       * the `SELECT ... FOR UPDATE` row lock plus the current-owner check.
       */
      const transferSubscription = Effect.fn("transferSubscription")(
        function* (input: TransferSubscriptionInput) {
          return yield* db.transaction((tx) =>
            Effect.gen(function* () {
              const db = tx;
              // Reads the subscription row with a `SELECT ... FOR UPDATE` row
              // lock so concurrent transfers of the same subscription
              // serialize on the row.
              const subscriptionLockedRows = yield* db
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, input.subscriptionId))
                .for("update");
              const subscriptionOp = Option.fromNullishOr(subscriptionLockedRows[0]);
              if (Option.isNone(subscriptionOp)) {
                return yield* new PurchaseProcessingServiceError({
                  cause: `transferSubscription: subscription ${input.subscriptionId} not found`,
                });
              }
              const subscription = subscriptionOp.value;

              if (subscription.personId === input.toPersonId) {
                return new PurchaseProcessingResult({
                  analyticsEventIds: [],
                  changedGrantIds: [],
                  idempotent: true,
                  personId: input.toPersonId,
                  purchaseId: Option.none(),
                  subscriptionId: Option.some(subscription.id),
                  transactionId: Option.none(),
                });
              }
              if (subscription.personId !== input.fromPersonId) {
                return yield* new PurchaseProcessingServiceError({
                  cause: `transferSubscription: subscription ${subscription.id} is owned by ${subscription.personId}, expected ${input.fromPersonId}`,
                });
              }

              const keptResult = new PurchaseProcessingResult({
                analyticsEventIds: [],
                changedGrantIds: [],
                idempotent: false,
                personId: input.fromPersonId,
                purchaseId: Option.none(),
                subscriptionId: Option.some(subscription.id),
                transactionId: Option.none(),
              });

              if (input.transferMode === "keep_with_previous_owner") {
                return keptResult;
              }
              if (input.transferMode === "transfer_if_no_active_on_target") {
                const targetActiveRows = yield* db
                  .select({ count: sql<number>`count(*)` })
                  .from(subscriptions)
                  .where(
                    and(
                      eq(subscriptions.personId, input.toPersonId),
                      eq(subscriptions.status, SubscriptionStatus.Active),
                    ),
                  );
                const targetActive = Number(targetActiveRows[0]?.count ?? 0);
                if (targetActive > 0) {
                  return keptResult;
                }
              }

              // Watermark-guarded ownership rebind: the UPDATE additionally
              // requires `last_event_occurred_at IS NULL OR <= occurredAt` so
              // a stale event can't overwrite a fresher transfer.
              const ownershipRows = yield* db
                .update(subscriptions)
                .set({ lastEventOccurredAt: input.occurredAt, personId: input.toPersonId })
                .where(
                  and(
                    eq(subscriptions.id, subscription.id),
                    or(
                      isNull(subscriptions.lastEventOccurredAt),
                      lte(subscriptions.lastEventOccurredAt, input.occurredAt),
                    ),
                  ),
                )
                .returning({ id: subscriptions.id });
              const ownershipUpdate = { affectedRows: ownershipRows.length };
              if (ownershipUpdate.affectedRows === 0) {
                yield* Effect.logInfo(
                  `transferSubscription: stale event; watermark guard rejected ownership update (subscriptionId=${subscription.id}, occurredAt=${input.occurredAt.toISOString()})`,
                );
                return keptResult;
              }
              const fromGrants = yield* _syncPurchasePerks(tx, input.fromPersonId);
              const toGrants = yield* _syncPurchasePerks(tx, input.toPersonId);
              const [fromDistinctId, toDistinctId] = yield* Effect.all([
                _resolveDistinctId(tx, input.fromPersonId),
                _resolveDistinctId(tx, input.toPersonId),
              ]);
              yield* Effect.annotateCurrentSpan("voidhash.person.from_distinct_id", fromDistinctId);
              yield* Effect.annotateCurrentSpan("voidhash.person.to_distinct_id", toDistinctId);
              yield* Effect.annotateCurrentSpan("voidhash.subscription.id", subscription.id);

              return yield* _enqueueAnalyticsAndBuildResult(tx, {
                buildEvents: (cfg) =>
                  toSubscriptionTransferredAnalyticsInputs(
                    {
                      fromDistinctId,
                      fromPersonId: input.fromPersonId,
                      occurredAt: input.occurredAt,
                      paymentProviderConfigurationId: input.paymentProviderConfigurationId,
                      providerId: input.providerId,
                      source: input.source,
                      subscription: {
                        id: subscription.id,
                        paymentProviderConfigurationProductId:
                          subscription.paymentProviderConfigurationProductId,
                        providerEnvironment: subscription.providerEnvironment,
                        storeSubscriptionId: subscription.storeSubscriptionId,
                      },
                      toDistinctId,
                      toPersonId: input.toPersonId,
                      transferMode: input.transferMode,
                      triggerReason: input.triggerReason,
                    },
                    cfg,
                  ),
                buildResult: (analyticsEventIds) =>
                  new PurchaseProcessingResult({
                    analyticsEventIds,
                    changedGrantIds: [...fromGrants, ...toGrants],
                    idempotent: false,
                    personId: input.toPersonId,
                    purchaseId: Option.none(),
                    subscriptionId: Option.some(subscription.id),
                    transactionId: Option.none(),
                  }),
                // Deterministic transfer anchor (prereq R2): encodes the
                // subscription, the transfer DIRECTION (from→to), and the
                // provider event timestamp. A redelivered provider event reuses
                // the same `occurredAt` so it dedupes; a genuinely repeated
                // same-direction transfer at a later time gets a distinct key
                // (App Store restores can recur, including back-and-forth). This
                // also fixes the latent outbox bug where the old random suffix
                // defeated the ledger's own `UNIQUE(idempotency_key)` dedup.
                // A redelivery whose `occurredAt` drifted can't mint a second
                // ledger row either: drifted-forward hits the current-owner
                // idempotent early-return, drifted-backward is rejected by the
                // watermark guard — both before this ledger write is reached.
                idempotencyKey: `subscription_transfer:${subscription.id}:${input.fromPersonId}->${input.toPersonId}:${input.occurredAt.toISOString()}`,
                organizationId: input.organizationId,
                paymentProviderConfigurationProductId:
                  subscription.paymentProviderConfigurationProductId,
                personId: input.toPersonId,
                projectId: input.projectId,
                providerEventType: "subscription.transferred",
                providerId: input.providerId,
                rawProviderPayload: Option.none(),
                source: input.source,
              });
            }),
          );
        },
        (effect, input) =>
          _withTransferObservability(effect, input).pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new PurchaseProcessingServiceError({ cause: String(error.cause) })),
              PerkGrantServiceError: (error: { readonly cause: string }) =>
                Effect.fail(new PurchaseProcessingServiceError({ cause: error.cause })),
              SqlError: (error) =>
                Effect.fail(new PurchaseProcessingServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      const transferPurchase = Effect.fn("transferPurchase")(
        function* (input: TransferPurchaseInput) {
          return yield* db.transaction((tx) =>
            Effect.gen(function* () {
              const db = tx;
              // Reads the purchase row with a `SELECT ... FOR UPDATE` row lock
              // so concurrent transfers of the same purchase serialize on the
              // row.
              const purchaseLockedRows = yield* db
                .select()
                .from(purchases)
                .where(eq(purchases.id, input.purchaseId))
                .for("update");
              const purchaseOp = Option.fromNullishOr(purchaseLockedRows[0]);
              if (Option.isNone(purchaseOp)) {
                return yield* new PurchaseProcessingServiceError({
                  cause: `transferPurchase: purchase ${input.purchaseId} not found`,
                });
              }
              const purchase = purchaseOp.value;

              if (purchase.personId === input.toPersonId) {
                return new PurchaseProcessingResult({
                  analyticsEventIds: [],
                  changedGrantIds: [],
                  idempotent: true,
                  personId: input.toPersonId,
                  purchaseId: Option.some(purchase.id),
                  subscriptionId: Option.none(),
                  transactionId: Option.none(),
                });
              }
              if (purchase.personId !== input.fromPersonId) {
                return yield* new PurchaseProcessingServiceError({
                  cause: `transferPurchase: purchase ${purchase.id} is owned by ${purchase.personId}, expected ${input.fromPersonId}`,
                });
              }

              const keptResult = new PurchaseProcessingResult({
                analyticsEventIds: [],
                changedGrantIds: [],
                idempotent: false,
                personId: input.fromPersonId,
                purchaseId: Option.some(purchase.id),
                subscriptionId: Option.none(),
                transactionId: Option.none(),
              });

              if (purchase.type !== PurchaseType.OneTime) {
                yield* Effect.logInfo(
                  `transferPurchase: purchase ${purchase.id} is not a non-consumable one-time purchase (type=${purchase.type}); skipping transfer`,
                );
                return keptResult;
              }
              if (purchase.refundedAt !== null || purchase.revokedAt !== null) {
                yield* Effect.logInfo(
                  `transferPurchase: purchase ${purchase.id} is not active; skipping transfer`,
                );
                return keptResult;
              }
              if (input.transferMode === "keep_with_previous_owner") {
                return keptResult;
              }
              if (input.transferMode === "transfer_if_no_active_on_target") {
                const targetActiveRows = yield* db
                  .select({ count: sql<number>`count(*)` })
                  .from(purchases)
                  .where(
                    and(
                      eq(purchases.personId, input.toPersonId),
                      eq(purchases.type, PurchaseType.OneTime),
                      isNull(purchases.refundedAt),
                      isNull(purchases.revokedAt),
                    ),
                  );
                const targetActive = Number(targetActiveRows[0]?.count ?? 0);
                if (targetActive > 0) {
                  return keptResult;
                }
              }

              // Watermark-guarded ownership rebind: the UPDATE additionally
              // requires `last_event_occurred_at IS NULL OR <= occurredAt` so
              // a stale event can't overwrite a fresher transfer — mirrors
              // `transferSubscription`.
              const ownershipRows = yield* db
                .update(purchases)
                .set({ lastEventOccurredAt: input.occurredAt, personId: input.toPersonId })
                .where(
                  and(
                    eq(purchases.id, purchase.id),
                    or(
                      isNull(purchases.lastEventOccurredAt),
                      lte(purchases.lastEventOccurredAt, input.occurredAt),
                    ),
                  ),
                )
                .returning({ id: purchases.id });
              const ownershipUpdate = { affectedRows: ownershipRows.length };
              if (ownershipUpdate.affectedRows === 0) {
                yield* Effect.logInfo(
                  `transferPurchase: stale event; watermark guard rejected ownership update (purchaseId=${purchase.id}, occurredAt=${input.occurredAt.toISOString()})`,
                );
                return keptResult;
              }
              const fromGrants = yield* _syncPurchasePerks(tx, input.fromPersonId);
              const toGrants = yield* _syncPurchasePerks(tx, input.toPersonId);
              const [fromDistinctId, toDistinctId] = yield* Effect.all([
                _resolveDistinctId(tx, input.fromPersonId),
                _resolveDistinctId(tx, input.toPersonId),
              ]);
              yield* Effect.annotateCurrentSpan("voidhash.person.from_distinct_id", fromDistinctId);
              yield* Effect.annotateCurrentSpan("voidhash.person.to_distinct_id", toDistinctId);
              yield* Effect.annotateCurrentSpan("voidhash.purchase.id", purchase.id);

              return yield* _enqueueAnalyticsAndBuildResult(tx, {
                buildEvents: (cfg) =>
                  toPurchaseTransferredAnalyticsInputs(
                    {
                      fromDistinctId,
                      fromPersonId: input.fromPersonId,
                      occurredAt: input.occurredAt,
                      paymentProviderConfigurationId: input.paymentProviderConfigurationId,
                      providerId: input.providerId,
                      purchase: {
                        id: purchase.id,
                        paymentProviderConfigurationProductId:
                          purchase.paymentProviderConfigurationProductId,
                        providerEnvironment: purchase.providerEnvironment,
                        providerKey: purchase.providerKey,
                      },
                      source: input.source,
                      toDistinctId,
                      toPersonId: input.toPersonId,
                      transferMode: input.transferMode,
                      triggerReason: input.triggerReason,
                    },
                    cfg,
                  ),
                buildResult: (analyticsEventIds) =>
                  new PurchaseProcessingResult({
                    analyticsEventIds,
                    changedGrantIds: [...fromGrants, ...toGrants],
                    idempotent: false,
                    personId: input.toPersonId,
                    purchaseId: Option.some(purchase.id),
                    subscriptionId: Option.none(),
                    transactionId: Option.none(),
                  }),
                // Deterministic transfer anchor (prereq R2) — see the
                // `transferSubscription` key above for the direction +
                // `occurredAt` rationale.
                idempotencyKey: `purchase_transfer:${purchase.id}:${input.fromPersonId}->${input.toPersonId}:${input.occurredAt.toISOString()}`,
                organizationId: input.organizationId,
                paymentProviderConfigurationProductId:
                  purchase.paymentProviderConfigurationProductId,
                personId: input.toPersonId,
                projectId: input.projectId,
                providerEventType: "purchase.transferred",
                providerId: input.providerId,
                rawProviderPayload: Option.none(),
                source: input.source,
              });
            }),
          );
        },
        (effect, input) =>
          _withTransferObservability(effect, input).pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new PurchaseProcessingServiceError({ cause: String(error.cause) })),
              PerkGrantServiceError: (error: { readonly cause: string }) =>
                Effect.fail(new PurchaseProcessingServiceError({ cause: error.cause })),
              SqlError: (error) =>
                Effect.fail(new PurchaseProcessingServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      return constant({
        cancelSubscription,
        changeRenewalPreference,
        completeOneTimePurchase,
        enterBillingRetry,
        expireSubscription,
        extendSubscription,
        recordPriceIncrease,
        redeemOffer,
        refundPurchase,
        renewSubscription,
        resumeAutoRenew,
        reverseRefund,
        revokePurchase,
        revokeSubscription,
        startSubscription,
        transferPurchase,
        transferSubscription,
      });
    }),
  },
) {
  static layer = Layer.effect(PurchaseProcessingService)(PurchaseProcessingService.make);
}

/** PostgreSQL-backed state-store adapter over a supplied {@link PurchaseProcessingService}. */
export const DbPurchaseStateStoreAdapterLive = Layer.effect(
  PurchaseStateStore,
  Effect.gen(function* () {
    const processing = yield* PurchaseProcessingService;
    const db = yield* Db;
    const adapt = <A>(
      effect: Effect.Effect<
        A,
        PurchaseProcessingServiceError | PurchaseProcessingProductNotMappedError,
        Db
      >,
    ) =>
      effect.pipe(
        Effect.provideService(Db, db),
        Effect.catchTags({
          PurchaseProcessingProductNotMappedError: (error) =>
            Effect.fail(
              new CoreV2ProductNotMappedError({
                paymentProviderConfigurationId: error.paymentProviderConfigurationId,
                paymentProviderConfigurationProductId: error.paymentProviderConfigurationProductId,
              }),
            ),
          PurchaseProcessingServiceError: (error) =>
            Effect.fail(new CoreV2ProcessingError({ cause: error.cause })),
        }),
      );

    return PurchaseStateStore.of({
      startSubscription: (input) => adapt(processing.startSubscription(input)),
      renewSubscription: (input) => adapt(processing.renewSubscription(input)),
      cancelSubscription: (input) => adapt(processing.cancelSubscription(input)),
      expireSubscription: (input) => adapt(processing.expireSubscription(input)),
      revokeSubscription: (input) => adapt(processing.revokeSubscription(input)),
      completeOneTimePurchase: (input) => adapt(processing.completeOneTimePurchase(input)),
      refundPurchase: (input) => adapt(processing.refundPurchase(input)),
      revokePurchase: (input) => adapt(processing.revokePurchase(input)),
      reverseRefund: (input) => adapt(processing.reverseRefund(input)),
      enterBillingRetry: (input) => adapt(processing.enterBillingRetry(input)),
      extendSubscription: (input) => adapt(processing.extendSubscription(input)),
      changeRenewalPreference: (input) => adapt(processing.changeRenewalPreference(input)),
      redeemOffer: (input) => adapt(processing.redeemOffer(input)),
      recordPriceIncrease: (input) => adapt(processing.recordPriceIncrease(input)),
      resumeAutoRenew: (input) => adapt(processing.resumeAutoRenew(input)),
      transferSubscription: (input) => adapt(processing.transferSubscription(input)),
      transferPurchase: (input) => adapt(processing.transferPurchase(input)),
    } satisfies PurchaseStateStoreShape);
  }),
);

const DbPurchaseProcessingLive = PurchaseProcessingService.layer.pipe(
  Layer.provide(PerkGrantService.layer),
  Layer.provide(WebhookEventPublisher.layer.pipe(Layer.provide(WebhookDispatchService.layer))),
);

/** Transactional PostgreSQL purchase state adapter with live webhook publication. */
export const DbPurchaseStateStoreLive = DbPurchaseStateStoreAdapterLive.pipe(
  Layer.provide(DbPurchaseProcessingLive),
);

/** Test composition that isolates outbound webhooks while retaining real state writes. */
export const PurchaseProcessorTestLive = PurchaseProcessor.layer.pipe(
  Layer.provide(
    DbPurchaseStateStoreAdapterLive.pipe(
      Layer.provide(
        PurchaseProcessingService.layer.pipe(
          Layer.provide(PerkGrantService.layer),
          Layer.provide(WebhookEventPublisher.noop),
        ),
      ),
    ),
  ),
);
