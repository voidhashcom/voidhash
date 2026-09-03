import * as Schema from "effect/Schema";

/** Purchase action a Stripe webhook event maps to. */
export const StripeEventRoute = Schema.Literals([
  "invoice_paid",
  "invoice_payment_failed",
  "subscription_updated",
  "subscription_deleted",
  "checkout_session_completed",
  "charge_refunded",
  "refund_updated",
  "dispute_closed",
  "ignored",
]);
export type StripeEventRoute = typeof StripeEventRoute.Type;

const ROUTES_BY_EVENT_TYPE: Readonly<Record<string, StripeEventRoute>> = {
  "charge.dispute.closed": "dispute_closed",
  "charge.refund.updated": "refund_updated",
  "charge.refunded": "charge_refunded",
  "checkout.session.completed": "checkout_session_completed",
  "customer.subscription.deleted": "subscription_deleted",
  "customer.subscription.updated": "subscription_updated",
  "invoice.paid": "invoice_paid",
  "invoice.payment_failed": "invoice_payment_failed",
};

/** Decision table from Stripe's `event.type` to the purchase action to record. */
export const routeStripeEvent = (eventType: string): StripeEventRoute =>
  ROUTES_BY_EVENT_TYPE[eventType] ?? "ignored";
