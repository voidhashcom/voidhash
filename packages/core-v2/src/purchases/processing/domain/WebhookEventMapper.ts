/**
 * Per-action mappers that translate a purchase-state transition into the
 * outbound webhook payload published on the project's subscribed endpoints.
 *
 * Unlike {@link import("./revenue-analytics-mapper").toStartedAnalyticsInputs}
 * and friends, these run only when the transition actually CHANGED state — a
 * redelivered store notification collapses on the purchase-ledger idempotency
 * key (or on the row-level watermark) before a mapper is ever called, so one
 * real transition produces exactly one webhook per subscribed endpoint.
 *
 * Every payload is encoded through its `api-contracts` schema here, so what
 * reaches `WebhookDispatchService` is byte-identical to the published contract
 * and cannot drift from it.
 */
import {
  type WebhookEnvironment,
  type WebhookPurchaseKind,
  type WebhookSubscriptionStatus,
  WebhookMoney,
  WebhookPurchaseCompletedPayload,
  WebhookPurchaseRefundedPayload,
  WebhookSubscriptionCancelledPayload,
  WebhookSubscriptionCreatedPayload,
  WebhookSubscriptionExpiredPayload,
  WebhookSubscriptionRenewedPayload,
} from "@voidhash/api-contracts";
import { SubscriptionStatus } from "@voidhash/lib";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import type { ProviderEnvironment } from "../../domain/PurchaseAction.ts";
import type { PurchaseProcessingMoney } from "../../domain/PurchaseProcessing.ts";
import type {
  CancelSubscriptionInput,
  CompleteOneTimePurchaseInput,
  ExpireSubscriptionInput,
  PurchaseActionContext,
  RefundPurchaseInput,
  RenewSubscriptionInput,
  StartSubscriptionInput,
} from "../../domain/PurchaseAction.ts";

type WebhookEventType =
  | "subscription.created"
  | "subscription.renewed"
  | "subscription.cancelled"
  | "subscription.expired"
  | "purchase.completed"
  | "purchase.refunded";

/**
 * One ready-to-publish lifecycle event: the wire event name plus the encoded
 * JSON body. `null` is used by the service to mean "nothing changed, publish
 * nothing".
 */
export interface WebhookLifecycleEvent {
  readonly eventType: WebhookEventType;
  readonly payload: object;
}

/**
 * Subject identity the mappers cannot read off {@link PurchaseActionContext}:
 * resolved by the service's `_resolveContext` from the configuration-product
 * mapping and the person row, so no mapper issues its own query.
 */
export interface WebhookEventMapperContext {
  readonly distinctId: string;
  readonly productId: string;
  readonly productSlug: string | typeof Schema.Null.Type;
  readonly providerProductId: string;
}

const encodeSubscriptionCreated = Schema.encodeSync(WebhookSubscriptionCreatedPayload);
const encodeSubscriptionRenewed = Schema.encodeSync(WebhookSubscriptionRenewedPayload);
const encodeSubscriptionCancelled = Schema.encodeSync(WebhookSubscriptionCancelledPayload);
const encodeSubscriptionExpired = Schema.encodeSync(WebhookSubscriptionExpiredPayload);
const encodePurchaseCompleted = Schema.encodeSync(WebhookPurchaseCompletedPayload);
const encodePurchaseRefunded = Schema.encodeSync(WebhookPurchaseRefundedPayload);

const environmentLabel = (environment: typeof ProviderEnvironment.Type): WebhookEnvironment => {
  if (environment === 3) return "development";
  if (environment === 2) return "sandbox";
  return "production";
};

/** Widens the stored `smallint` status column to the public status label. */
const statusLabel = (status: number): WebhookSubscriptionStatus => {
  if (status === SubscriptionStatus.Active) return "active";
  return "canceled";
};

/** Maps the internal purchase flavour to its public wire label. */
const purchaseKindLabel = (purchaseType: string): WebhookPurchaseKind => {
  if (purchaseType === "consumable") return "consumable";
  return "one_time";
};

const isoOrNull = (date: Option.Option<Date>) =>
  Option.match(date, { onNone: () => null, onSome: (value) => value.toISOString() });

/**
 * Gross charge for the payload. Absent money stays `null` rather than being
 * zero-filled so receivers can distinguish "provider reported no amount" from
 * a genuine zero-price transaction.
 */
const toMoney = (money: Option.Option<PurchaseProcessingMoney>) =>
  Option.match(money, {
    onNone: () => null,
    onSome: (value) =>
      new WebhookMoney({ currency: value.currency, grossAmount: value.grossAmount }),
  });

const baseFields = (input: typeof PurchaseActionContext.Type, cfg: WebhookEventMapperContext) => ({
  distinctId: cfg.distinctId,
  environment: environmentLabel(input.providerEnvironment),
  occurredAt: input.occurredAt.toISOString(),
  personId: input.personId,
  productId: cfg.productId,
  productSlug: cfg.productSlug,
  projectId: input.projectId,
  provider: input.providerId,
  providerProductId: cfg.providerProductId,
});

const subscriptionBaseFields = (
  input: typeof PurchaseActionContext.Type,
  subject: { readonly subscriptionId: string; readonly status: number },
  cfg: WebhookEventMapperContext,
) => ({
  ...baseFields(input, cfg),
  providerSubscriptionId: Option.getOrNull(input.providerSubscriptionId),
  providerTransactionId: Option.getOrNull(input.providerTransactionId),
  status: statusLabel(subject.status),
  subscriptionId: subject.subscriptionId,
});

/**
 * `subscription.created` — a subscription row was newly inserted, i.e. the
 * subscription just became known to Voidhash. That is usually a start, but a
 * renewal notification can be first contact too (a missed start, or an app
 * migrating onto Voidhash mid-subscription); `subject.purchasedAt` is the
 * value the inserted row was stamped with, so the payload matches the row
 * whichever path created it.
 */
export const toSubscriptionCreatedWebhookEvent = (
  input: typeof StartSubscriptionInput.Type | typeof RenewSubscriptionInput.Type,
  subject: { readonly subscriptionId: string; readonly purchasedAt: Date },
  cfg: WebhookEventMapperContext,
): WebhookLifecycleEvent => ({
  eventType: "subscription.created",
  payload: encodeSubscriptionCreated(
    new WebhookSubscriptionCreatedPayload({
      ...subscriptionBaseFields(
        input,
        { status: SubscriptionStatus.Active, subscriptionId: subject.subscriptionId },
        cfg,
      ),
      amount: toMoney(input.money),
      expiresAt: isoOrNull(input.expiresAt),
      isTrial: input.isTrial,
      purchasedAt: subject.purchasedAt.toISOString(),
      startsAt: input.startsAt.toISOString(),
      type: "subscription.created",
    }),
  ),
});

/** `subscription.renewed` — a new billing period was applied to the projection. */
export const toSubscriptionRenewedWebhookEvent = (
  input: typeof RenewSubscriptionInput.Type,
  subject: { readonly subscriptionId: string },
  cfg: WebhookEventMapperContext,
): WebhookLifecycleEvent => ({
  eventType: "subscription.renewed",
  payload: encodeSubscriptionRenewed(
    new WebhookSubscriptionRenewedPayload({
      ...subscriptionBaseFields(
        input,
        { status: SubscriptionStatus.Active, subscriptionId: subject.subscriptionId },
        cfg,
      ),
      amount: toMoney(input.money),
      expiresAt: isoOrNull(input.expiresAt),
      isTrial: input.isTrial,
      renewedAt: input.renewedAt.toISOString(),
      startsAt: input.startsAt.toISOString(),
      type: "subscription.renewed",
    }),
  ),
});

/** `subscription.cancelled` — auto-renew was turned off or access was pulled. */
export const toSubscriptionCancelledWebhookEvent = (
  input: typeof CancelSubscriptionInput.Type,
  subject: {
    readonly subscriptionId: string;
    readonly status: number;
    readonly expiresAt: Date | typeof Schema.Null.Type;
  },
  cfg: WebhookEventMapperContext,
): WebhookLifecycleEvent => ({
  eventType: "subscription.cancelled",
  payload: encodeSubscriptionCancelled(
    new WebhookSubscriptionCancelledPayload({
      ...subscriptionBaseFields(
        input,
        { status: subject.status, subscriptionId: subject.subscriptionId },
        cfg,
      ),
      cancelAtPeriodEnd: input.isCancelAtPeriodEnd,
      canceledAt: input.canceledAt.toISOString(),
      cancellationReason: Option.getOrNull(input.cancellationReason),
      expiresAt: isoOrNull(Option.fromNullishOr(subject.expiresAt)),
      type: "subscription.cancelled",
    }),
  ),
});

/** `subscription.expired` — the paid period ran out and entitlement ended. */
export const toSubscriptionExpiredWebhookEvent = (
  input: typeof ExpireSubscriptionInput.Type,
  subject: { readonly subscriptionId: string },
  cfg: WebhookEventMapperContext,
): WebhookLifecycleEvent => ({
  eventType: "subscription.expired",
  payload: encodeSubscriptionExpired(
    new WebhookSubscriptionExpiredPayload({
      ...subscriptionBaseFields(
        input,
        { status: SubscriptionStatus.Canceled, subscriptionId: subject.subscriptionId },
        cfg,
      ),
      expiredAt: input.expiredAt.toISOString(),
      type: "subscription.expired",
    }),
  ),
});

/** `purchase.completed` — a non-subscription purchase row was newly inserted. */
export const toPurchaseCompletedWebhookEvent = (
  input: typeof CompleteOneTimePurchaseInput.Type,
  subject: { readonly purchaseId: string; readonly providerKey: string },
  cfg: WebhookEventMapperContext,
): WebhookLifecycleEvent => ({
  eventType: "purchase.completed",
  payload: encodePurchaseCompleted(
    new WebhookPurchaseCompletedPayload({
      ...baseFields(input, cfg),
      amount: toMoney(input.money),
      providerKey: subject.providerKey,
      providerTransactionId: Option.getOrNull(input.providerTransactionId),
      purchaseId: subject.purchaseId,
      purchaseKind: purchaseKindLabel(input.purchaseType),
      purchasedAt: input.purchasedAt.toISOString(),
      type: "purchase.completed",
    }),
  ),
});

/**
 * `purchase.refunded` — the store reversed a charge. `money` is reconstructed
 * from the stored transaction row by the service, so the amount reflects what
 * was originally charged.
 */
export const toPurchaseRefundedWebhookEvent = (
  input: typeof RefundPurchaseInput.Type,
  subject: {
    readonly purchaseId: string | typeof Schema.Null.Type;
    readonly money: Option.Option<PurchaseProcessingMoney>;
  },
  cfg: WebhookEventMapperContext,
): WebhookLifecycleEvent => ({
  eventType: "purchase.refunded",
  payload: encodePurchaseRefunded(
    new WebhookPurchaseRefundedPayload({
      ...baseFields(input, cfg),
      amount: toMoney(subject.money),
      providerTransactionId: Option.getOrNull(input.providerTransactionId),
      purchaseId: subject.purchaseId,
      refundReason: Option.getOrNull(input.refundReason),
      refundedAt: input.refundedAt.toISOString(),
      type: "purchase.refunded",
    }),
  ),
});
