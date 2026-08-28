import { Context, type Effect } from "effect";

import type { StripePaymentProviderServiceError } from "../domain/StripeErrors.ts";

/**
 * Result returned to the Stripe webhook ingress. `accepted` reflects whether we
 * verified the `Stripe-Signature` HMAC and parsed the event (i.e. whether
 * Stripe should stop retrying); `handled` reflects whether we mutated purchase
 * state beyond acknowledging receipt.
 */
export interface StripeAcceptWebhookEventResult {
  readonly accepted: true;
  readonly handled: boolean;
  readonly eventId: string;
  readonly eventType: string;
}

export interface StripePaymentProviderServiceShape {
  /**
   * Webhook entry point — verifies the Stripe signature against the per-tenant
   * signing secret, decodes the event, and dispatches it to the matching
   * `record*` method on the underlying engine. The Stripe webhook route calls
   * this with the raw request body + `Stripe-Signature` header.
   */
  readonly acceptWebhookEvent: (input: {
    readonly paymentProviderConfigurationId: string;
    readonly rawBody: string;
    readonly signatureHeader: string;
    readonly receivedAt: Date;
  }) => Effect.Effect<StripeAcceptWebhookEventResult, StripePaymentProviderServiceError, never>;
}

/** Stripe purchase ingress boundary implemented by the backend provider adapter. */
export class StripePaymentProviderService extends Context.Service<
  StripePaymentProviderService,
  StripePaymentProviderServiceShape
>()("@voidhash/core-v2/purchases/providers/StripePurchases") {}
